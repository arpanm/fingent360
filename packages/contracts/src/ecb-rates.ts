import { z } from 'zod';

export const ECB_RATE_SOURCE = 'ecb-policy-rates' as const;
export const ECB_RATE_URL =
  'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR+MRR_FR+MLFR.LEV?startPeriod=2008-10-15&detail=dataonly&includeHistory=false';
export const ECB_RATE_HOME =
  'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html';
export const ECB_RATE_TERMS =
  'https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html';
export const ECB_RATE_START = '2008-10-15';
export const ECB_RATE_PARSER = 'ecb-sdmx-policy-rates-v1' as const;
export const ECB_RATE_SERIES = ['DFR', 'MRR_FR', 'MLFR'] as const;
export const ecbRateNames = {
  DFR: 'Deposit facility',
  MRR_FR: 'Main refinancing operations — fixed rate',
  MLFR: 'Marginal lending facility',
} as const;
export const EcbRateSeriesSchema = z.enum(ECB_RATE_SERIES);
export type EcbRateSeries = z.infer<typeof EcbRateSeriesSchema>;
export const EcbRateValueSchema = z
  .string()
  .regex(/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,7})?$/)
  .refine((value) => value !== '-0', 'Use canonical zero.');
export function canonicalEcbRate(value: string) {
  if (!/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,7})?$/.test(value))
    throw Error('Unsupported exact rate value.');
  const normalized = value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;
  return normalized === '-0' ? '0' : normalized;
}
export const EcbRateObservationSchema = z.strictObject({
  series: EcbRateSeriesSchema,
  effectiveOn: z.iso
    .date()
    .refine((value) => value >= ECB_RATE_START && value <= '2200-12-31'),
  value: EcbRateValueSchema,
});
export const EcbRateObservationsSchema = z
  .array(EcbRateObservationSchema)
  .min(3)
  .max(1500)
  .superRefine((rows, ctx) => {
    const keys = rows.map((row) => `${row.series}/${row.effectiveOn}`);
    if (
      new Set(keys).size !== keys.length ||
      ECB_RATE_SERIES.some(
        (series) =>
          !rows.some((row) => row.series === series) ||
          rows.filter((row) => row.series === series).length > 500,
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Every fixed series must occur with unique effective dates.',
      });
    if (rows.some((row) => canonicalEcbRate(row.value) !== row.value))
      ctx.addIssue({
        code: 'custom',
        message: 'Rate values must use canonical exact decimals.',
      });
  });
export const EcbRateEditionSchema = z.strictObject({
  edition: z.number().int().positive(),
  parserVersion: z.literal(ECB_RATE_PARSER),
  sourceId: z.literal(ECB_RATE_SOURCE),
  sourceUrl: z.literal(ECB_RATE_URL),
  retrievedAt: z.iso.datetime(),
  responsePreparedAt: z.iso.datetime().nullable(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  unit: z.literal('percent-per-annum'),
  region: z.literal('euro-area'),
  knownAt: z.null(),
  vintageBasis: z.literal('retrieval-revision-only'),
  observations: EcbRateObservationsSchema,
});
export type EcbRateEdition = z.infer<typeof EcbRateEditionSchema>;
export const EcbRateRefreshSchema = z.strictObject({ requestId: z.uuid() });
export const EcbRateReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
});
export const EcbRateReviewReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  sourceId: z.literal(ECB_RATE_SOURCE),
  headVersion: z.number().int().positive(),
  edition: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
  reviewedAt: z.iso.datetime(),
});
export const EcbRateRunSchema = z
  .strictObject({
    requestId: z.uuid(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    status: z.enum(['running', 'succeeded', 'failed']),
    category: z.enum([
      'pending',
      'changed',
      'unchanged',
      'fetch',
      'parse',
      'storage',
      'interrupted',
    ]),
    edition: z.number().int().positive().nullable(),
    sourceHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    observationCount: z.number().int().min(0).max(1500),
  })
  .superRefine((run, ctx) => {
    if (
      (run.status === 'running') !== (run.finishedAt === null) ||
      (run.finishedAt !== null &&
        Date.parse(run.finishedAt) < Date.parse(run.startedAt)) ||
      (run.status === 'running' &&
        (run.category !== 'pending' ||
          run.edition !== null ||
          run.sourceHash !== null ||
          run.observationCount !== 0)) ||
      (run.status === 'failed' &&
        (!['fetch', 'parse', 'storage', 'interrupted'].includes(run.category) ||
          run.edition !== null ||
          run.observationCount !== 0)) ||
      (run.status === 'succeeded' &&
        (!run.edition ||
          !run.sourceHash ||
          run.observationCount < 3 ||
          !['changed', 'unchanged'].includes(run.category)))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Run outcome does not reconcile.',
      });
  });
