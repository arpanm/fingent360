import { z } from 'zod';
export const INDIA_GDP_PARSER = 'mospi-pib-quarterly-real-gdp-v1';
export const INDIA_GDP_INDEX =
  'https://www.pib.gov.in/allRel.aspx?lang=1&reg=3';
export const IndiaGdpUrlSchema = z.url().refine((value) => {
  const u = new URL(value);
  if (u.hostname === 'archive.pib.gov.in')
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      u.pathname === '/archive2/erelcontent.aspx' &&
      /^\d{5,12}$/.test(u.searchParams.get('relid') ?? '') &&
      [...u.searchParams.keys()].join(',') === 'relid'
    );
  return (
    u.protocol === 'https:' &&
    u.hostname === 'www.pib.gov.in' &&
    !u.username &&
    !u.password &&
    !u.port &&
    !u.hash &&
    /^\/PressRelease(?:Page|Detail)\.aspx$/.test(u.pathname) &&
    /^\d{5,12}$/.test(u.searchParams.get('PRID') ?? '') &&
    [...u.searchParams.keys()].every((key) =>
      ['PRID', 'lang', 'reg'].includes(key),
    )
  );
});
const amount = z.string().regex(/^(0|[1-9]\d{0,8})\.\d{2}$/),
  growth = z.string().regex(/^-?(0|[1-9]\d{0,2})\.\d$/);
export const IndiaGdpPointSchema = z
  .strictObject({
    fiscalYear: z.string().regex(/^20\d{2}-\d{2}$/),
    quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
    previousFiscalYear: z.string().regex(/^20\d{2}-\d{2}$/),
    baseYear: z.enum(['2011-12', '2022-23']),
    measure: z.literal('real-gdp'),
    priceBasis: z.literal('constant-prices'),
    unit: z.literal('INR-lakh-crore'),
    growthBasis: z.literal('year-on-year-percent'),
    value: amount,
    previousYearValue: amount,
    growthPercent: growth,
    method: z.literal('benchmark-indicator'),
    status: z.literal('reported-quarterly-estimate'),
  })
  .superRefine((point, ctx) => {
    const year = Number(point.fiscalYear.slice(0, 4));
    if (
      point.fiscalYear.slice(5) !== String((year + 1) % 100).padStart(2, '0') ||
      point.previousFiscalYear !==
        `${year - 1}-${String(year % 100).padStart(2, '0')}`
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Quarterly comparison must use the preceding fiscal year.',
      });
    if (
      !amount.safeParse(point.value).success ||
      !amount.safeParse(point.previousYearValue).success ||
      !growth.safeParse(point.growthPercent).success
    )
      return;
    const value = BigInt(point.value.replace('.', '')),
      previous = BigInt(point.previousYearValue.replace('.', ''));
    if (previous <= 0n) {
      ctx.addIssue({
        code: 'custom',
        message: 'Previous quarter-year level must be positive.',
      });
      return;
    }
    const reported = BigInt(point.growthPercent.replace('.', ''));
    /* Intersect level rounding intervals (+/-0.005 lakh crore) with growth rounding interval (+/-0.05 percentage points). */ const minimumTooHigh =
      2000n * (2n * value - 2n * previous - 2n) >
      (2n * reported + 1n) * (2n * previous + 1n);
    const maximumTooLow =
      2000n * (2n * value - 2n * previous + 2n) <
      (2n * reported - 1n) * (2n * previous - 1n);
    if (minimumTooHigh || maximumTooLow)
      ctx.addIssue({
        code: 'custom',
        message:
          'Reported levels and YoY rate do not reconcile within source rounding.',
      });
  });
export const IndiaGdpReleaseSchema = z.strictObject({
  sourceUrl: IndiaGdpUrlSchema,
  publishedAt: z.iso.datetime(),
  title: z.string().min(20).max(500),
  point: IndiaGdpPointSchema,
  nextRelease: z
    .strictObject({
      plannedOn: z.iso.date(),
      precision: z.literal('day'),
      actualOn: z.null(),
    })
    .nullable(),
});
export const IndiaGdpInputSchema = z.strictObject({
  requestId: z.uuid(),
  archiveEvidence: z
    .strictObject({
      month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .optional(),
  releaseUrl: IndiaGdpUrlSchema,
  releaseHtml: z.string().min(100).max(2000000),
  rightsEvidence: z.string().trim().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const IndiaGdpEditionSchema = IndiaGdpReleaseSchema.extend({
  id: z.uuid(),
  parser: z.literal(INDIA_GDP_PARSER),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  rightsEvidence: z.string().max(2000),
});
export const IndiaGdpPublicEditionSchema = IndiaGdpEditionSchema.omit({
  rightsEvidence: true,
});
export const IndiaGdpSnapshotSchema = z.strictObject({
  editions: z.array(IndiaGdpPublicEditionSchema).max(500),
  selected: z.array(IndiaGdpPublicEditionSchema).max(500),
});
export function selectIndiaGdp(
  editions: ReturnType<typeof IndiaGdpPublicEditionSchema.parse>[],
  asOf: string | null,
) {
  const selected = new Map<
    string,
    ReturnType<typeof IndiaGdpPublicEditionSchema.parse>
  >();
  for (const edition of [...editions].sort(
    (a, b) =>
      a.publishedAt.localeCompare(b.publishedAt) ||
      a.retrievedAt.localeCompare(b.retrievedAt) ||
      a.id.localeCompare(b.id),
  )) {
    if (asOf && edition.publishedAt > asOf) continue;
    selected.set(
      `${edition.point.baseYear}:${edition.point.fiscalYear}:${edition.point.quarter}`,
      edition,
    );
  }
  return [...selected.values()].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}
