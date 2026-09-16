import { z } from 'zod';
import { EquityCompanySchema } from './equity-coverage.js';
export const EquityPriceRangeSchema = z
  .strictObject({
    from: z.iso.date(),
    to: z.iso.date(),
    after: z.iso.date().nullable().default(null),
    limit: z.number().int().min(1).max(31).default(15),
  })
  .superRefine((value, ctx) => {
    if (
      value.from > value.to ||
      Date.parse(value.to) - Date.parse(value.from) > 365 * 86400000
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a price range of at most366 calendar days.',
      });
    if (value.after && (value.after < value.from || value.after > value.to))
      ctx.addIssue({
        code: 'custom',
        message: 'Price cursor must stay within the selected range.',
      });
  });
const record = EquityCompanySchema.shape.records.element.refine(
  (value) => value.observation.kind === 'price',
  'Price history cannot contain another observation kind.',
);
export const EquityPriceHistorySchema = z.strictObject({
  isin: z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/),
  from: z.iso.date(),
  to: z.iso.date(),
  capturedAt: z.iso.datetime(),
  days: z
    .array(
      z.strictObject({
        on: z.iso.date(),
        records: z.array(record).min(1).max(1000),
        status: z.enum(['retained', 'conflicting-revisions']),
      }),
    )
    .max(31),
  nextAfter: z.iso.date().nullable(),
  datesWithoutCapture: z.array(z.iso.date()).max(366),
  coverageBasis: z.literal('retained-calendar-dates-not-a-trading-calendar'),
  adjustment: z.literal('unadjusted'),
});
const price = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
export function buildEquityPriceHistory(
  isin: string,
  records: ReturnType<typeof EquityCompanySchema.parse>['records'],
  range: ReturnType<typeof EquityPriceRangeSchema.parse>,
  capturedAt: string,
) {
  range = EquityPriceRangeSchema.parse(range);
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    if (record.observation.kind !== 'price' || record.observation.isin !== isin)
      throw Error(
        'Price history source contains another instrument or record kind.',
      );
    const on = record.observation.effectiveOn;
    if (on < range.from || on > range.to) continue;
    const group = groups.get(on) ?? [];
    group.push(record);
    groups.set(on, group);
  }
  const dates = [...groups.keys()]
    .sort()
    .reverse()
    .filter((on) => !range.after || on < range.after);
  const selected = dates.slice(0, range.limit);
  const days = selected.map((on) => {
    const records = groups
      .get(on)!
      .sort(
        (a, b) =>
          a.editionId.localeCompare(b.editionId) ||
          a.observation.sourceRow - b.observation.sourceRow,
      );
    const exchanges = new Map<string, Set<string>>();
    for (const row of records) {
      if (row.observation.kind !== 'price') continue;
      const values =
        exchanges.get(row.observation.exchange) ?? new Set<string>();
      values.add(price(row.observation.close).toString());
      exchanges.set(row.observation.exchange, values);
    }
    return {
      on,
      records,
      status: [...exchanges.values()].some((values) => values.size > 1)
        ? 'conflicting-revisions'
        : 'retained',
    };
  });
  const datesWithoutCapture = [];
  for (
    let at = Date.parse(range.from);
    at <= Date.parse(range.to);
    at += 86400000
  ) {
    const on = new Date(at).toISOString().slice(0, 10);
    if (!groups.has(on)) datesWithoutCapture.push(on);
  }
  return EquityPriceHistorySchema.parse({
    isin,
    from: range.from,
    to: range.to,
    capturedAt,
    days,
    nextAfter: dates.length > range.limit ? selected.at(-1) : null,
    datesWithoutCapture,
    coverageBasis: 'retained-calendar-dates-not-a-trading-calendar',
    adjustment: 'unadjusted',
  });
}