export type EcbRateRun = z.infer<typeof EcbRateRunSchema>;
export const EcbRateHeadSchema = z
  .strictObject({
    version: z.number().int().nonnegative(),
    status: z.enum(['draft', 'published', 'withdrawn']),
    latestEdition: z.number().int().positive().nullable(),
    publishedEdition: z.number().int().positive().nullable(),
    checkedAt: z.iso.datetime().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((head, ctx) => {
    if (
      (head.status === 'draft') !== (head.publishedEdition === null) ||
      (head.publishedEdition !== null &&
        (head.latestEdition === null ||
          head.publishedEdition > head.latestEdition)) ||
      (head.status !== 'draft' && !head.reviewedAt) ||
      (head.latestEdition === null &&
        (head.version !== 0 || head.checkedAt !== null))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Rate source head does not reconcile.',
      });
  });
export const EcbRateOperationsSchema = z
  .strictObject({
    head: EcbRateHeadSchema,
    latest: EcbRateEditionSchema.nullable(),
    latestRun: EcbRateRunSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.head.latestEdition !== (value.latest?.edition ?? null))
      ctx.addIssue({
        code: 'custom',
        message: 'Latest numerical edition does not match its source head.',
      });
  });
export const EcbRatePublicSchema = z
  .strictObject({
    status: z.enum(['never-published', 'published', 'withdrawn']),
    edition: EcbRateEditionSchema.nullable(),
    checkedAt: z.iso.datetime().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    evaluatedAt: z.iso.datetime(),
    evaluatedOn: z.iso.date(),
    timeZone: z.literal('Europe/Berlin'),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'published') !== (value.edition !== null))
      ctx.addIssue({
        code: 'custom',
        message: 'Only a published source may expose rate data.',
      });
  });
export type EcbRatePublic = z.infer<typeof EcbRatePublicSchema>;
export const EcbRateHistorySchema = z.strictObject({
  editions: z.array(EcbRateEditionSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EcbRateRunsSchema = z.strictObject({
  runs: z.array(EcbRateRunSchema).max(50),
  moreAvailable: z.boolean(),
});
export const EcbRateReviewsSchema = z.strictObject({
  reviews: z.array(EcbRateReviewReceiptSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EcbRateEvidenceSchema = z.strictObject({
  scope: z.literal('reviewed-numerical-edition'),
  edition: EcbRateEditionSchema,
});
export const EcbRateRetainedSchema = z.strictObject({
  scope: z.literal('operator-retained-original'),
  requestId: z.uuid(),
  sourceUrl: z.literal(ECB_RATE_URL),
  retrievedAt: z.iso.datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  body: z.string().max(1000000),
});
export function ecbEvaluationDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function ecbRateTimeline(edition: EcbRateEdition, evaluatedOn: string) {
  z.iso.date().parse(evaluatedOn);
  return ECB_RATE_SERIES.map((series) => {
    const history = edition.observations
      .filter((row) => row.series === series)
      .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn));
    return {
      series,
      current: history.find((row) => row.effectiveOn <= evaluatedOn) ?? null,
      upcoming: history
        .filter((row) => row.effectiveOn > evaluatedOn)
        .reverse(),
      history,
    };
  });
}
