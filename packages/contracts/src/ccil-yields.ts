import { z } from 'zod';
export const CCIL_YIELDS_URL =
  'https://www.ccilindia.com/web/ccil/tenorwise-indicative-yields';
export const CcilYieldSchema = z.strictObject({
  date: z.iso.date(),
  tenor: z.enum([
    '91D',
    '182D',
    '364D',
    '1Y-2Y',
    '4Y-5Y',
    '9Y-10Y',
    '13Y-15Y',
    '28Y-30Y',
    '5Y',
    '10Y',
    '15Y',
  ]),
  security: z.string().min(1).max(160),
  ytmPercent: z.string().regex(/^(0|[1-9][0-9]?)(\.[0-9]{1,4})?$/),
  convention: z.enum(['primary-auction-cutoff', 'indicative-benchmark']),
  isin: z.null(),
  cleanPrice: z.null(),
});
export const CcilYieldsSchema = z.strictObject({
  parser: z.literal('ccil-public-tenor-html-v1'),
  date: z.iso.date(),
  rows: z.array(CcilYieldSchema).length(11),
});
export const CcilCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  body: z.string().min(1).max(500000).optional(),
});
export const CcilReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
});
export const CcilEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: z.literal(CCIL_YIELDS_URL),
  retrievedAt: z.iso.datetime(),
  data: CcilYieldsSchema.nullable(),
  error: z.string().nullable(),
  state: z.enum(['quarantined', 'draft', 'published', 'withdrawn']),
  reviewedAt: z.iso.datetime().nullable(),
});
export const CcilYieldsListSchema = z.strictObject({
  enabled: z.boolean(),
  editions: z.array(CcilEditionSchema).max(100),
});
export const CcilYieldsSnapshotSchema = CcilYieldsListSchema.extend({
  capturedAt: z.iso.datetime(),
});
export const CcilEvidenceSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  body: z.string().max(500000),
});
const tenors = CcilYieldSchema.shape.tenor.options;
/** Parse only the observed static table; surrounding provider scripts remain inert. */
export function parseCcilYields(body: string) {
  if (body.length > 500000 || /<!ENTITY/i.test(body))
    throw Error('Unsupported source document.');
  const tables = [
    ...body.matchAll(
      /<table\b[^>]*\bid=["']dtTable["'][^>]*>([\s\S]*?)<\/table\s*>/gi,
    ),
  ];
  if (tables.length !== 1) throw Error('Expected one source yield table.');
  const table = tables[0]![1]!;
  if (/<(?:script|iframe|object|table)\b/i.test(table))
    throw Error('Unsupported active or nested table markup.');
  const text = (html: string) => {
    if (/<[^>]+>/.test(html) || /&(?:#|[a-z])/i.test(html))
      throw Error('Unexpected cell markup or encoding.');
    return html.trim();
  };
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi)].map(
    (m) => text(m[1]!),
  );
  if (
    JSON.stringify(headers) !==
    JSON.stringify(['Date', 'Tenor Bucket', 'Security', 'YTM (%)'])
  )
    throw Error('CCIL yield headers changed.');
  const rows = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    if (/<th\b/i.test(match[1]!)) continue;
    const cells = [
      ...match[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi),
    ].map((m) => text(m[1]!));
    if (cells.length !== 4) throw Error('Unexpected yield columns.');
    const [rawDate, tenor, security, ytmPercent] = cells;
    if (!/^\d{4}-\d{2}-\d{2} 00:00:00\.0$/.test(rawDate!))
      throw Error('Unverified source date format.');
    const primary = ['91D', '182D', '364D', '5Y', '10Y', '15Y'].includes(
      tenor!,
    );
    if (
      primary
        ? !/(?: DTB \(\d{2}\/\d{2}\/\d{4}\)| SGS \d{4})$/.test(security!)
        : !/% GS \d{4}$/.test(security!)
    )
      throw Error('Security category conflicts with indicative tenor.');
    rows.push(
      CcilYieldSchema.parse({
        date: rawDate!.slice(0, 10),
        tenor,
        security,
        ytmPercent,
        convention: primary ? 'primary-auction-cutoff' : 'indicative-benchmark',
        isin: null,
        cleanPrice: null,
      }),
    );
  }
  if (
    new Set(rows.map((r) => r.tenor)).size !== tenors.length ||
    new Set(rows.map((r) => r.date)).size !== 1
  )
    throw Error('Missing, repeated or mixed-date benchmark tenors.');
  if (!body.includes('Tbill and SDL YTMs are primary market cut-offs'))
    throw Error('Source yield convention note changed.');
  return CcilYieldsSchema.parse({
    parser: 'ccil-public-tenor-html-v1',
    date: rows[0]?.date,
    rows,
  });
}
