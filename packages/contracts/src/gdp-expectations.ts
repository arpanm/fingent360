import { z } from 'zod';
import {
  BeaGdpOriginalSchema,
  BeaGdpSeriesSchema,
} from './bea-gdp-original.js';
export const SPF_GDP_POLICY = 'spf-original-quarter-median-v1' as const;
export const SpfUrlSchema = z
  .string()
  .regex(
    /^https:\/\/www\.philadelphiafed\.org\/surveys-and-data\/real-time-data-research\/spf-q[1-4]-20\d{2}$/,
  );
const decimal = z.string().regex(/^-?(0|[1-9]\d?)(\.\d{1,2})?$/);
export const GdpExpectationSchema = z
  .strictObject({
    policy: z.literal(SPF_GDP_POLICY),
    url: SpfUrlSchema,
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: z.iso.datetime(),
    sourcePublishedOn: z.iso.date(),
    period: z.string().regex(/^20\d{2}-Q[1-4]$/),
    measure: z.literal('real-gdp-quarter-annualized-percent'),
    kind: z.literal('SPF survey median'),
    value: decimal,
    publicationPrecision: z.literal('day'),
    captureBasis: z.literal('captured-original-report-page'),
    sourceRow: z.tuple([z.string(), z.string(), decimal]),
    annualizedAnchor: z.string().max(150),
  })
  .superRefine((v, c) => {
    if (
      v.sourceRow[0] !== v.period.replace('-Q', ':Q') ||
      v.sourceRow[2] !== v.value ||
      !new RegExp(
        '^annual rate of ' +
          v.value.replace('.', '\\.') +
          ' percent this quarter$',
      ).test(v.annualizedAnchor)
    )
      c.addIssue({
        code: 'custom',
        message:
          'Expectation value does not reconstruct from the retained current-quarter cells and anchor.',
      });
    if (
      !v.url.endsWith(`spf-q${v.period.slice(-1)}-${v.period.slice(0, 4)}`) ||
      v.sourcePublishedOn > v.retrievedAt.slice(0, 10) ||
      v.sourcePublishedOn.slice(0, 4) !== v.period.slice(0, 4) ||
      Math.ceil(Number(v.sourcePublishedOn.slice(5, 7)) / 3) !==
        Number(v.period.slice(-1))
    )
      c.addIssue({
        code: 'custom',
        message:
          'Original expectation quarter or publication day conflicts with its capture.',
      });
  });
