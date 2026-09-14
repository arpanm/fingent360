import { z } from 'zod';

export const ECB_FX_SOURCE = 'ecb-reference-fx' as const;
export const ECB_FX_URL =
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
export const ECB_FX_HOME =
  'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';
export const ECB_FX_TERMS =
  'https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html';
export const ECB_FX_PARSER = 'ecb-eurofxref-90d-v1' as const;
export const ECB_FX_METHOD = 'f360-inr-per-usd-v1' as const;
export const EcbFxSourceValueSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,8})?$/)
  .refine((value) => /[1-9]/.test(value), 'Reference inputs must be positive.');
const DateOnly = z.iso
  .date()
  .refine((value) => value >= '1999-01-04' && value <= '2200-12-31');
const Integer = z.string().regex(/^[1-9][0-9]{0,31}$/);
export const EcbFxDerivedSchema = z.strictObject({
  value: z.string().regex(/^(0|[1-9][0-9]{0,20})\.[0-9]{8}$/),
  numerator: Integer,
  denominator: Integer,
  precision: z.literal(8),
  rounding: z.literal('half-away-from-zero'),
  methodVersion: z.literal(ECB_FX_METHOD),
});
export function deriveEcbFx(usdPerEur: string, inrPerEur: string) {
  EcbFxSourceValueSchema.parse(usdPerEur);
  EcbFxSourceValueSchema.parse(inrPerEur);
  const fraction = (value: string) => ({
    integer: BigInt(value.replace('.', '')),
    scale: (value.split('.')[1] ?? '').length,
  });
  const usd = fraction(usdPerEur),
    inr = fraction(inrPerEur);
  let numerator = inr.integer * 10n ** BigInt(usd.scale),
    denominator = usd.integer * 10n ** BigInt(inr.scale);
  let a = numerator,
    b = denominator;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  numerator /= a;
  denominator /= a;
  const scaled = numerator * 100000000n;
  const rounded = (scaled * 2n + denominator) / (denominator * 2n);
  return EcbFxDerivedSchema.parse({
    value: `${rounded / 100000000n}.${String(rounded % 100000000n).padStart(8, '0')}`,
    numerator: numerator.toString(),
    denominator: denominator.toString(),
    precision: 8,
    rounding: 'half-away-from-zero',
    methodVersion: ECB_FX_METHOD,
  });
}
export const EcbFxObservationSchema = z
  .strictObject({
    date: DateOnly,
    usdPerEur: EcbFxSourceValueSchema,
    inrPerEur: EcbFxSourceValueSchema,
    derivedInrPerUsd: EcbFxDerivedSchema,
  })
  .superRefine((row, ctx) => {
    if (
      !EcbFxSourceValueSchema.safeParse(row.usdPerEur).success ||
      !EcbFxSourceValueSchema.safeParse(row.inrPerEur).success
    )
      return;
    if (
      JSON.stringify(row.derivedInrPerUsd) !==
      JSON.stringify(deriveEcbFx(row.usdPerEur, row.inrPerEur))
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'The derived INR/USD must reconstruct from these unchanged same-day source inputs.',
      });
  });
export const EcbFxObservationsSchema = z
  .array(EcbFxObservationSchema)
  .min(1)
  .max(92)
  .superRefine((rows, ctx) => {
    const dates = rows.map((row) => row.date).sort();
    if (
      new Set(dates).size !== dates.length ||
      Date.parse(dates[dates.length - 1]!) - Date.parse(dates[0]!) >
        100 * 86400000
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'FX dates must be unique and fit the bounded rolling source window.',
      });
  });
export type EcbFxObservation = z.infer<typeof EcbFxObservationSchema>;
const Dates = z
  .array(DateOnly)
  .max(92)
  .refine((rows) => new Set(rows).size === rows.length);
export const EcbFxComparisonSchema = z
  .strictObject({
    previousEdition: z.number().int().positive().nullable(),
    addedDates: Dates,
    changedDates: Dates,
    absentDates: Dates,
  })
  .refine(
    (value) =>
      new Set([
        ...value.addedDates,
        ...value.changedDates,
        ...value.absentDates,
      ]).size ===
      value.addedDates.length +
        value.changedDates.length +
        value.absentDates.length,
  );
