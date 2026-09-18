import { z } from 'zod';
import {
  CorporateRatingEditionSchema,
  CorporateRatingObservationSchema,
  CORPORATE_RATINGS,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
} from './corporate-rating.js';
export const BondCreditReferenceSchema = z.strictObject({
  editionId: z.uuid(),
  isin: CorporateRatingObservationSchema.shape.isin,
});
export const BondEvidencePolicySchema = z
  .strictObject({
    version: z.literal('bond-evidence-policy-v1'),
    priceBasis: z.literal('user-entered-estimate'),
    evaluatedPrice: z.literal('not-supplied'),
    tradingLiquidity: z.literal('not-established'),
    recommendation: z.literal(false),
    assessmentOn: z.iso.date(),
    credit: z.union([
      z.strictObject({ status: z.literal('user-description-only') }),
      z.strictObject({
        status: z.literal('historical-original-attached'),
        editionId: z.uuid(),
        sourceUrl: z.literal(CORPORATE_RATING_SOURCE.url),
        sourceHash: z.literal(CORPORATE_RATING_SOURCE.hash),
        sourceVersion: z.literal(CORPORATE_RATING_VERSION),
        publishedOn: z.literal(CORPORATE_RATING_SOURCE.documentDate),
        annexureAsOf: z.literal('2026-03-31'),
        reviewedAt: z.iso.datetime(),
        admissionWindowDays: z.literal(90),
        observation: CorporateRatingObservationSchema,
      }),
    ]),
  })
  .superRefine((value, context) => {
    const { credit } = value;
    if (credit.status !== 'historical-original-attached') return;
    const canonical = CORPORATE_RATINGS.find(
      (observation) => observation.isin === credit.observation.isin,
    );
    if (
      !canonical ||
      JSON.stringify(credit.observation) !== JSON.stringify(canonical)
    )
      context.addIssue({
        code: 'custom',
        path: ['credit', 'observation'],
        message:
          'Attached credit observation must match the exact verified source row.',
      });
  });
export function bondEvidencePolicy(
  settlementOn: string,
  reference?: z.infer<typeof BondCreditReferenceSchema>,
  source?: unknown,
) {
  z.iso.date().parse(settlementOn);
  let credit: z.infer<typeof BondEvidencePolicySchema>['credit'] = {
    status: 'user-description-only',
  };
  if (reference) {
    const edition = CorporateRatingEditionSchema.parse(source),
      row = edition.observations.find((o) => o.isin === reference.isin);
    if (
      edition.id !== reference.editionId ||
      edition.state !== 'published' ||
      !edition.reviewedAt ||
      !row ||
      row.agencyStatus !== 'rated-in-original'
    )
      throw Error(
        'Selected credit original is missing, withdrawn or no longer admitted.',
      );
    const elapsed =
      (Date.parse(settlementOn) - Date.parse(edition.publishedOn)) / 86400000;
    if (elapsed < 0 || elapsed > 90 || settlementOn >= row.maturityOn)
      throw Error(
        'Credit evidence is outside the historical 90-day assessment window or instrument maturity.',
      );
    credit = {
      status: 'historical-original-attached',
      editionId: edition.id,
      sourceUrl: edition.sourceUrl,
      sourceHash: edition.hash,
      sourceVersion: edition.version,
      publishedOn: edition.publishedOn,
      annexureAsOf: edition.annexureAsOf,
      reviewedAt: edition.reviewedAt,
      admissionWindowDays: 90,
      observation: row,
    };
  }
  return BondEvidencePolicySchema.parse({
    version: 'bond-evidence-policy-v1',
    priceBasis: 'user-entered-estimate',
    evaluatedPrice: 'not-supplied',
    tradingLiquidity: 'not-established',
    recommendation: false,
    assessmentOn: settlementOn,
    credit,
  });
}
