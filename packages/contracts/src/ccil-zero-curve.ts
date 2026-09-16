import { z } from 'zod';
export const CCIL_ZERO_URL = 'https://www.ccilindia.com/en/zcyc-parameters';
const coefficient = z.string().regex(/^-?(0|[1-9][0-9]{0,2})(\.[0-9]{1,4})?$/);
export const CcilZeroRowSchema = z.strictObject({
  date: z.iso.date(),
  beta0: coefficient,
  beta1: coefficient,
  beta2: coefficient,
  beta3: coefficient,
  tau1: coefficient.refine((v) => Number(v) > 0),
  tau2: coefficient.refine((v) => Number(v) > 0),
});
export const CcilZeroSchema = z
  .strictObject({
    parser: z.literal('ccil-nss-static-html-v1'),
    date: z.iso.date(),
    rows: z.array(CcilZeroRowSchema).min(1).max(366),
  })
  .refine(
    (v) =>
      new Set(v.rows.map((r) => r.date)).size === v.rows.length &&
      v.date ===
        v.rows
          .map((r) => r.date)
          .sort()
          .at(-1),
    'Unique dated NSS rows and exact latest date required',
  );
/** Only verified static NSS table cells; source scripts are never executed. */
export function parseCcilZero(body: string) {
  if (body.length > 500000 || /<!ENTITY/i.test(body))
    throw Error('Unsupported source document');
  const tables = [
    ...body.matchAll(
      /<table\b[^>]*\bid=["']advancedSearch["'][^>]*>([\s\S]*?)<\/table\s*>/gi,
    ),
  ];
  if (tables.length !== 1) throw Error('Expected one original NSS table');
  const table = tables[0]![1]!;
  if (/<(?:script|iframe|object|table)\b/i.test(table))
    throw Error('Active or nested source table');
  const text = (cell: string) => {
    if (/<[^>]+>|&(?:#|[a-z])/i.test(cell))
      throw Error('Unknown cell encoding');
    return cell.trim();
  };
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi)].map(
    (m) => text(m[1]!),
  );
  if (
    JSON.stringify(headers) !==
    JSON.stringify(['Date', 'ß0', 'ß1', 'ß2', 'ß3', 'tau1', 'tau2'])
  )
    throw Error('NSS header changed');
  const rows = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    if (/<th\b/i.test(row[1]!)) continue;
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(
      (m) => text(m[1]!),
    );
    if (
      cells.length !== 7 ||
      !/^\d{4}-\d{2}-\d{2} 00:00:00\.0$/.test(cells[0]!)
    )
      throw Error('Unknown NSS date or row width');
    rows.push(
      CcilZeroRowSchema.parse({
        date: cells[0]!.slice(0, 10),
        beta0: cells[1],
        beta1: cells[2],
        beta2: cells[3],
        beta3: cells[4],
        tau1: cells[5],
        tau2: cells[6],
      }),
    );
  }
  return CcilZeroSchema.parse({
    parser: 'ccil-nss-static-html-v1',
    date: rows
      .map((r) => r.date)
      .sort()
      .at(-1),
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
  });
}

export const CCIL_ZERO_RATES_URL = 'https://www.ccilindia.com/en/zero-rates';
export const CcilZeroPointsSchema = z
  .strictObject({
    parser: z.literal('ccil-zero-rates-literal-v1'),
    date: z.iso.date(),
    rows: z
      .array(
        z.strictObject({
          date: z.iso.date(),
          points: z
            .array(
              z.strictObject({
                maturityLabel: z.string(),
                reportedRate: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/),
              }),
            )
            .length(101)
            .refine(
              (points) =>
                points.every(
                  (point, i) => point.maturityLabel === (i / 2).toFixed(1),
                ),
              'Exact original maturity labels required',
            ),
        }),
      )
      .min(1)
      .max(366),
    maturityUnit: z.literal('not-declared-in-table'),
    compounding: z.literal('not-declared-in-table'),
  })
  .refine(
    (v) =>
      new Set(v.rows.map((r) => r.date)).size === v.rows.length &&
      v.date ===
        v.rows
          .map((r) => r.date)
          .sort()
          .at(-1),
    'Unique source dates required',
  );