export function compareEcbFx(
  before: { edition: number; observations: EcbFxObservation[] } | null,
  observations: EcbFxObservation[],
) {
  const prior = new Map(
      before?.observations.map((row) => [row.date, row]) ?? [],
    ),
    next = new Map(observations.map((row) => [row.date, row]));
  return EcbFxComparisonSchema.parse({
    previousEdition: before?.edition ?? null,
    addedDates: [...next.keys()].filter((date) => !prior.has(date)).sort(),
    changedDates: [...next.keys()]
      .filter(
        (date) =>
          prior.has(date) &&
          JSON.stringify(prior.get(date)) !== JSON.stringify(next.get(date)),
      )
      .sort(),
    absentDates: [...prior.keys()].filter((date) => !next.has(date)).sort(),
  });
}
export const EcbFxEditionSchema = z
  .strictObject({
    edition: z.number().int().positive(),
    parserVersion: z.literal(ECB_FX_PARSER),
    sourceId: z.literal(ECB_FX_SOURCE),
    sourceUrl: z.literal(ECB_FX_URL),
    retrievedAt: z.iso.datetime(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    knownAt: z.null(),
    vintageBasis: z.literal('retrieval-revision-only'),
    sourceWindow: z.literal('rolling-90-day-file'),
    windowStart: DateOnly,
    windowEnd: DateOnly,
    observations: EcbFxObservationsSchema,
    comparison: EcbFxComparisonSchema,
  })
  .superRefine((edition, ctx) => {
    const dates = edition.observations.map((row) => row.date).sort();
    const current = new Set(dates),
      comparison = edition.comparison;
    if (!Number.isFinite(Date.parse(edition.retrievedAt))) return;
    if (
      edition.windowStart !== dates[0] ||
      edition.windowEnd !== dates[dates.length - 1] ||
      edition.windowEnd > ecbFxEvaluationDay(new Date(edition.retrievedAt)) ||
      (comparison.previousEdition !== null &&
        comparison.previousEdition >= edition.edition) ||
      comparison.addedDates.some((date) => !current.has(date)) ||
      comparison.changedDates.some((date) => !current.has(date)) ||
      comparison.absentDates.some((date) => current.has(date)) ||
      (comparison.previousEdition === null &&
        (comparison.addedDates.length !== dates.length ||
          comparison.changedDates.length ||
          comparison.absentDates.length))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'FX coverage and prior-capture comparison must reconcile.',
      });
  });
export type EcbFxEdition = z.infer<typeof EcbFxEditionSchema>;
export const EcbFxRefreshSchema = z.strictObject({ requestId: z.uuid() });
export const EcbFxReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
});
export const EcbFxReviewReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  sourceId: z.literal(ECB_FX_SOURCE),
  headVersion: z.number().int().positive(),
  edition: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
  reviewedAt: z.iso.datetime(),
});
export const EcbFxRunSchema = z
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
    observationCount: z.number().int().min(0).max(92),
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
          run.observationCount < 1 ||
          !['changed', 'unchanged'].includes(run.category)))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Run outcome does not reconcile.',
      });
  });
export type EcbFxRun = z.infer<typeof EcbFxRunSchema>;
export const EcbFxHeadSchema = z
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
        message: 'FX source head does not reconcile.',
      });
  });
export const EcbFxOperationsSchema = z
  .strictObject({
    head: EcbFxHeadSchema,
    latest: EcbFxEditionSchema.nullable(),
    latestRun: EcbFxRunSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.head.latestEdition !== (value.latest?.edition ?? null))
      ctx.addIssue({
        code: 'custom',
        message: 'Latest numerical edition does not match its source head.',
      });
  });
export const EcbFxPublicSchema = z
  .strictObject({
    status: z.enum(['never-published', 'published', 'withdrawn']),
    edition: EcbFxEditionSchema.nullable(),
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
        message: 'Only a published source may expose FX data.',
      });
  });
export type EcbFxPublic = z.infer<typeof EcbFxPublicSchema>;
export const EcbFxHistorySchema = z.strictObject({
  editions: z.array(EcbFxEditionSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EcbFxRunsSchema = z.strictObject({
  runs: z.array(EcbFxRunSchema).max(50),
  moreAvailable: z.boolean(),
});
export const EcbFxReviewsSchema = z.strictObject({
  reviews: z.array(EcbFxReviewReceiptSchema).max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EcbFxEvidenceSchema = z.strictObject({
  scope: z.literal('reviewed-numerical-edition'),
  edition: EcbFxEditionSchema,
});
export const EcbFxRetainedSchema = z.strictObject({
  scope: z.literal('operator-retained-original'),
  requestId: z.uuid(),
  sourceUrl: z.literal(ECB_FX_URL),
  retrievedAt: z.iso.datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  body: z.string().min(1).max(1000000),
});
export function ecbFxEvaluationDay(now: Date) {
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
export function ecbFxLatest(edition: EcbFxEdition, evaluatedOn: string) {
  return (
    [...edition.observations]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((row) => row.date <= evaluatedOn) ?? null
  );
}
