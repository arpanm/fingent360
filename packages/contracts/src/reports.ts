import {
  AllocationSnapshotSchema,
  AllocationReviewSchema,
  allocationState,
} from './allocations.js';
import { z } from 'zod';
import { SavedGoalSchema, goalProjection } from './goals.js';
import { HoldingsSnapshotSchema, holdingsTotal } from './holdings.js';
export const ReportRequestSchema = z.strictObject({
  requestId: z.uuid(),
  label: z.string().trim().min(1).max(100),
  consent: z.literal(true),
});
export const ReportSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  goals: z.array(SavedGoalSchema).max(100),
  holdings: HoldingsSnapshotSchema,
  allocations: AllocationSnapshotSchema,
});
export const RecordReportSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().max(100),
  issuedAt: z.iso.datetime(),
  policy: z.literal('saved-record-review-v1'),
  snapshot: ReportSnapshotSchema,
  goalReviews: z
    .array(
      z.strictObject({
        goalId: z.uuid(),
        goalVersion: z.number().int().positive(),
        name: z.string(),
        targetMinor: z.string(),
        savedMinor: z.string(),
        monthlyMinor: z.string(),
        horizonMonths: z.number().int(),
        projectedMinor: z.string(),
        gapMinor: z.string(),
      }),
    )
    .max(100),
  allocationReview: z.array(AllocationReviewSchema),
  allocationsRequireReview: z.boolean(),
  recordedHoldingsCostMinor: z.string().regex(/^\d+$/),
  currency: z.literal('INR'),
  scale: z.literal(2),
  caveats: z.array(z.string()),
});
export const ReportJobSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().max(100),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  version: z.number().int().positive(),
  requestedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  attempts: z.number().int().min(0).max(3),
  nextAttemptAt: z.iso.datetime().nullable(),
  message: z.string().max(1000),
  snapshot: ReportSnapshotSchema,
  report: RecordReportSchema.nullable(),
});
export const ReportDeletionSchema = z.strictObject({
  id: z.uuid(),
  deletedAt: z.iso.datetime(),
});
export const ReportDeleteInputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  confirm: z.literal(true),
});
export const ReportCapacitySchema = z.strictObject({
  used: z.number().int().min(0).max(100),
  limit: z.literal(100),
});
export const ReportJobsSchema = z.strictObject({
  jobs: z.array(ReportJobSchema).max(100),
  deletions: z.array(ReportDeletionSchema),
  capacity: ReportCapacitySchema,
});
export const ReportMutationSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});
export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;
export type ReportJob = z.infer<typeof ReportJobSchema>;
export type RecordReport = z.infer<typeof RecordReportSchema>;
export function issueRecordReport(
  id: string,
  label: string,
  input: ReportSnapshot,
  issuedAt: string,
): RecordReport {
  const snapshot = ReportSnapshotSchema.parse(input);
  return RecordReportSchema.parse({
    id,
    label,
    issuedAt,
    policy: 'saved-record-review-v1',
    snapshot,
    goalReviews: snapshot.goals.map((goal) => ({
      goalId: goal.id,
      goalVersion: goal.version,
      name: goal.name,
      targetMinor: goal.targetMinor,
      savedMinor: goal.savedMinor,
      monthlyMinor: goal.monthlyMinor,
      horizonMonths: goal.horizonMonths,
      ...goalProjection(goal),
    })),
    allocationReview: allocationState(
      snapshot.allocations,
      snapshot.holdings,
      snapshot.goals,
    ).review,
    allocationsRequireReview: allocationState(
      snapshot.allocations,
      snapshot.holdings,
      snapshot.goals,
    ).requiresReview,
    recordedHoldingsCostMinor: holdingsTotal(snapshot.holdings.holdings),
    currency: 'INR',
    scale: 2,
    caveats: [
      'This reviews your saved records, not their market value or a recommendation.',
      'Goal projections add entered savings and contributions only. No growth, tax, fee, inflation or withdrawal is assumed.',
      'Recorded holdings cost is not available cash or market value. Do not add the same money to multiple goals or count holdings allocations again as entered savings.',
      'Sources are user-entered and unverified. An issued review does not change when later records are edited.',
    ],
  });
}
