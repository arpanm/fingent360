import { z } from 'zod';
import {
  ConnectionReviewInboxSchema,
  ConnectionReviewExportSchema,
  ConnectionReviewReceiptSchema,
  CheckConnectionsSchema,
  AcknowledgeConnectionSchema,
  emptyReviewInbox,
  evaluateConnections,
  ResearchConnectionRevisionSchema,
  connectionSource,
  connectionTargets,
  connectionView,
  type ResearchConnectionRevision,
  type ConnectionReviewInbox,
  type ConnectionReviewReceipt,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineHandler,
  type LocalState,
} from './types';
import { localGoals, localHoldings, parseLocal } from './finance';
type State = {
  inbox: ConnectionReviewInbox;
  requests: Record<
    string,
    { fingerprint: string; receipt: ConnectionReviewReceipt }
  >;
};
const stateFor = (state: LocalState, id: string): State =>
  (state.data.localConnectionReviews as Record<string, State> | undefined)?.[
    id
  ] ?? { inbox: emptyReviewInbox(), requests: {} };
const recent = (value: State) =>
  Object.fromEntries(
    Object.entries(value.requests).filter(
      ([, r]) => Date.parse(r.receipt.recordedAt) > Date.now() - 30 * 86400000,
    ),
  );
export function exportLocalConnectionReviews(state: LocalState, id: string) {
  const value = stateFor(state, id);
  return ConnectionReviewExportSchema.parse({
    ...value.inbox,
    receipts: Object.values(recent(value)).map((r) => r.receipt),
  });
}
export const handleConnectionReviews: OfflineHandler = (req, state, bundle) => {
  const base = '/api/v1/account/connection-reviews';
  if (req.path !== base && !req.path.startsWith(`${base}/`)) return null;
  const user = requireUser(state),
    saved = stateFor(state, user.id);
  let current = ConnectionReviewInboxSchema.parse(saved.inbox);
  if (req.path === base && req.method === 'GET') return { body: current };
  if (req.method !== 'POST') return fail(404, 'Review operation unavailable.');
  const check = req.path === `${base}/check`;
  const suffix = req.path.slice(base.length + 1).split('/');
  if (!check && (suffix.length !== 2 || suffix[1] !== 'acknowledge'))
    return fail(404, 'Review operation unavailable.');
  const id = check ? null : parseLocal(z.uuid(), suffix[0]);
  const input = check
    ? parseLocal(CheckConnectionsSchema, req.body)
    : parseLocal(AcknowledgeConnectionSchema, req.body);
  const fingerprint = JSON.stringify({
    action: check ? 'check' : 'acknowledge',
    connectionId: id,
    input,
  });
  const requests = recent(saved),
    prior = requests[input.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      return fail(409, 'Request ID already used.');
    return { body: ConnectionReviewReceiptSchema.parse(prior.receipt) };
  }
  if (Object.keys(requests).length >= 1000)
    return fail(
      400,
      'Review request limit reached. Retry after older30-day receipts expire.',
    );
  const now = new Date().toISOString();
  let receipt;
  if (check) {
    // Resolved notices stay in the inbox, but removed heads no longer need evaluation.
    // The valid union is at most 200 active heads plus 200 unresolved-notice heads.
    const kept = new Set(
      current.notices
        .filter((n) => n.status !== 'resolved')
        .map((n) => n.connectionId),
    );
    const latest = new Map<string, ResearchConnectionRevision>();
    const records =
      (
        state.data.localResearchConnections as
          Record<string, { revisions: unknown[] }> | undefined
      )?.[user.id]?.revisions ?? [];
    // Iterate retained dependency history without cloning/materializing an unbounded latest list.
    for (const raw of records) {
      const r = ResearchConnectionRevisionSchema.parse(raw);
      if (r.removed && !kept.has(r.id)) latest.delete(r.id);
      else latest.set(r.id, r);
    }
    if (latest.size > 400)
      return fail(400, 'Too many current connections to check safely.');
    const items = new Map(bundle.feed.map((item) => [item.id, item]));
    for (const history of Object.values(bundle.histories))
      for (const item of history)
        if (
          item.status !== 'draft' &&
          (!items.has(item.id) || item.version > items.get(item.id)!.version)
        )
          items.set(item.id, item);
    const sources = [...items.values()].flatMap((item) => {
      const source = connectionSource(item);
      return source ? [source] : [];
    });
    const targets = connectionTargets(
      localHoldings(state, user.id),
      localGoals(state, user.id),
    );
    const revisions = [...latest.values()];
    const result = evaluateConnections(
      current,
      revisions,
      revisions
        .filter((r) => !r.removed)
        .map((r) => connectionView(r, sources, targets)),
      input.requestId,
      now,
      bundle.generatedAt,
    );
    current = result.inbox;
    receipt = result.receipt;
  } else {
    const notice = current.notices.find((n) => n.connectionId === id);
    if (!notice) return fail(404, 'Review notice not found.');
    if (
      !('expectedVersion' in input) ||
      input.expectedVersion !== notice.version
    )
      return fail(409, 'Notice changed. Reload before acknowledging.');
    if (notice.status !== 'open')
      return fail(409, 'Only an open notice can be acknowledged.');
    const updated = {
      ...notice,
      status: 'acknowledged' as const,
      version: notice.version + 1,
      acknowledgedAt: now,
    };
    current = {
      ...current,
      notices: current.notices.map((n) =>
        n.connectionId === id ? updated : n,
      ),
    };
    receipt = ConnectionReviewReceiptSchema.parse({
      requestId: input.requestId,
      action: 'acknowledge',
      recordedAt: now,
      connectionId: id,
      noticeVersion: updated.version,
      evaluation: null,
    });
  }
  state.data.localConnectionReviews = {
    ...(state.data.localConnectionReviews as Record<string, State> | undefined),
    [user.id]: {
      inbox: current,
      requests: { ...requests, [input.requestId]: { fingerprint, receipt } },
    },
  };
  return { body: receipt };
};
