import { IndiaGdpEditionSchema, IndiaGdpSnapshotSchema } from './india-gdp.js';
export * from './india-gdp.js';
import { z } from 'zod';
const decimal = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/);
export const INDIA_CPI_METADATA =
  'https://api.mospi.gov.in/api/cpi/getCpiFilterByLevelAndBaseYear?base_year=2024&level=Group&series_code=Current';
export const INDIA_CPI_ENDPOINT = 'https://api.mospi.gov.in/api/cpi/getCPIData';
export const IndiaCpiRowSchema = z.strictObject({
  base_year: z.literal('2024'),
  series: z.literal('Current'),
  year: z.string().regex(/^20\d{2}$/),
  month: z.enum([
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]),
  state: z.literal('All India'),
  sector: z.literal('Combined'),
  division: z.literal('CPI (General)'),
  group: z.null(),
  class: z.null(),
  sub_class: z.null(),
  item: z.null(),
  code: z.null(),
  index: decimal,
  inflation: decimal.nullable(),
  imputation: z.null(),
});
export const IndiaCpiResponseSchema = z
  .strictObject({
    data: z.array(IndiaCpiRowSchema).max(1000),
    meta_data: z.strictObject({
      page: z.literal(1),
      totalRecords: z.number().int().nonnegative().max(1000),
      totalPages: z.literal(1),
      recordPerPage: z.number().int().min(10).max(1000),
    }),
    msg: z.string(),
    statusCode: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (value.data.length !== value.meta_data.totalRecords)
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'A complete single-page capture is required.',
      });
    const keys = value.data.map((row) => `${row.year}-${row.month}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Duplicate observation periods.',
      });
  });
export const IndiaCpiPointSchema = z.strictObject({
  period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  index: decimal,
  inflation: decimal.nullable(),
  status: z.enum(['provisional', 'final', 'capture-only']),
});
export function parseIndiaCpiCapture(body: string) {
  const response = IndiaCpiResponseSchema.parse(JSON.parse(body));
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return response.data.map((row) =>
    IndiaCpiPointSchema.parse({
      period: `${row.year}-${String(months.indexOf(row.month) + 1).padStart(2, '0')}`,
      index: row.index,
      inflation: row.inflation,
      status: 'capture-only',
    }),
  );
}
export const IndiaCpiReleaseSchema = z.strictObject({
  sourceUrl: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'www.pib.gov.in' &&
      /^\/PressRelease(?:Page|Detail)\.aspx$/.test(u.pathname) &&
      /^\d{5,12}$/.test(u.searchParams.get('PRID') ?? '')
    );
  }),
  publishedAt: z.iso.datetime(),
  title: z.string(),
  points: z.array(IndiaCpiPointSchema).length(2),
});
export const IndiaMacroImportSchema = z.strictObject({
  requestId: z.uuid(),
  releaseUrl: IndiaCpiReleaseSchema.shape.sourceUrl,
  releaseHtml: z.string().min(100).max(2000000),
  apiBody: z.string().min(20).max(1000000),
  rightsEvidence: z.string().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const IndiaMacroReviewSchema = z.strictObject({
  requestId: z.uuid(),
  editionId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(12).max(2000),
});
export const IndiaMacroEditionSchema = z.strictObject({
  id: z.uuid(),
  parser: z.literal('mospi-cpi2024-pib-v1'),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime(),
  sourceUrl: IndiaCpiReleaseSchema.shape.sourceUrl,
  title: z.string(),
  points: z.array(IndiaCpiPointSchema).length(2),
  apiPoints: z.array(IndiaCpiPointSchema).max(1000),
  reconciliation: z.enum([
    'matches-current-capture',
    'different-current-capture',
  ]),
  rightsEvidence: z.string().max(2000),
});
export const IndiaMacroSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  asOf: z.iso.datetime().nullable(),
  editions: z
    .array(IndiaMacroEditionSchema.omit({ rightsEvidence: true }))
    .max(500),
  selected: z
    .array(
      IndiaCpiPointSchema.extend({
        editionId: z.uuid(),
        publishedAt: z.iso.datetime(),
        retrievedAt: z.iso.datetime(),
        sourceUrl: IndiaCpiReleaseSchema.shape.sourceUrl,
      }),
    )
    .max(1000),
});
export const IndiaMacroQueueSchema = z
  .array(
    z.strictObject({
      edition: IndiaMacroEditionSchema,
      state: z.enum(['draft', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export function selectIndiaCpiVintages(
  editions: ReturnType<typeof IndiaMacroSnapshotSchema.parse>['editions'],
  asOf: string | null,
) {
  const map = new Map<
    string,
    ReturnType<typeof IndiaMacroSnapshotSchema.parse>['selected'][number]
  >();
  for (const edition of [...editions].sort(
    (a, b) =>
      a.publishedAt.localeCompare(b.publishedAt) ||
      a.retrievedAt.localeCompare(b.retrievedAt) ||
      a.id.localeCompare(b.id),
  )) {
    if (asOf && edition.publishedAt > asOf) continue;
    for (const point of edition.points)
      map.set(point.period, {
        ...point,
        editionId: edition.id,
        publishedAt: edition.publishedAt,
        retrievedAt: edition.retrievedAt,
        sourceUrl: edition.sourceUrl,
      });
  }
  return [...map.values()].sort((a, b) => b.period.localeCompare(a.period));
}
export const INDIA_MACRO_REGISTRY = [
  {
    id: 'in-cpi-2024-combined',
    name: 'Consumer prices',
    unit: 'Index,2024=100; year-on-year percent',
    frequency: 'Monthly',
    coverage:
      'Original PIB publication vintages and reconciled MoSPI API captures',
    sourceUrl: 'https://www.mospi.gov.in/',
  },
  {
    id: 'in-gdp-2022-23',
    name: 'Gross domestic product',
    unit: '2022–23 base; constant/current prices must remain distinct',
    frequency: 'Quarterly/annual',
    coverage:
      'Reviewed original quarterly real GDP vintages; bases remain separate',
    sourceUrl: 'https://www.mospi.gov.in/',
  },
  {
    id: 'in-iip-2022-23',
    name: 'Industrial production',
    unit: '2022–23 base; do not splice with2011–12',
    frequency: 'Monthly',
    coverage: 'Calendar and registry; numerical adapter not yet onboarded',
    sourceUrl: 'https://www.mospi.gov.in/',
  },
  {
    id: 'in-rbi-repo',
    name: 'RBI policy repo rate',
    unit: 'Percent per annum',
    frequency: 'Decision-based',
    coverage: 'Registry; original RBI decision adapter not yet onboarded',
    sourceUrl: 'https://data.rbi.org.in/',
  },
] as const;
export const IndiaCalendarInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    sourceUrl: z.url().refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        u.hostname === 'www.mospi.gov.in' &&
        u.pathname.startsWith('/uploads/documents/releaseCalender/') &&
        u.pathname.endsWith('.pdf')
      );
    }),
    pdfBase64: z
      .string()
      .min(20)
      .max(8000000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    editionLabel: z.string().trim().min(8).max(160),
    rightsEvidence: z.string().min(20).max(2000),
    rightsConfirmed: z.literal(true),
    events: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[a-z0-9-]{1,80}$/),
          series: z.enum([
            'in-cpi-2024-combined',
            'in-gdp-2022-23',
            'in-iip-2022-23',
          ]),
          title: z.string().trim().min(5).max(300),
          plannedOn: z.iso.date(),
          actualOn: z.iso.date().nullable(),
          page: z.number().int().min(1).max(100),
          sourceExcerpt: z.string().trim().min(10).max(1000),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.events.map((row) => row.id)).size !== value.events.length)
      ctx.addIssue({
        code: 'custom',
        path: ['events'],
        message: 'Duplicate calendar identifiers.',
      });
  });
export const IndiaCalendarEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  sourceUrl: IndiaCalendarInputSchema.shape.sourceUrl,
  editionLabel: z.string(),
  events: IndiaCalendarInputSchema.shape.events,
  basis: z.literal('reviewed-official-calendar-transcription'),
});
export const IndiaMacroDashboardSchema = z.strictObject({
  cpi: IndiaMacroSnapshotSchema,
  gdp: IndiaGdpSnapshotSchema.optional(),
  calendar: IndiaCalendarEditionSchema.nullable(),
  calendarHistory: z.array(IndiaCalendarEditionSchema).max(100),
});
export const IndiaMacroOperationsSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      kind: z.enum(['cpi', 'calendar', 'gdp']),
      payload: z.union([
        IndiaMacroEditionSchema,
        IndiaCalendarEditionSchema,
        IndiaGdpEditionSchema,
      ]),
      state: z.enum(['draft', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export const IndiaMacroAttemptsSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string(),
      createdAt: z.iso.datetime(),
    }),
  )
  .max(100);
export const IndiaMacroCaptureReceiptSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['retained', 'quarantined']),
  reason: z.string().nullable(),
});

export const IndiaMacroQueuePageSchema = z.strictObject({
  rows: IndiaMacroOperationsSchema,
  nextCursor: z.string().max(100).nullable(),
});
export const IndiaMacroAttemptPageSchema = z.strictObject({
  rows: IndiaMacroAttemptsSchema,
  nextCursor: z.string().max(100).nullable(),
});
