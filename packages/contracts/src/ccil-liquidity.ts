import { z } from 'zod';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { sbiWorkbookParts } from './sbi-portfolio-parser.js';
export const CCIL_LIQUIDITY_URL =
  'https://www.ccilindia.com/documents/43866/556182201/G-Sec%20Market%20Liquidity%20Tracker-2026-07-31_1786434003843.xlsx';
export const CCIL_LIQUIDITY_HEADERS = [
  'Security Name',
  'INSTRUMENT TYPE',
  'Trade Date',
  'Coupon',
  'Settlement Date',
  'Average_Spread_Ratio',
  'Average_Spread_Paisa',
  'Average_Spread_Mduration',
  'Max_BidAskSpread',
  'Min_BidAskSpread',
  'Average_Bid_ImpactCost',
  'Average_Offer_ImpactCost',
  'Comments',
] as const;
const lexical = z
  .string()
  .max(80)
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:E[+-]?\d{1,3})?$/);
const label = z.string().min(1).max(160);
export const CcilLiquidityRowSchema = z.strictObject({
  sourceRow: z.number().int().min(2).max(12001),
  securityDescription: label,
  instrumentType: z.enum(['CENTRAL GOVERMENT', 'STATE GOVERMENT']),
  tradeDate: z.iso.date(),
  couponLabel: label,
  settlementDate: z.iso.date(),
  metrics: z.array(lexical.nullable()).length(7),
  comment: z.enum([
    '-',
    'No Orders on Bid/Ask Side',
    'Orders Not Adding to 25Cr On Bid/Ask Side',
    'Orders Not Adding to 25Cr On Offer Side',
    'Orders Not Adding to 25Cr On Bid Side',
  ]),
});
export const CcilLiquiditySchema = z
  .strictObject({
    parser: z.literal('ccil-liquidity-xlsx-v1'),
    date: z.literal('2026-07-31'),
    identity: z.literal('source-description-only-no-isin'),
    conventions: z.literal('source-column-labels-only'),
    rows: z.array(CcilLiquidityRowSchema).min(1).max(12000),
  })
  .refine(
    (v) =>
      new Set(
        v.rows.map((r) =>
          JSON.stringify([
            r.securityDescription,
            r.instrumentType,
            r.tradeDate,
            r.settlementDate,
          ]),
        ),
      ).size === v.rows.length,
    'Duplicate source identity',
  )
  .refine(
    (v) =>
      v.rows.every(
        (r, i) =>
          r.sourceRow === i + 2 &&
          r.tradeDate.startsWith('2026-07-') &&
          r.settlementDate >= r.tradeDate &&
          Date.parse(r.settlementDate) - Date.parse(r.tradeDate) <=
            7 * 86400000,
      ),
    'Exact source row order and dated month required',
  );
type Node = Record<string, unknown>;
const list = (v: unknown): Node[] =>
  v === undefined ? [] : ((Array.isArray(v) ? v : [v]) as Node[]);
