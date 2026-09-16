import { z } from 'zod';
export const CORPORATE_RATING_SOURCE = {
  kind: 'rating' as const,
  url: 'https://www.icra.in/Rating/GetRationalReportFilePdf?id=142975',
  mime: 'application/pdf' as const,
  documentDate: '2026-05-13',
  dateBasis: 'publication' as const,
  hash: 'b9a969e1cb24dbbcb65270adc3a16b82aa2c548234f84d3f0ec187b566205910',
};
export const CORPORATE_RATING_VERSION =
  'icra-hudco-142975-annexure-v1' as const;
export const CorporateRatingObservationSchema = z.strictObject({
  isin: z.enum(['INE031A08939', 'INE031A08848', 'INE031A08855']),
  issuer: z.literal('Housing and Urban Development Corporation Ltd.'),
  agency: z.literal('ICRA'),
  instrument: z.literal('Taxable bond'),
  couponPercent: z.enum(['7.29', '5.62', '7.54']),
  maturityOn: z.iso.date(),
  rating: z.literal('[ICRA]AAA'),
  outlook: z.literal('Stable'),
  agencyStatus: z.enum(['rated-in-original', 'withdrawn-by-agency']),
  annexureAsOf: z.literal('2026-03-31'),
  publishedOn: z.literal('2026-05-13'),
  marketPrice: z.null(),
  tradingLiquidity: z.literal('not-established'),
  defaultClaim: z.literal(false),
});
export const CORPORATE_RATINGS = [
  ['INE031A08939', '7.29', '2035-02-12', 'rated-in-original'],
  ['INE031A08848', '5.62', '2025-05-25', 'withdrawn-by-agency'],
  ['INE031A08855', '7.54', '2026-02-11', 'withdrawn-by-agency'],
].map(([isin, couponPercent, maturityOn, agencyStatus]) =>
  CorporateRatingObservationSchema.parse({
    isin,
    couponPercent,
    maturityOn,
    agencyStatus,
    issuer: 'Housing and Urban Development Corporation Ltd.',
    agency: 'ICRA',
    instrument: 'Taxable bond',
    rating: '[ICRA]AAA',
    outlook: 'Stable',
    annexureAsOf: '2026-03-31',
    publishedOn: '2026-05-13',
    marketPrice: null,
    tradingLiquidity: 'not-established',
    defaultClaim: false,
  }),
);
export const CorporateRatingCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  body: z.string().min(8).max(2800000),
  permissionReference: z.string().trim().min(10).max(2000),
  originalConfirmed: z.literal(true),
});
export const CorporateRatingEditionSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.literal(CORPORATE_RATING_VERSION),
    sourceUrl: z.literal(CORPORATE_RATING_SOURCE.url),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    recordedAt: z.iso.datetime(),
    retrievedAt: z.null(),
    publishedOn: z.literal('2026-05-13'),
    annexureAsOf: z.literal('2026-03-31'),
    observations: z.array(CorporateRatingObservationSchema).max(3),
    state: z.enum(['draft', 'quarantined', 'published', 'withdrawn']),
    error: z.string().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((v, c) => {
    if (
      v.state === 'published' &&
      (v.hash !== CORPORATE_RATING_SOURCE.hash ||
        JSON.stringify(v.observations) !== JSON.stringify(CORPORATE_RATINGS))
    )
      c.addIssue({
        code: 'custom',
        message:
          'Published rating must match the verified original transcription.',
      });
  });
export const CorporateRatingListSchema = z.strictObject({
  editions: z.array(CorporateRatingEditionSchema).max(25),
  nextCursor: z.string().nullable(),
});
export const CorporateRatingSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  editions: z.array(CorporateRatingEditionSchema).max(100),
});
export const CorporateRatingReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
  originalChecked: z.boolean(),
  version: z.literal(CORPORATE_RATING_VERSION),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
});
