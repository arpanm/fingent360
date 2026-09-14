import { z } from 'zod';
import {
  type ResearchConnectionRevision,
  type ResearchConnectionView,
} from './research-connections.js';
export const ConnectionReviewNoticeSchema = z.strictObject({
  connectionId: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(['open', 'acknowledged', 'resolved']),
  targetLabel: z.string().max(200),
  fingerprint: z.string().max(4000),
  reasons: z.array(z.string().max(300)).max(10),
  checkedAt: z.iso.datetime(),
  acknowledgedAt: z.iso.datetime().nullable(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
export const ConnectionEvaluationSchema = z.strictObject({
  requestId: z.uuid(),
  checkedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
  changedCount: z.number().int().min(0).max(400),
});
export const ConnectionReviewReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  action: z.enum(['check', 'acknowledge']),
  recordedAt: z.iso.datetime(),
  connectionId: z.uuid().nullable(),
  noticeVersion: z.number().int().positive().nullable(),
  evaluation: ConnectionEvaluationSchema.nullable(),
});
export const ConnectionReviewInboxSchema = z.strictObject({
  notices: z.array(ConnectionReviewNoticeSchema).max(400),
  evaluations: z.array(ConnectionEvaluationSchema).max(100),
  lastCheckedAt: z.iso.datetime().nullable(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
export const ConnectionReviewExportSchema = ConnectionReviewInboxSchema.extend({
  receipts: z.array(ConnectionReviewReceiptSchema).max(1000),
});
export const CheckConnectionsSchema = z.strictObject({ requestId: z.uuid() });
export const AcknowledgeConnectionSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});
export type ConnectionReviewNotice = z.infer<
  typeof ConnectionReviewNoticeSchema
>;
export type ConnectionReviewInbox = z.infer<typeof ConnectionReviewInboxSchema>;
export type ConnectionReviewReceipt = z.infer<
  typeof ConnectionReviewReceiptSchema
>;
export const emptyReviewInbox = (): ConnectionReviewInbox => ({
  notices: [],
  evaluations: [],
  lastCheckedAt: null,
  bundleGeneratedAt: null,
});
export function evaluateConnections(
  previous: ConnectionReviewInbox,
  revisions: ResearchConnectionRevision[],
  views: ResearchConnectionView[],
  requestId: string,
  now: string,
  bundle: string | null,
) {
  const notices = new Map(previous.notices.map((n) => [n.connectionId, n]));
  let changedCount = 0;
  for (const revision of revisions) {
    const view = views.find((v) => v.revision.id === revision.id);
    const reasons = revision.removed ? [] : (view?.reviewReasons ?? []);
    const resolved = revision.removed || !reasons.length;
    const fingerprint = JSON.stringify([
      revision.version,
      revision.removed,
      view?.currentSource?.version ?? null,
      view?.currentSource?.sourceHash ?? null,
      view?.currentTarget?.binding ?? null,
      reasons,
    ]);
    const prior = notices.get(revision.id);
    if (!prior && resolved) continue;
    if (prior?.fingerprint === fingerprint) {
      notices.set(revision.id, {
        ...prior,
        checkedAt: now,
        bundleGeneratedAt: bundle,
      });
      continue;
    }
    changedCount++;
    notices.set(
      revision.id,
      ConnectionReviewNoticeSchema.parse({
        connectionId: revision.id,
        version: (prior?.version ?? 0) + 1,
        status: resolved ? 'resolved' : 'open',
        targetLabel: revision.target.label,
        fingerprint,
        reasons,
        checkedAt: now,
        acknowledgedAt: null,
        bundleGeneratedAt: bundle,
      }),
    );
  }
  const all = [...notices.values()];
  const active = all.filter((n) => n.status !== 'resolved');
  const resolved = all
    .filter((n) => n.status === 'resolved')
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, 200);
  const evaluation = {
    requestId,
    checkedAt: now,
    bundleGeneratedAt: bundle,
    changedCount,
  };
  const inbox = ConnectionReviewInboxSchema.parse({
    notices: [...active, ...resolved],
    evaluations: [evaluation, ...previous.evaluations].slice(0, 100),
    lastCheckedAt: now,
    bundleGeneratedAt: bundle,
  });
  return {
    inbox,
    receipt: ConnectionReviewReceiptSchema.parse({
      requestId,
      action: 'check',
      recordedAt: now,
      connectionId: null,
      noticeVersion: null,
      evaluation,
    }),
  };
}