function xml(bytes: Uint8Array | undefined, root: string): Node {
  if (!bytes) throw Error('Missing original workbook part');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (
    raw.length > 6000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw) ||
    XMLValidator.validate(raw) !== true
  )
    throw Error('Unsafe workbook XML');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(raw) as Node;
  if (!parsed[root] || typeof parsed[root] !== 'object')
    throw Error('Unknown workbook root');
  return parsed[root] as Node;
}
function serial(value: string) {
  if (!/^\d{5}$/.test(value)) throw Error('Unknown source date serial');
  const n = Number(value);
  if (n < 45000 || n > 50000) throw Error('Source date outside verified range');
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
/** Source XML is inert; lexical metric values never pass through floating point. */
export function parseCcilLiquidity(bytes: Uint8Array) {
  const parts = sbiWorkbookParts(bytes, 'ccil');
  const workbook = xml(parts.get('xl/workbook.xml'), 'workbook');
  const sheets = list((workbook.sheets as Node)?.sheet);
  if (
    sheets.length !== 1 ||
    sheets[0]?.['@_name'] !== 'Sheet 1' ||
    sheets[0]?.['@_r:id'] !== 'rId1' ||
    ![undefined, '0', 'false'].includes(
      (workbook.workbookPr as Node)?.['@_date1904'] as string | undefined,
    )
  )
    throw Error('Unverified worksheet/date system');
  const relationships = list(
    xml(parts.get('xl/_rels/workbook.xml.rels'), 'Relationships').Relationship,
  );
  if (
    relationships.some(
      (r) =>
        r['@_TargetMode'] === 'External' ||
        ![
          'styles.xml',
          'theme/theme1.xml',
          'worksheets/sheet1.xml',
          'sharedStrings.xml',
        ].includes(String(r['@_Target'])),
    ) ||
    relationships.filter(
      (r) => r['@_Id'] === 'rId1' && r['@_Target'] === 'worksheets/sheet1.xml',
    ).length !== 1
  )
    throw Error('Unsupported workbook relationship');
  const strings = list(xml(parts.get('xl/sharedStrings.xml'), 'sst').si).map(
    (s) => {
      if (typeof s.t !== 'string' || Object.keys(s).some((k) => k !== 't'))
        throw Error('Unknown shared text');
      return s.t;
    },
  );
  const sheet = xml(parts.get('xl/worksheets/sheet1.xml'), 'worksheet');
  if (sheet.hyperlinks || sheet.drawing || sheet.oleObjects || sheet.tableParts)
    throw Error('Active or unsupported worksheet');
  const rows = list((sheet.sheetData as Node)?.row);
  if (rows.length < 2 || rows.length > 12001)
    throw Error('Invalid source row bound');
  const source = rows.map((r, index) => {
    if (r['@_r'] !== String(index + 1))
      throw Error('Missing or reordered source row');
    const cells = list(r.c);
    if (cells.length !== 13) throw Error('Unknown source row width');
    return cells.map((c, col) => {
      if (
        c['@_r'] !== String.fromCharCode(65 + col) + (index + 1) ||
        c.f !== undefined ||
        c.is !== undefined ||
        typeof c.v !== 'string'
      )
        throw Error('Formula or missing/reordered cell');
      if (c['@_t'] === 's') {
        if (!/^(0|[1-9]\d*)$/.test(c.v) || strings[Number(c.v)] === undefined)
          throw Error('Invalid shared text index');
        return strings[Number(c.v)]!;
      }
      if (c['@_t'] !== undefined && c['@_t'] !== 'n')
        throw Error('Unknown source cell type');
      return lexical.parse(c.v);
    });
  });
  if (JSON.stringify(source[0]) !== JSON.stringify(CCIL_LIQUIDITY_HEADERS))
    throw Error('Source headers changed');
  const parsed = source.slice(1).map((r, i) => {
    const tradeDate = serial(r[2]!),
      settlementDate = serial(r[4]!);
    if (
      !tradeDate.startsWith('2026-07-') ||
      settlementDate < tradeDate ||
      Date.parse(settlementDate) - Date.parse(tradeDate) > 7 * 86400000
    )
      throw Error('Trade/settlement date outside original month');
    return {
      sourceRow: i + 2,
      securityDescription: r[0],
      instrumentType: r[1],
      tradeDate,
      couponLabel: r[3],
      settlementDate,
      metrics: r.slice(5, 12).map((v) => (v === '-' ? null : lexical.parse(v))),
      comment: r[12],
    };
  });
  return CcilLiquiditySchema.parse({
    parser: 'ccil-liquidity-xlsx-v1',
    date: '2026-07-31',
    identity: 'source-description-only-no-isin',
    conventions: 'source-column-labels-only',
    rows: parsed,
  });
}
const base64 = z
  .string()
  .min(4)
  .max(2666668)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const CcilLiquidityCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  sourceUrl: z.literal(CCIL_LIQUIDITY_URL).default(CCIL_LIQUIDITY_URL),
  body: base64.optional(),
});
export const CcilLiquidityReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
});
export const CcilLiquidityEditionSchema = z
  .strictObject({
    id: z.uuid(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceUrl: z.literal(CCIL_LIQUIDITY_URL),
    retrievedAt: z.iso.datetime(),
    data: CcilLiquiditySchema.nullable(),
    error: z.string().nullable(),
    state: z.enum(['quarantined', 'draft', 'published', 'withdrawn']),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .refine(
    (e) =>
      e.state === 'quarantined'
        ? e.data === null && Boolean(e.error?.trim()) && e.reviewedAt === null
        : e.state === 'draft'
          ? e.data !== null && e.error === null && e.reviewedAt === null
          : e.state === 'published'
            ? e.data !== null && e.error === null && e.reviewedAt !== null
            : e.reviewedAt !== null &&
              (e.data !== null ? e.error === null : Boolean(e.error?.trim())),
    'Edition state must match retained data and review',
  );
export const CcilLiquidityCursorSchema = z
  .string()
  .max(80)
  .refine((v) => {
    const p = v.split('|');
    return (
      p.length === 2 &&
      z.iso.datetime().safeParse(p[0]).success &&
      z.uuid().safeParse(p[1]).success
    );
  });
export const CcilLiquidityPageSchema = z.strictObject({
  cursor: CcilLiquidityCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(2).default(2),
});
export const CcilLiquidityListSchema = z.strictObject({
  enabled: z.boolean(),
  editions: z.array(CcilLiquidityEditionSchema).max(3),
  nextCursor: CcilLiquidityCursorSchema.nullable().default(null),
});
export const CcilLiquiditySnapshotSchema = CcilLiquidityListSchema.extend({
  capturedAt: z.iso.datetime(),
}).refine((v) => v.nextCursor === null, 'Complete snapshot required');
export const CcilLiquidityEvidenceSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  body: base64,
});
