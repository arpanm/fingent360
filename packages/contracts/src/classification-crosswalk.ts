import { z } from 'zod';
import { EquityCompanySchema } from './equity-coverage.js';
export const ClassificationCrosswalkDraftSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  isin: EquityCompanySchema.shape.isin,
  editionId: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  providerLabel: z.string().trim().min(1).max(240),
  effectiveOn: z.iso.date(),
  applicationSector: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(20).max(2000),
  reviewBy: z.iso.date(),
});
export const ClassificationCrosswalkRevisionSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    recordedAt: z.iso.datetime(),
    input: ClassificationCrosswalkDraftSchema,
    source: EquityCompanySchema.shape.records.element,
  })
  .superRefine((r, ctx) => {
    const o = r.source.observation;
    if (
      r.version !== r.input.expectedVersion + 1 ||
      r.source.editionId !== r.input.editionId ||
      r.source.hash !== r.input.hash ||
      o.kind !== 'classification' ||
      o.isin !== r.input.isin ||
      o.sector !== r.input.providerLabel ||
      o.effectiveOn !== r.input.effectiveOn ||
      r.input.reviewBy < r.recordedAt.slice(0, 10)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Crosswalk must bind its exact admitted classification observation.',
      });
  });
export const ClassificationCrosswalkReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(10).max(1000),
});
export const ClassificationCrosswalkListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        revision: ClassificationCrosswalkRevisionSchema,
        state: z.enum(['draft', 'published', 'withdrawn', 'unavailable']),
        reviewReasons: z.array(z.string()),
      }),
    )
    .max(100),
  next: z.uuid().nullable(),
});
export const ClassificationCrosswalkHistorySchema = z.strictObject({
  versions: z.array(ClassificationCrosswalkRevisionSchema).max(100),
  reviews: z
    .array(
      z.strictObject({
        version: z.number().int(),
        decision: z.enum(['publish', 'withdraw']),
        reason: z.string(),
        reviewedAt: z.iso.datetime(),
      }),
    )
    .max(100),
});
export const ClassificationCrosswalkPublicSchema = z.strictObject({
  isin: EquityCompanySchema.shape.isin,
  evaluatedAt: z.iso.datetime(),
  mappings: z.array(ClassificationCrosswalkRevisionSchema).max(100),
  conflict: z.boolean(),
});
export type ClassificationCrosswalkRevision = z.infer<
  typeof ClassificationCrosswalkRevisionSchema
>;
export const ClassificationCrosswalkSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  companies: z.array(ClassificationCrosswalkPublicSchema).max(1000),
});