/** Read original inert JSON data; never execute the surrounding provider script. */
export function parseCcilZeroPoints(body: string) {
  if (body.length > 500000 || /<!ENTITY/i.test(body))
    throw Error('Unsupported original');
  const matches = [...body.matchAll(/\bvar\s+records\s*=\s*(\[[^;]*?\])\s*;/g)];
  if (matches.length !== 1)
    throw Error('Expected one original records literal');
  const original = matches[0]![1]!;
  // This verified flat-object grammar has no escaped keys, nested objects or strings containing commas/braces.
  if (/\\|\{[^}]*\{/.test(original))
    throw Error('Unsupported source JSON grammar');
  for (const match of original.matchAll(/\{([^{}]*)\}/g)) {
    const keys = [...match[1]!.matchAll(/"([^"\\]+)"\s*:/g)].map((m) => m[1]);
    if (new Set(keys).size !== keys.length) throw Error('Repeated source key');
  }
  const raw = z
    .array(z.record(z.string(), z.union([z.number(), z.string()])))
    .min(1)
    .max(366)
    .parse(JSON.parse(original));
  const fields = Array.from({ length: 101 }, (_, i) => {
    const n = Math.floor(i / 2);
    return (
      'zerorate' +
      (n < 10 ? (i % 2 ? String(n) : '0' + n) : '_' + n) +
      (i % 2 ? '_5' : '')
    );
  });
  const metadata = [
    'id',
    'date',
    'stringdate',
    'created_by',
    'created_date',
    'modified_by',
    'modified_timestamp',
    'zerorate_50_5',
  ];
  const allowed = [...fields, ...metadata];
  const rows = raw.map((row) => {
    if (
      Object.keys(row).length !== allowed.length ||
      Object.keys(row).some((k) => !allowed.includes(k))
    )
      throw Error('Unknown/missing curve fields');
    if (
      typeof row.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2} 00:00:00\.0$/.test(row.date)
    )
      throw Error('Unknown curve date');
    if (row.zerorate_50_5 !== 0) throw Error('Unused50.5 sentinel changed');
    return {
      date: row.date.slice(0, 10),
      points: fields.map((key, i) => {
        const value = row[key];
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value >= 100
        )
          throw Error('Invalid source point');
        return {
          maturityLabel: (i / 2).toFixed(1),
          reportedRate: String(value),
        };
      }),
    };
  });
  return CcilZeroPointsSchema.parse({
    parser: 'ccil-zero-rates-literal-v1',
    date: rows
      .map((r) => r.date)
      .sort()
      .at(-1),
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
    maturityUnit: 'not-declared-in-table',
    compounding: 'not-declared-in-table',
  });
}

export const CcilZeroCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  sourceUrl: z
    .enum([CCIL_ZERO_URL, CCIL_ZERO_RATES_URL])
    .default(CCIL_ZERO_URL),
  body: z.string().min(1).max(500000).optional(),
});
export const CcilZeroReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
});
export const CcilZeroEditionSchema = z
  .strictObject({
    id: z.uuid(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceUrl: z.enum([CCIL_ZERO_URL, CCIL_ZERO_RATES_URL]),
    retrievedAt: z.iso.datetime(),
    data: z.union([CcilZeroSchema, CcilZeroPointsSchema]).nullable(),
    error: z.string().nullable(),
    state: z.enum(['quarantined', 'draft', 'published', 'withdrawn']),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .refine(
    (e) =>
      !e.data ||
      (e.sourceUrl === CCIL_ZERO_URL) ===
        (e.data.parser === 'ccil-nss-static-html-v1'),
    'Original source and parser must match',
  );
export const CcilZeroCursorSchema = z
  .string()
  .max(80)
  .refine((value) => {
    const parts = value.split('|');
    return (
      parts.length === 2 &&
      z.iso.datetime().safeParse(parts[0]).success &&
      z.uuid().safeParse(parts[1]).success
    );
  }, 'Invalid curve cursor');
export const CcilZeroPageSchema = z.strictObject({
  cursor: CcilZeroCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(30).default(30),
});
export const CcilZeroListSchema = z.strictObject({
  enabled: z.boolean(),
  editions: z.array(CcilZeroEditionSchema).max(100),
  nextCursor: CcilZeroCursorSchema.nullable().default(null),
});
export const CcilZeroSnapshotSchema = CcilZeroListSchema.extend({
  capturedAt: z.iso.datetime(),
}).refine(
  (v) => v.nextCursor === null,
  'Partial history cannot form complete offline snapshot',
);
export const CcilZeroEvidenceSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  body: z.string().max(500000),
});

export function parseCcilZeroSource(body: string, url: string) {
  return url === CCIL_ZERO_RATES_URL
    ? parseCcilZeroPoints(body)
    : parseCcilZero(body);
}
