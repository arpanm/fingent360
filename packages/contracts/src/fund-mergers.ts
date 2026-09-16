import { z } from 'zod';
import { FundNavSchema } from './funds-bonds.js';
export const HDFC_MERGER_URL =
  'https://files.hdfcfund.com/s3fs-public/2021-12/1859%20-%20Notice-cum-Addendum%20-%20Scheme%20Merger%20Proposal.pdf';
export const MERGING_SCHEMES = [
  'HDFC Long Term Advantage Fund',
  'HDFC EOF - II - 1126D May 2017 (1)',
  'HDFC EOF - II - 1100D June 2017 (1)',
] as const;
export const FundMergerTermsSchema = z
  .strictObject({
    sourceUrl: z.literal(HDFC_MERGER_URL),
    noticeDate: z.literal('2021-12-09'),
    from: z.enum(MERGING_SCHEMES),
    to: z.literal('HDFC Large and Mid Cap Fund'),
    effectiveOn: z.enum(['2022-01-14', '2022-01-20']),
    effectivePrecision: z.literal('close-of-business-day'),
    extraction: z.literal('manual-original-review-v1'),
    executionConfirmed: z.literal(false),
    conversionRatio: z.null(),
    unitAllocation: z.literal('not-established'),
    navSeriesContinuity: z.literal('not-established'),
    portfolioMutation: z.literal(false),
  })
  .superRefine((v, c) => {
    if (
      v.effectiveOn !==
      (v.from === MERGING_SCHEMES[2] ? '2022-01-20' : '2022-01-14')
    )
      c.addIssue({
        code: 'custom',
        message: 'Effective date differs from this fixed original notice.',
      });
  });
export function fundMergerTerms(from: (typeof MERGING_SCHEMES)[number]) {
  return FundMergerTermsSchema.parse({
    sourceUrl: HDFC_MERGER_URL,
    noticeDate: '2021-12-09',
    from,
    to: 'HDFC Large and Mid Cap Fund',
    effectiveOn: from === MERGING_SCHEMES[2] ? '2022-01-20' : '2022-01-14',
    effectivePrecision: 'close-of-business-day',
    extraction: 'manual-original-review-v1',
    executionConfirmed: false,
    conversionRatio: null,
    unitAllocation: 'not-established',
    navSeriesContinuity: 'not-established',
    portfolioMutation: false,
  });
}
export const FundMergerCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  from: z.enum(MERGING_SCHEMES),
  body: z.string().min(8).max(2100000),
  permissionReference: z.string().trim().min(10).max(2000),
  originalConfirmed: z.literal(true),
});
const binding = z.strictObject({
  editionId: z.uuid(),
  observation: FundNavSchema,
});
export const FundMergerReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  fromCode: z
    .string()
    .regex(/^\d{5,8}$/)
    .optional(),
  toCode: z
    .string()
    .regex(/^\d{5,8}$/)
    .optional(),
  reason: z.string().trim().min(20).max(2000),
  originalAndPlansChecked: z.boolean(),
});
export const FundMergerEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  recordedAt: z.iso.datetime(),
  retrievedAt: z.null(),
  terms: FundMergerTermsSchema,
  error: z.string().nullable(),
  state: z.enum(['draft', 'quarantined', 'published', 'withdrawn']),
  mapping: z
    .strictObject({
      from: binding,
      to: binding,
      planRelationship: z.literal('independently-reviewed-no-conversion-ratio'),
    })
    .nullable(),
  reviewedAt: z.iso.datetime().nullable(),
});
export const FundMergerListSchema = z.strictObject({
  editions: z.array(FundMergerEditionSchema).max(25),
  nextCursor: z.string().nullable(),
});
export const FundMergerSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  editions: z.array(FundMergerEditionSchema).max(100),
});
