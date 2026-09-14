import {
  AllocationSnapshotSchema,
  AllocationReviewSchema,
  allocationState,
} from './allocations.js';
import { z } from 'zod';
import { SavedGoalSchema, goalProjection } from './goals.js';
import { HoldingsSnapshotSchema, holdingsTotal } from './holdings.js';
import {
  ConnectionSourceReceiptSchema,
  ConnectionTargetSchema,
  ResearchConnectionRevisionSchema,
  type ResearchConnectionView,
} from './research-connections.js';
export const ReportConnectionSelectionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});
const selections = z
  .array(ReportConnectionSelectionSchema)
  .min(1)
  .max(20)
  .refine(
    (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
    'Choose each connection once.',
  )
  .transform((rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id)));
export const ReportResearchReceiptSchema = z.strictObject({
  revision: ResearchConnectionRevisionSchema.refine(
    (r) => !r.removed,
    'Choose an active connection.',
  ),
  reviewReasons: z.array(z.string()).max(4),
  sourceAtCapture: ConnectionSourceReceiptSchema.nullable(),
  targetAtCapture: ConnectionTargetSchema.nullable(),
});
export const ReportResearchCaptureSchema = z.strictObject({
  evaluatedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
  receipts: z
    .array(ReportResearchReceiptSchema)
    .min(1)
    .max(20)
    .refine(
      (rows) => new Set(rows.map((r) => r.revision.id)).size === rows.length,
      'Duplicate connection receipt.',
    ),
});
export const ReportRequestSchema = z.strictObject({
  requestId: z.uuid(),
  label: z.string().trim().min(1).max(100),
  consent: z.literal(true),
  researchConnections: selections.optional(),
});
export const ReportSnapshotV1Schema = z.strictObject({
  capturedAt: z.iso.datetime(),
  goals: z.array(SavedGoalSchema).max(100),
  holdings: HoldingsSnapshotSchema,
  allocations: AllocationSnapshotSchema,
});
export const ReportSnapshotV2Schema = ReportSnapshotV1Schema.extend({
  researchConnections: ReportResearchCaptureSchema,
});
export const ReportSnapshotSchema = z.union([
  ReportSnapshotV1Schema,
  ReportSnapshotV2Schema,
]);
export const RecordReportV1Schema = z.strictObject({
  id: z.uuid(),
  label: z.string().max(100),
  issuedAt: z.iso.datetime(),
  policy: z.literal('saved-record-review-v1'),
  snapshot: ReportSnapshotV1Schema,
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
export const RecordReportV2Schema = RecordReportV1Schema.extend({
  policy: z.literal('saved-record-review-v2'),
  snapshot: ReportSnapshotV2Schema,
});
export const RecordReportSchema = z.discriminatedUnion('policy', [
  RecordReportV1Schema,
  RecordReportV2Schema,
]);
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
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type ReportConnectionSelection = z.infer<
  typeof ReportConnectionSelectionSchema
>;
export type ReportResearchCapture = z.infer<typeof ReportResearchCaptureSchema>;
export class ReportSelectionError extends Error {
  constructor(
    public status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
export function reportSelections(
  snapshot: ReportSnapshot,
): ReportConnectionSelection[] {
  return 'researchConnections' in snapshot
    ? snapshot.researchConnections.receipts
        .map(({ revision }) => ({ id: revision.id, version: revision.version }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];
}
export function captureReportResearch(
  selected: ReportConnectionSelection[],
  current: ResearchConnectionView[],
  evaluatedAt: string,
  bundleGeneratedAt: string | null,
): ReportResearchCapture {
  return ReportResearchCaptureSchema.parse({
    evaluatedAt,
    bundleGeneratedAt,
    receipts: [...selected]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((selection) => {
        const found = current.find(
          (row) => row.revision.id === selection.id && !row.revision.removed,
        );
        if (!found)
          throw new ReportSelectionError(
            404,
            'Selected connection is unavailable. Reload your owned connections.',
          );
        if (found.revision.version !== selection.version)
          throw new ReportSelectionError(
            409,
            'Selected connection changed. Reload and review its current revision.',
          );
        return {
          revision: found.revision,
          reviewReasons: found.reviewReasons,
          sourceAtCapture: found.currentSource,
          targetAtCapture: found.currentTarget,
        };
      }),
  });
}
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
    policy:
      'researchConnections' in snapshot
        ? 'saved-record-review-v2'
        : 'saved-record-review-v1',
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
      'researchConnections' in snapshot
        ? 'Financial records are user-entered and unverified. An issued review does not change when later records are edited.'
        : 'Sources are user-entered and unverified. An issued review does not change when later records are edited.',
      ...('researchConnections' in snapshot
        ? [
            'Research connections record your personal reasons, not verified impact or advice. Source and record review status was evaluated at capture; current status is unknown from this issued report.',
            'Only dated minimal source receipts are retained. Later source withdrawal or connection removal does not rewrite this private report. Delete the report to remove its copy.',
          ]
        : []),
    ],
  });
}
