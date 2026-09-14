import { z } from 'zod';
import { FeedItemSchema } from './discovery.js';
const Count = z.number().int().nonnegative().max(1000);
export const RequestMetricsSchema = z.strictObject({
  observedSince: z.iso.datetime(),
  scope: z.literal('this-api-process'),
  completed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  disconnected: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  serverErrors: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  under100ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  under1000ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  slow: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const QualityOverviewSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  inspected: Count,
  moreAvailable: z.boolean(),
  valid: Count,
  invalid: Count,
  missingHead: Count,
  published: Count,
  drafts: Count,
  withdrawn: Count,
  missingEvidence: Count,
  unreviewedPublication: Count,
  futureRetrieval: Count,
  oldNewsRetrieval: Count,
  newsRetrievalBudgetHours: z.literal(168),
  recentRuns: z
    .array(
      z.strictObject({
        startedAt: z.iso.datetime(),
        finishedAt: z.iso.datetime().nullable(),
        status: z.enum(['running', 'succeeded', 'failed']),
      }),
    )
    .max(20),
});
export type QualityOverview = z.infer<typeof QualityOverviewSchema>;
export function summarizeQuality(
  heads: { id: string; version: number; data: unknown | null }[],
  observedAt: string,
  recentRuns: QualityOverview['recentRuns'],
): QualityOverview {
  const result: QualityOverview = {
    observedAt,
    inspected: Math.min(heads.length, 1000),
    moreAvailable: heads.length > 1000,
    valid: 0,
    invalid: 0,
    missingHead: 0,
    published: 0,
    drafts: 0,
    withdrawn: 0,
    missingEvidence: 0,
    unreviewedPublication: 0,
    futureRetrieval: 0,
    oldNewsRetrieval: 0,
    newsRetrievalBudgetHours: 168,
    recentRuns,
  };
  for (const head of heads.slice(0, 1000)) {
    if (head.data === null) {
      result.missingHead++;
      continue;
    }
    const parsed = FeedItemSchema.safeParse(head.data);
    if (
      !parsed.success ||
      parsed.data.id !== head.id ||
      parsed.data.version !== head.version
    ) {
      result.invalid++;
      continue;
    }
    result.valid++;
    const item = parsed.data;
    if (item.status === 'draft') result.drafts++;
    if (item.status === 'withdrawn') result.withdrawn++;
    if (item.status !== 'published') continue;
    result.published++;
    if (!item.reviewedAt) result.unreviewedPublication++;
    if (item.kind !== 'term' && !item.sourceHash) result.missingEvidence++;
    const age = Date.parse(observedAt) - Date.parse(item.source.retrievedAt);
    if (age < 0) result.futureRetrieval++;
    if (item.kind === 'news' && age > 168 * 60 * 60 * 1000)
      result.oldNewsRetrieval++;
  }
  return QualityOverviewSchema.parse(result);
}

export const OperationalQualitySchema = QualityOverviewSchema.extend({
  requests: RequestMetricsSchema,
});
export type OperationalQuality = z.infer<typeof OperationalQualitySchema>;
