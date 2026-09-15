import { z } from 'zod';
import {
  EquityUdiffQuoteSchema,
  EquitySourceCoverageSchema,
  NSE_UDIFF_PARSER,
  parseUdiffRows,
} from './equity-udiff.js';
export * from './equity-udiff.js';

export const EQUITY_MASTER_URL =
  'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
export const EQUITY_INDEX_URL =
  'https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv';
const text = z.string().trim().min(1).max(240);
const day = z.iso.date();
const isin = z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/);
const decimal = z.string().regex(/^-?(0|[1-9][0-9]{0,20})(\.[0-9]{1,8})?$/);
const unsigned = z.string().regex(/^(0|[1-9][0-9]{0,20})(\.[0-9]{1,8})?$/);
const common = {
  isin,
  effectiveOn: day,
  sourceRow: z.number().int().positive(),
};
export const EquityObservationSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...common,
    kind: z.literal('identity'),
    exchange: z.enum(['NSE', 'BSE']),
    symbol: text,
    name: text,
    series: text,
    listedOn: day.nullable(),
    faceValue: unsigned,
  }),
  z.strictObject({
    ...common,
    kind: z.literal('price'),
    exchange: z.enum(['NSE', 'BSE']),
    currency: z.literal('INR'),
    close: unsigned,
    volume: z.string().regex(/^(0|[1-9][0-9]{0,24})$/),
    adjusted: z.literal(false),
    udiff: EquityUdiffQuoteSchema.optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal('corporate-action'),
    purpose: text,
    recordOn: day.nullable(),
    adjustment: z.literal('not-applied'),
  }),
  z.strictObject({
    ...common,
    kind: z.literal('fundamental'),
    metric: z.enum([
      'revenue',
      'profit-after-tax',
      'total-assets',
      'total-debt',
      'equity',
      'eps',
    ]),
    periodStart: day,
    periodEnd: day,
    basis: z.enum(['consolidated', 'standalone']),
    currency: z.literal('INR'),
    scale: z.enum([
      'rupees',
      'thousands',
      'lakhs',
      'crores',
      'rupees-per-share',
    ]),
    value: decimal,
    audited: z.boolean(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal('classification'),
    sector: text,
    index: text,
    membership: z.enum(['included', 'excluded']),
    weightPercent: unsigned.nullable(),
  }),
]);
export type EquityObservation = z.infer<typeof EquityObservationSchema>;
export const EquityDatasetSchema = z
  .strictObject({
    format: z.literal('f360-equity-evidence-v1'),
    observations: z.array(EquityObservationSchema).min(1).max(10000),
    coverage: EquitySourceCoverageSchema.optional(),
  })
  .superRefine(({ observations }, ctx) => {
    const keys = new Set<string>();
    for (const row of observations) {
      const key = equityObservationKey(row);
      if (keys.has(key))
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate observation identity in one edition.',
        });
      keys.add(key);
      if (
        row.kind === 'fundamental' &&
        (row.periodStart > row.periodEnd || row.periodEnd > row.effectiveOn)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Financial periods must end before publication/effective date.',
        });
      if (
        row.kind === 'classification' &&
        row.weightPercent !== null &&
        Number(row.weightPercent) > 100
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Index weights cannot exceed 100 percent.',
        });
    }
  });
export function equityObservationKey(row: EquityObservation) {
  const detail =
    row.kind === 'identity' || row.kind === 'price'
      ? row.exchange
      : row.kind === 'fundamental'
        ? `${row.metric}:${row.basis}:${row.periodStart}:${row.periodEnd}`
        : row.kind === 'classification'
          ? row.index
          : row.purpose;
  return `${row.isin}:${row.kind}:${row.effectiveOn}:${detail}`;
}
export const EquityImportSchema = z.strictObject({
  requestId: z.uuid(),
  parser: z.enum([
    'nse-equity-master-v1',
    'nifty50-constituents-v1',
    'f360-equity-evidence-v1',
    NSE_UDIFF_PARSER,
  ]),
  sourceFileName: z.string().max(100).optional(),
  sourceUrl: z.url().refine((url) => {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  }),
  effectiveOn: day,
  publishedAt: z.iso.datetime().nullable(),
  rightsBasis: z.string().trim().min(12).max(1000),
  rightsConfirmed: z.literal(true),
  body: z.string().min(1).max(2000000),
});
export const EquityFetchSchema = EquityImportSchema.omit({
  body: true,
  sourceUrl: true,
}).extend({
  parser: z.enum([
    'nse-equity-master-v1',
    'nifty50-constituents-v1',
    NSE_UDIFF_PARSER,
  ]),
});
export const EquityEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  parser: EquityImportSchema.shape.parser,
  sourceUrl: EquityImportSchema.shape.sourceUrl,
  effectiveOn: day,
  publishedAt: z.iso.datetime().nullable(),
  retrievedAt: z.iso.datetime(),
  rightsBasis: z.string(),
  observations: z.array(EquityObservationSchema).min(1).max(10000),
  sourceFileName: z.string().max(100).optional(),
  archiveHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  coverage: EquitySourceCoverageSchema.optional(),
});
export type EquityEdition = z.infer<typeof EquityEditionSchema>;
export const EquityReviewSchema = z.strictObject({
  requestId: z.uuid(),
  editionId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(5).max(1000),
});
export const EquityQueueSchema = z.strictObject({
  editions: z
    .array(
      z.strictObject({
        edition: EquityEditionSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
      }),
    )
    .max(50),
});
export const EquityCompanySchema = z.strictObject({
  isin,
  name: text,
  records: z
    .array(
      z.strictObject({
        observation: EquityObservationSchema,
        editionId: z.uuid(),
        sourceUrl: EquityImportSchema.shape.sourceUrl,
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        retrievedAt: z.iso.datetime(),
        publishedAt: z.iso.datetime().nullable(),
      }),
    )
    .max(1000),
  truncated: z.boolean(),
});
export const EquityCompaniesSchema = z.strictObject({
  companies: z.array(z.strictObject({ isin, name: text })).max(50),
  nextAfter: isin.nullable(),
});
export const EquitySnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  companies: z.array(EquityCompanySchema).max(10000),
});

