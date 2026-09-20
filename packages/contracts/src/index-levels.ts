import { z } from 'zod';
import { equityCsv } from './equity-coverage.js';
export const INDEX_LEVEL_NAMES = [
  'Nifty 50',
  'Nifty Bank',
  'Nifty IT',
] as const;
export const INDEX_LEVEL_FIELDS = [
  'Index Name',
  'Index Date',
  'Open Index Value',
  'High Index Value',
  'Low Index Value',
  'Closing Index Value',
  'Points Change',
  'Change(%)',
  'Volume',
  'Turnover (Rs. Cr.)',
  'P/E',
  'P/B',
  'Div Yield',
] as const;
const Decimal = z.string().regex(/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,8})?$/);
const Signed = z.string().regex(/^-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,8})?$/);
const Row = z.strictObject({
  name: z.enum(INDEX_LEVEL_NAMES),
  sourceRow: z.number().int().min(2),
  open: Decimal,
  high: Decimal,
  low: Decimal,
  close: Decimal,
  pointsChange: Signed,
  percentChange: Signed,
  volume: z.string().regex(/^(0|[1-9][0-9]{0,23})$/),
  turnoverCroreInr: Decimal,
  pe: Decimal,
  pb: Decimal,
  dividendYieldPercent: Decimal,
});
export const IndexLevelInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    filename: z.string().regex(/^ind_close_all_\d{8}\.csv$/),
    sourceUrl: z.url(),
    csv: z.string().min(1).max(2_000_000),
    rightsEvidence: z.string().trim().min(20).max(2000),
    rightsConfirmed: z.literal(true),
  })
  .superRefine((value, context) => {
    if (!indexSource(value.sourceUrl, value.filename))
      context.addIssue({
        code: 'custom',
        message: 'Use the original dated NSE/Nifty daily snapshot URL.',
      });
  });
function indexSource(url: string, filename: string) {
  return [
    'https://archives.nseindia.com/content/indices/',
    'https://nsearchives.nseindia.com/content/indices/',
    'https://www.niftyindices.com/Daily_Snapshot/',
  ].some((prefix) => url === prefix + filename);
}
function scaled(value: string) {
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
export const IndexLevelEditionSchema = z
  .strictObject({
    id: z.uuid(),
    effectiveOn: z.iso.date(),
    retrievedAt: z.iso.datetime(),
    sourceUrl: z.url(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    filename: z.string().regex(/^ind_close_all_\d{8}\.csv$/),
    policy: z.literal('nse-daily-price-index-levels-v1'),
    unit: z.literal('index_points'),
    rows: z.array(Row).length(3),
    reviewedAt: z.iso.datetime().nullable(),
    interpretation: z.literal(
      'Daily price-index levels, not total returns, constituent history, an investable price or a portfolio recommendation.',
    ),
  })
  .superRefine((value, context) => {
    const day = value.effectiveOn;
    const validNumbers = value.rows.every((row) =>
      [row.low, row.open, row.close, row.high].every(
        (number) => Decimal.safeParse(number).success,
      ),
    );
    const validRanges =
      validNumbers &&
      value.rows.every(
        (row) =>
          scaled(row.low) <= scaled(row.open) &&
          scaled(row.low) <= scaled(row.close) &&
          scaled(row.high) >= scaled(row.open) &&
          scaled(row.high) >= scaled(row.close) &&
          scaled(row.low) > 0n,
      );
    if (
      value.filename !==
        `ind_close_all_${day.slice(8, 10)}${day.slice(5, 7)}${day.slice(0, 4)}.csv` ||
      !indexSource(value.sourceUrl, value.filename) ||
      day > value.retrievedAt.slice(0, 10) ||
      (value.reviewedAt !== null && value.reviewedAt < value.retrievedAt) ||
      new Set(value.rows.map((row) => row.name)).size !== 3 ||
      !validRanges
    )
      context.addIssue({
        code: 'custom',
        message:
          'Source dates, distinct index identities and positive OHLC ranges must reconcile.',
      });
  });
export const IndexLevelReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
  rightsVerified: z.boolean(),
});
export const IndexLevelCaptureSchema = z.strictObject({
  id: z.uuid(),
  state: z.enum(['retained', 'quarantined']),
  reason: z.string().nullable(),
});
export const IndexLevelCursorSchema = z
  .string()
  .max(80)
  .refine((value) => {
    const parts = value.split('|');
    return (
      parts.length === 2 &&
      z.iso.datetime().safeParse(parts[0]).success &&
      z.uuid().safeParse(parts[1]).success
    );
  }, 'Use the exact index capture continuation cursor.');
