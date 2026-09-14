import { z } from 'zod';

export const OIL_BENCHMARK_SOURCE = 'world-bank-oil-benchmarks' as const;
export const OIL_BENCHMARK_URL =
  'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx';
export const OIL_BENCHMARK_HOME =
  'https://www.worldbank.org/en/research/commodity-markets';
export const OIL_BENCHMARK_TERMS =
  'https://www.worldbank.org/ext/en/legal/terms-conditions/datasets';
export const OIL_BENCHMARK_START = '2000-01';
export const OIL_BENCHMARK_PARSER = 'world-bank-pink-sheet-oil-v1' as const;
export const OIL_BENCHMARK_SERIES = ['BRENT', 'WTI'] as const;
export const OIL_BENCHMARK_ATTRIBUTION =
  'World Bank: Commodity Prices — History and Projections (Pink Sheet): Bloomberg Finance L.P.; Energy Intelligence Group; OPEC; World Bank.';
export const OIL_BENCHMARK_LICENSE =
  'https://creativecommons.org/licenses/by/4.0/';
export const OIL_BENCHMARK_CATALOGUE =
  'https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections';
export const oilBenchmarkNames = {
  BRENT: 'Brent',
  WTI: 'West Texas Intermediate (WTI)',
} as const;
export const OilBenchmarkSeriesSchema = z.enum(OIL_BENCHMARK_SERIES);
export type OilBenchmarkSeries = z.infer<typeof OilBenchmarkSeriesSchema>;
export const OilBenchmarkValueSchema = z
  .string()
  .regex(/^-?(0|[1-9][0-9]{0,11})\.[0-9]$/)
  .refine((value) => value !== '-0.0');
/** Preserve lexical source evidence; integer arithmetic applies the observed 0.0 display format. */
export function roundOilSource(value: string) {
  const match =
    /^(-?)(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,20}))?(?:[Ee]([+-]?[0-9]{1,2}))?$/.exec(
      value,
    );
  if (!match) throw Error('Unsupported oil decimal.');
  const fraction = match[3] ?? '',
    exponent = Number(match[4] ?? '0');
  if (Math.abs(exponent) > 20) throw Error('Oil exponent exceeds its bound.');
  let magnitude = BigInt(match[2]! + fraction);
  const shift = exponent + 1 - fraction.length;
  if (shift >= 0) magnitude *= 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    magnitude = (magnitude + divisor / 2n) / divisor;
  }
  return OilBenchmarkValueSchema.parse(
    `${match[1] && magnitude !== 0n ? '-' : ''}${magnitude / 10n}.${magnitude % 10n}`,
  );
}
/** Canonical database values have the workbook's explicit one-decimal precision. */
export function canonicalOilBenchmark(value: string) {
  const match = /^(-?)(0|[1-9][0-9]{0,11})(?:\.([0-9]+))?$/.exec(value);
  if (!match || (match[3] ?? '').slice(1).replace(/0/g, ''))
    throw Error('Invalid stored oil precision.');
  const result = `${match[1]}${match[2]}.${(match[3] ?? '0')[0]}`;
  return result === '-0.0' ? '0.0' : result;
}
export const OilBenchmarkPeriodSchema = z
  .string()
  .regex(/^(20[0-9]{2})-(0[1-9]|1[0-2])$/);
export const OilBenchmarkObservationSchema = z
  .strictObject({
    series: OilBenchmarkSeriesSchema,
    period: OilBenchmarkPeriodSchema,
    value: OilBenchmarkValueSchema.nullable(),
    sourceValue: z
      .string()
      .regex(
        /^-?(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,20})?(?:[Ee][+-]?[0-9]{1,2})?$/,
      )
      .nullable(),
  })
  .superRefine((row, ctx) => {
    try {
      if (
        (row.value === null) !== (row.sourceValue === null) ||
        (row.sourceValue !== null &&
          roundOilSource(row.sourceValue) !== row.value)
      )
        throw Error();
    } catch {
      ctx.addIssue({
        code: 'custom',
        message:
          'Oil value must reconcile to its lexical source and displayed precision.',
      });
    }
  });
export const OilBenchmarkObservationsSchema = z
  .array(OilBenchmarkObservationSchema)
  .min(2)
  .max(2400)
  .superRefine((rows, ctx) => {
    const keys = rows.map((row) => `${row.series}/${row.period}`);
    const periods = [...new Set(rows.map((row) => row.period))].sort();
    let expected = '2000-01';
    const validPeriods = periods.every((period) => {
      const same = period === expected;
      const year = Number(expected.slice(0, 4)),
        month = Number(expected.slice(5));
      expected =
        month === 12
          ? `${year + 1}-01`
          : `${year}-${String(month + 1).padStart(2, '0')}`;
      return same;
    });
    if (
      new Set(keys).size !== keys.length ||
      rows.length !== periods.length * 2 ||
      !validPeriods ||
      OIL_BENCHMARK_SERIES.some(
        (series) =>
          rows.filter((row) => row.series === series).length !== periods.length,
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Both fixed benchmarks require a contiguous monthly grid starting January 2000.',
      });
  });
