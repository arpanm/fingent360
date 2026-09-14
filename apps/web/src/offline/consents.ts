import type { z } from 'zod';
import {
  ConsentStateSchema,
  ConsentReceiptSchema,
  ConsentWriteSchema,
  ConsentPurposeSchema,
  ConsentListSchema,
  ConsentHistoryQuerySchema,
  ConsentExportSchema,
  ConsentPrivacySchema,
  consentPurposes,
  consentStatus,
  consentActive,
  emptyConsent,
  reviseConsent,
  nextScheduleDue,
  type ConsentPurpose,
  type ConsentState,
  type ConsentReceipt,
  type ConsentBasisSchema,
  type Library,
  type ReportSchedule,
  type ScheduleReceiptSchema,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type LocalState,
  type OfflineHandler,
} from './types';
type ConsentData = {
  heads: Partial<Record<ConsentPurpose, ConsentState>>;
  events: { request: string | null; receipt: ConsentReceipt }[];
};
type ScheduleData = {
  schedules: ReportSchedule[];
  receipts: { receipt: z.infer<typeof ScheduleReceiptSchema> }[];
};
function data(state: LocalState, id: string): ConsentData {
  return (
    (state.data.localConsents as Record<string, ConsentData> | undefined)?.[
      id
    ] ?? { heads: {}, events: [] }
  );
}
function schedules(state: LocalState, id: string) {
  return (
    state.data.localReportSchedules as Record<string, ScheduleData> | undefined
  )?.[id];
}
export function readLocalConsent(
  state: LocalState,
  id: string,
  purpose: ConsentPurpose,
): ConsentState {
  const head = data(state, id).heads[purpose];
  if (head) return ConsentStateSchema.parse(head);
  const empty = emptyConsent(purpose);
  if (
    purpose === 'reading-personalization' &&
    (state.data.localLibraries as Record<string, Library> | undefined)?.[id]
      ?.preferences.mode === 'for_you'
  )
    return ConsentStateSchema.parse({
      ...empty,
      decision: 'granted',
      basis: { kind: 'legacy-reading-preference', recordedAt: null },
    });
  if (purpose === 'scheduled-record-reviews') {
    const existing = schedules(state, id),
      choice = existing?.receipts
        .map((r) => r.receipt)
        .reverse()
        .find(
          (r) =>
            r.schedule.status === 'active' &&
            existing?.schedules.some(
              (s) => s.id === r.schedule.id && s.status !== 'deleted',
            ),
        );
    if (choice)
      return ConsentStateSchema.parse({
        ...empty,
        decision: 'granted',
        grantedAt: choice.schedule.savedAt,
        basis: {
          kind: 'legacy-schedule-opt-in',
          recordedAt: choice.schedule.savedAt,
          scheduleId: choice.schedule.id,
          scheduleVersion: choice.schedule.version,
          requestId: choice.requestId,
        },
      });
  }
  return empty;
}
export function requireLocalConsent(
  state: LocalState,
  id: string,
  purpose: ConsentPurpose,
) {
  const current = readLocalConsent(state, id, purpose);
  if (!consentActive(current, new Date().toISOString()))
    fail(
      409,
      'This purpose is not currently permitted. Review or renew it in Privacy → Purpose consent.',
    );
  return current;
}
function save(
  state: LocalState,
  id: string,
  receipt: ConsentReceipt,
  request: string | null = null,
) {
  const next = structuredClone(data(state, id));
  next.heads[receipt.state.purpose] = receipt.state;
  next.events.push({ receipt, request });
  state.data.localConsents = {
    ...(state.data.localConsents as Record<string, ConsentData> | undefined),
    [id]: next,
  };
}
export function recordLocalConsentOptIn(
  state: LocalState,
  id: string,
  purpose: ConsentPurpose,
  basis: z.infer<typeof ConsentBasisSchema>,
) {
  const before = readLocalConsent(state, id, purpose);
  if (before.version > 0) return requireLocalConsent(state, id, purpose);
  const at = new Date().toISOString();
  const record = ConsentStateSchema.parse({
    ...emptyConsent(purpose),
    version: 1,
    decision: 'granted',
    grantedAt: at,
    changedAt: at,
    basis,
  });
  save(
    state,
    id,
    ConsentReceiptSchema.parse({
      requestId: null,
      action: 'recorded-opt-in',
      at,
      before,
      state: record,
      scheduleEffects: [],
    }),
  );
  return record;
}
export function localConsentList(state: LocalState, id: string) {
  const evaluatedAt = new Date().toISOString();
  return ConsentListSchema.parse({
    ownerId: id,
    evaluatedAt,
    purposes: consentPurposes.map((purpose) => {
      const record = readLocalConsent(state, id, purpose);
      return { record, status: consentStatus(record, evaluatedAt) };
    }),
  });
}
export function localConsentHistory(
  state: LocalState,
  id: string,
  query: unknown = {},
) {
  const q = ConsentHistoryQuerySchema.parse(query),
    stored = data(state, id),
    upper = q.upper ?? String(stored.events.length),
    after = q.after ?? '0';
  if ((q.after && !q.upper) || BigInt(after) > BigInt(upper))
    fail(400, 'Invalid consent history boundary.');
  const events = stored.events
    .map((r, i) => ({ sequence: String(i + 1), receipt: r.receipt }))
    .filter(
      (r) =>
        BigInt(r.sequence) > BigInt(after) &&
        BigInt(r.sequence) <= BigInt(upper),
    )
    .slice(0, 101);
  return ConsentExportSchema.parse({
    ownerId: id,
    upper,
    events: events.slice(0, 100),
    next: events.length > 100 ? events[99]!.sequence : null,
  });
}
export function exportLocalConsents(state: LocalState, id: string) {
  return ConsentPrivacySchema.parse({
    current: localConsentList(state, id),
    history: localConsentHistory(state, id),
  });
}
export const handleConsents: OfflineHandler = async (req, state) => {
  if (!/^\/api\/v1\/account\/consents(?:\/|$)/.test(req.path)) return null;
  const user = requireUser(state),
    tail = req.path.slice('/api/v1/account/consents'.length);
  if (req.method === 'GET' && !tail) {
    if (req.query.size) fail(400, 'Consent list does not accept filters.');
    return { body: localConsentList(state, user.id) };
  }
  if (req.method === 'GET' && tail === '/history') {
    if (new Set(req.query.keys()).size !== req.query.size)
      fail(400, 'Duplicate consent history filter.');
    return {
      body: localConsentHistory(state, user.id, Object.fromEntries(req.query)),
    };
  }
  if (req.method !== 'POST') return fail(404, 'Consent route not found.');
  const purpose = ConsentPurposeSchema.parse(tail.slice(1)),
    input = ConsentWriteSchema.parse(req.body),
    fingerprint = JSON.stringify({ purpose, input });
  const prior = data(state, user.id).events.find(
    (e) => e.receipt.requestId === input.requestId,
  );
  if (prior) {
    if (prior.request !== fingerprint)
      fail(409, 'Request ID belongs to another consent decision.');
    return { status: 201, body: prior.receipt };
  }
  const before = readLocalConsent(state, user.id, purpose),
    at = new Date().toISOString();
  if (before.version !== input.expectedVersion)
    fail(
      409,
      'Consent changed. Reload its current state before reviewing again.',
    );
  let receipt: ConsentReceipt;
  try {
    receipt = reviseConsent(before, input, at);
  } catch (error) {
    return fail(
      400,
      error instanceof Error ? error.message : 'Invalid consent decision.',
    );
  }
  if (
    purpose === 'scheduled-record-reviews' &&
    input.action !== 'revoke' &&
    !consentActive(before, at)
  ) {
    for (const schedule of [
      ...(schedules(state, user.id)?.schedules ?? []),
    ].sort((a, b) => a.id.localeCompare(b.id))) {
      if (schedule.status !== 'active') continue;
      const nextDueAt = nextScheduleDue(
        schedule.config,
        new Date().toISOString(),
      );
      schedule.nextDueAt = nextDueAt;
      schedule.message =
        'Purpose renewed; next future occurrence. No catch-up for the consent lapse.';
      receipt.scheduleEffects.push({ scheduleId: schedule.id, nextDueAt });
    }
  }
  receipt = ConsentReceiptSchema.parse(receipt);
  save(state, user.id, receipt, fingerprint);
  requireUser(state);
  if (input.action !== 'revoke') requireLocalConsent(state, user.id, purpose);
  return { status: 201, body: receipt };
};