export const GdpExpectationInputSchema = z.strictObject({
  requestId: z.uuid(),
  url: SpfUrlSchema,
  body: z.string().min(1).max(2000000),
  rightsBasis: z.string().trim().min(12).max(1000),
  rightsConfirmed: z.literal(true),
});
export const GdpExpectationEditionSchema = z.strictObject({
  id: z.uuid(),
  expectation: GdpExpectationSchema,
  rightsBasis: z.string(),
  capturedBy: z.string(),
});
export const GdpExpectationReviewSchema = z.strictObject({
  requestId: z.uuid(),
  editionId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(5).max(1000),
});
export const GdpExpectationQueueSchema = z.strictObject({
  editions: z
    .array(
      z.strictObject({
        edition: GdpExpectationEditionSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
      }),
    )
    .max(100),
  nextCursor: z.string().max(100).nullable().default(null),
});
const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function parseSpfGdp(raw: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
}) {
  SpfUrlSchema.parse(raw.url);
  if (raw.body.length > 2000000) throw Error('SPF report exceeds its bound.');
  const source = raw.body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const suffix = /spf-q([1-4])-(20\d{2})$/.exec(raw.url)!;
  const headline = [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(
    (m) => clean(m[1]!),
  );
  if (
    headline.length !== 1 ||
    headline[0] !==
      `${['First', 'Second', 'Third', 'Fourth'][Number(suffix[1]) - 1]} Quarter ${suffix[2]} Survey of Professional Forecasters`
  )
    throw Error('SPF report title and URL differ.');
  const dates = [
    ...source.matchAll(
      /<p\b[^>]*itemprop="datePublished"[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ].map((m) => clean(m[1]!));
  const date =
    dates.length === 1
      ? /^(\d{1,2}) ([A-Z][a-z]{2}) [’'](\d{2})$/.exec(dates[0]!)
      : null;
  const month = date
    ? [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ].indexOf(date[2]!)
    : -1;
  if (!date || month < 0)
    throw Error('One explicit original SPF publication day is required.');
  const sourcePublishedOn = z.iso
    .date()
    .parse(
      `20${date[3]}-${String(month + 1).padStart(2, '0')}-${date[1]!.padStart(2, '0')}`,
    );
  const tables = [...source.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((m) => m[1]!)
    .filter((table) =>
      clean(table).startsWith(
        'Real GDP (%) Unemployment Rate (%) Payrolls (000s/month) Previous New Previous New Previous New',
      ),
    );
  if (tables.length !== 1)
    throw Error('Exact SPF median GDP table header required.');
  const rows = [...tables[0]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (m) =>
      [...m[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        clean(cell[1]!),
      ),
  );
  const candidates = rows.filter(
    (row) => row[0] === `${suffix[2]}:Q${suffix[1]}`,
  );
  if (candidates.length !== 1 || candidates[0]!.length !== 7)
    throw Error('One current-quarter SPF median row required.');
  const value = decimal.parse(candidates[0]![2]);
  const prose = clean(source);
  const current =
    /annual rate of\s+(-?\d+(?:\.\d+)?)\s+percent this quarter/.exec(prose);
  if (!current || current[1] !== value)
    throw Error('Current-quarter annualized prose and median disagree.');
  return GdpExpectationSchema.parse({
    policy: SPF_GDP_POLICY,
    url: raw.url,
    hash: raw.hash,
    retrievedAt: raw.retrievedAt,
    sourcePublishedOn,
    period: `${suffix[2]}-Q${suffix[1]}`,
    measure: 'real-gdp-quarter-annualized-percent',
    kind: 'SPF survey median',
    value,
    publicationPrecision: 'day',
    captureBasis: 'captured-original-report-page',
    sourceRow: candidates[0]!.slice(0, 3),
    annualizedAnchor: current[0],
  });
}
export const GdpExpectationPublicSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  expectations: z
    .array(
      GdpExpectationEditionSchema.omit({
        rightsBasis: true,
        capturedBy: true,
      }).extend({ reviewedAt: z.iso.datetime() }),
    )
    .max(100),
  actuals: BeaGdpSeriesSchema,
});
export function compareGdpExpectation(
  expectation: z.infer<typeof GdpExpectationSchema>,
  actual: z.infer<typeof BeaGdpOriginalSchema>,
  reviewedAt?: string,
) {
  const e = GdpExpectationSchema.parse(expectation),
    a = BeaGdpOriginalSchema.parse(actual);
  if (e.period !== a.period || e.measure !== a.measure)
    return {
      status: 'incompatible' as const,
      reason: 'Quarter or measure differs.',
      difference: null,
      contemporaneous: false,
    };
  if (e.sourcePublishedOn >= a.publishedAt.slice(0, 10))
    return {
      status: 'not-prior' as const,
      reason: 'Publication is later or same-day timing is unknown.',
      difference: null,
      contemporaneous: false,
    };
  const scaled = (value: string) => {
    const negative = value.startsWith('-'),
      [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    const n = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
    return negative ? -n : n;
  };
  const delta = scaled(a.value) - scaled(e.value),
    absolute = delta < 0n ? -delta : delta;
  const contemporaneous = Boolean(
    reviewedAt &&
    z.iso.datetime().safeParse(reviewedAt).success &&
    reviewedAt >= e.retrievedAt &&
    reviewedAt < a.publishedAt &&
    e.retrievedAt < a.publishedAt,
  );
  return {
    status: 'comparable' as const,
    reason: contemporaneous
      ? 'Expectation capture and independent admission predate actual release.'
      : 'Retrospective source-date comparison; capture or independent admission does not predate release; not as-known-at evidence.',
    difference: `${delta < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`,
    contemporaneous,
  };
}