export const IndexLevelQueueQuerySchema = z.strictObject({
  cursor: IndexLevelCursorSchema.optional(),
});
export const IndexLevelQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        source_hash: z.string(),
        error: z.string().nullable(),
        receipt: IndexLevelEditionSchema.nullable(),
        state: z.enum(['draft', 'publish', 'withdraw', 'quarantined']),
      }),
    )
    .max(20),
  nextCursor: IndexLevelCursorSchema.nullable(),
});
export const IndexLevelQuerySchema = z.strictObject({
  before: z.iso.date().optional(),
});
export const IndexLevelPublicSchema = z
  .strictObject({
    editions: z.array(IndexLevelEditionSchema).max(1000),
    capturedAt: z.iso.datetime(),
    nextBefore: z.iso.date().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.editions.some(
        (edition, index) =>
          !edition.reviewedAt ||
          (index > 0 &&
            value.editions[index - 1]!.effectiveOn <= edition.effectiveOn),
      ) ||
      (value.nextBefore !== null &&
        value.nextBefore !== value.editions.at(-1)?.effectiveOn)
    )
      context.addIssue({
        code: 'custom',
        message:
          'History must contain distinct descending independently reviewed days and an exact continuation date.',
      });
  });
function number(value: string, signed = false) {
  const normalized = value
    .trim()
    .replace(/^(-?)\./, (_match, sign: string) => sign + '0.');
  return (signed ? Signed : Decimal).parse(normalized);
}
/** Verified 18Sep2026 official CSV grammar; other index names remain in retained originals only. */
export function parseIndexLevels(
  raw: unknown,
  sourceHash: string,
  retrievedAt: string,
) {
  const input = IndexLevelInputSchema.parse(raw);
  const csv = equityCsv(input.csv);
  if (
    csv.rows.length < 3 ||
    csv.rows.length > 1000 ||
    JSON.stringify(csv.header) !== JSON.stringify(INDEX_LEVEL_FIELDS)
  )
    throw Error('Unsupported daily snapshot header or row count.');
  const token = input.filename.slice('ind_close_all_'.length, -4);
  const effectiveOn = z.iso
    .date()
    .parse(`${token.slice(4)}-${token.slice(2, 4)}-${token.slice(0, 2)}`);
  const date = `${token.slice(0, 2)}-${token.slice(2, 4)}-${token.slice(4)}`;
  const rows: z.infer<typeof Row>[] = [];
  const names = new Set<string>();
  for (const [offset, cells] of csv.rows.entries()) {
    const name = cells[0];
    if (
      cells.length !== 13 ||
      cells[1] !== date ||
      !name ||
      !name.trim() ||
      names.has(name)
    )
      throw Error(
        'Every snapshot row needs a distinct name, exact report date and13 fields.',
      );
    names.add(name);
    if (!INDEX_LEVEL_NAMES.includes(name as (typeof INDEX_LEVEL_NAMES)[number]))
      continue;
    rows.push(
      Row.parse({
        name,
        sourceRow: offset + 2,
        open: number(cells[2]!),
        high: number(cells[3]!),
        low: number(cells[4]!),
        close: number(cells[5]!),
        pointsChange: number(cells[6]!, true),
        percentChange: number(cells[7]!, true),
        volume: cells[8],
        turnoverCroreInr: number(cells[9]!),
        pe: number(cells[10]!),
        pb: number(cells[11]!),
        dividendYieldPercent: number(cells[12]!),
      }),
    );
  }
  return IndexLevelEditionSchema.parse({
    id: input.requestId,
    effectiveOn,
    retrievedAt,
    sourceUrl: input.sourceUrl,
    sourceHash,
    filename: input.filename,
    policy: 'nse-daily-price-index-levels-v1',
    unit: 'index_points',
    rows,
    reviewedAt: null,
    interpretation:
      'Daily price-index levels, not total returns, constituent history, an investable price or a portfolio recommendation.',
  });
}