/** Exact, bounded RFC4180 subset; spreadsheet formulas are never evaluated. */
export function equityCsv(body: string) {
  if (!body || body.length > 2000000)
    throw Error('Source CSV is empty or exceeds 2 MB.');
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(value.trim());
    value = '';
    closed = false;
    if (row.length > 60) throw Error('Too many columns.');
  };
  const record = () => {
    cell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
    if (rows.length > 10001) throw Error('Too many rows.');
  };
  const input = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += ch;
    } else if (ch === ',') cell();
    else if (ch === '\n') record();
    else if (closed) throw Error('Invalid characters after a quoted cell.');
    else if (ch === '"') {
      if (value) throw Error('Invalid CSV quote.');
      quoted = true;
    } else value += ch;
    if (value.length > 2000) throw Error('Source cell is too long.');
  }
  if (quoted) throw Error('Unclosed CSV quote.');
  if (value || row.length || closed) record();
  const header = rows.shift();
  if (
    !header ||
    new Set(header).size !== header.length ||
    !rows.length ||
    rows.some((r) => r.length !== header.length)
  )
    throw Error('CSV header or row lengths are invalid.');
  return { header, rows };
}
export function parseEquitySource(
  parser: z.infer<typeof EquityImportSchema>['parser'],
  body: string,
  effectiveOn: string,
  filename?: string,
) {
  day.parse(effectiveOn);
  if (parser === 'f360-equity-evidence-v1')
    return EquityDatasetSchema.parse(JSON.parse(body));
  const { header, rows } = equityCsv(body);
  if (parser === NSE_UDIFF_PARSER) {
    const value = parseUdiffRows(header, rows, effectiveOn, filename ?? '');
    return EquityDatasetSchema.parse({
      format: 'f360-equity-evidence-v1',
      observations: value.records,
      coverage: value.coverage,
    });
  }
  const expected =
    parser === 'nse-equity-master-v1'
      ? [
          'SYMBOL',
          'NAME OF COMPANY',
          'SERIES',
          'DATE OF LISTING',
          'PAID UP VALUE',
          'MARKET LOT',
          'ISIN NUMBER',
          'FACE VALUE',
        ]
      : ['Company Name', 'Industry', 'Symbol', 'Series', 'ISIN Code'];
  if (
    header.length !== expected.length ||
    expected.some((name, i) => header[i] !== name)
  )
    throw Error('Source header changed. Review the adapter before importing.');
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const observations = rows.map((cells, i) => {
    if (parser === 'nifty50-constituents-v1')
      return {
        kind: 'classification',
        isin: cells[4],
        sourceRow: i + 2,
        effectiveOn,
        sector: cells[1],
        index: 'NIFTY 50',
        membership: 'included',
        weightPercent: null,
      };
    const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(cells[3]!);
    if (!match || !months.includes(match[2]!.toUpperCase()))
      throw Error('Listing date format changed.');
    return {
      kind: 'identity',
      isin: cells[6],
      effectiveOn,
      sourceRow: i + 2,
      exchange: 'NSE',
      symbol: cells[0],
      name: cells[1],
      series: cells[2],
      listedOn: `${match[3]}-${String(months.indexOf(match[2]!.toUpperCase()) + 1).padStart(2, '0')}-${match[1]}`,
      faceValue: cells[7],
    };
  });
  return EquityDatasetSchema.parse({
    format: 'f360-equity-evidence-v1',
    observations,
  });
}