export const OilBenchmarkEditionSchema = z
  .strictObject({
    edition: z.number().int().positive(),
    parserVersion: z.literal(OIL_BENCHMARK_PARSER),
    sourceId: z.literal(OIL_BENCHMARK_SOURCE),
    sourceUrl: z.literal(OIL_BENCHMARK_URL),
    retrievedAt: z.iso.datetime(),
    reportedUpdatedOn: z.iso.date(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    unit: z.literal('USD-per-barrel'),
    region: z.literal('global-benchmarks'),
    knownAt: z.null(),
    vintageBasis: z.literal('retrieval-revision-only'),
    precision: z.literal(1),
    transformation: z.literal('workbook-display-half-away-from-zero'),
    observations: OilBenchmarkObservationsSchema,
  })
  .superRefine((edition, ctx) => {
    if (
      edition.reportedUpdatedOn > edition.retrievedAt.slice(0, 10) ||
      edition.observations.some(
        (row) => row.period >= edition.reportedUpdatedOn.slice(0, 7),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Oil periods must be completed before the reported update date, which cannot follow retrieval.',
      });
  });
export type OilBenchmarkEdition = z.infer<typeof OilBenchmarkEditionSchema>;
export const OilBenchmarkRefreshSchema = z.strictObject({
  requestId: z.uuid(),
});
export const OilBenchmarkReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
});
export const OilBenchmarkReviewReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  sourceId: z.literal(OIL_BENCHMARK_SOURCE),
  headVersion: z.number().int().positive(),
  edition: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
  reviewedAt: z.iso.datetime(),
});
export const OilBenchmarkRunSchema = z
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
    observationCount: z.number().int().min(0).max(2400),
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
          run.observationCount < 2 ||
          !['changed', 'unchanged'].includes(run.category)))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Run outcome does not reconcile.',
      });
  });
export type OilBenchmarkRun = z.infer<typeof OilBenchmarkRunSchema>;
export const OilBenchmarkHeadSchema = z
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
        message: 'Oil source head does not reconcile.',
      });
  });
export const OilBenchmarkOperationsSchema = z
  .strictObject({
    head: OilBenchmarkHeadSchema,
    latest: OilBenchmarkEditionSchema.nullable(),
    latestRun: OilBenchmarkRunSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.head.latestEdition !== (value.latest?.edition ?? null))
      ctx.addIssue({
        code: 'custom',
        message: 'Latest numerical edition does not match its source head.',
      });
  });
export const OilBenchmarkPublicSchema = z
  .strictObject({
    status: z.enum(['never-published', 'published', 'withdrawn']),
    edition: OilBenchmarkEditionSchema.nullable(),
    checkedAt: z.iso.datetime().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    evaluatedAt: z.iso.datetime(),
    evaluatedOn: z.iso.date(),
    timeZone: z.literal('UTC'),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'published') !== (value.edition !== null))
      ctx.addIssue({
        code: 'custom',
        message: 'Only a published source may expose oil data.',
      });
  });
export type OilBenchmarkPublic = z.infer<typeof OilBenchmarkPublicSchema>;
export const OilBenchmarkHistorySchema = z.strictObject({
  editions: z.array(OilBenchmarkEditionSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const OilBenchmarkRunsSchema = z.strictObject({
  runs: z.array(OilBenchmarkRunSchema).max(50),
  moreAvailable: z.boolean(),
});
export const OilBenchmarkReviewsSchema = z.strictObject({
  reviews: z.array(OilBenchmarkReviewReceiptSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const OilBenchmarkEvidenceSchema = z.strictObject({
  scope: z.literal('reviewed-numerical-edition'),
  edition: OilBenchmarkEditionSchema,
});
export const OilBenchmarkRetainedSchema = z.strictObject({
  scope: z.literal('operator-retained-original'),
  requestId: z.uuid(),
  sourceUrl: z.literal(OIL_BENCHMARK_URL),
  retrievedAt: z.iso.datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  encoding: z.literal('base64'),
  body: z
    .string()
    .min(4)
    .max(4000000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
export function oilEvaluationDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function oilBenchmarkTimeline(
  edition: OilBenchmarkEdition,
  evaluatedOn: string,
) {
  z.iso.date().parse(evaluatedOn);
  return OIL_BENCHMARK_SERIES.map((series) => {
    const history = edition.observations
      .filter((row) => row.series === series)
      .sort((a, b) => b.period.localeCompare(a.period));
    return {
      series,
      current:
        history.find((row) => row.period < evaluatedOn.slice(0, 7)) ?? null,
      upcoming: history
        .filter((row) => row.period >= evaluatedOn.slice(0, 7))
        .reverse(),
      history,
    };
  });
}
