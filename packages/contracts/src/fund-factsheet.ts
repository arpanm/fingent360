import { z } from 'zod';
export const FACTSHEET_PARSER = 'kotak-omni-factsheet-ber-v1';
export const FACTSHEET_SCHEME = 'Kotak Multi Asset Omni FOF';
export const FactsheetUrlSchema = z
  .url()
  .refine((value) =>
    /^https:\/\/www\.kotakmf\.com\/factsheet\/(January|February|March|April|May|June|July|August|September|October|November|December)_20\d{2}\/kotak\/ASSET-ALLOCATOR\.html$/.test(
      value,
    ),
  );
const decimal = z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const FactsheetValuesSchema = z
  .strictObject({
    scheme: z.literal(FACTSHEET_SCHEME),
    observedOn: z.iso.date(),
    aumCrore: decimal,
    averageAumCrore: decimal,
    expenseBasis: z.literal(
      'base-expense-ratio-excludes-brokerage-transaction-costs',
    ),
    plans: z
      .array(
        z.strictObject({
          plan: z.enum(['Direct', 'Regular']),
          schemePercent: decimal,
          underlyingPercent: decimal,
          combinedPercent: decimal,
        }),
      )
      .length(2),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.plans.map((plan) => plan.plan)).size !== 2)
      ctx.addIssue({
        code: 'custom',
        message: 'Both distinct fee plans are required.',
      });
    for (const plan of value.plans) {
      if (
        [plan.schemePercent, plan.underlyingPercent, plan.combinedPercent].some(
          (amount) => BigInt(amount.replace('.', '')) > 10000n,
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Expense percentages must stay within0–100.',
        });
      if (
        BigInt(plan.schemePercent.replace('.', '')) +
          BigInt(plan.underlyingPercent.replace('.', '')) !==
        BigInt(plan.combinedPercent.replace('.', ''))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Base expense components do not reconcile.',
        });
    }
  });
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const units = (value: string) => BigInt(value.replace('.', ''));
export function parseKotakFactsheet(html: string, sourceUrl: string) {
  FactsheetUrlSchema.parse(sourceUrl);
  if (new TextEncoder().encode(html).length > 1000000)
    throw Error('Factsheet exceeds1MB.');
  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const plain = text(html);
  if (
    !/KOTAK MULTI ASSET OMNI FOF/.test(plain) ||
    !/Base Expense Ratio \(BER\)/.test(plain) ||
    !/excludes brokerage, transaction costs and related statutory levies/.test(
      plain,
    )
  )
    throw Error('Unsupported factsheet scheme or expense basis.');
  const dates = [
    ...plain.matchAll(
      /Data as on (\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+), (20\d{2}) unless otherwise specified\./g,
    ),
  ];
  if (dates.length !== 1)
    throw Error('Missing or ambiguous factsheet effective date.');
  const [, d, month, y] = dates[0]!;
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
  const m = months.indexOf(month!) + 1;
  if (!m || !sourceUrl.includes(`/${month}_${y}/`))
    throw Error('Source month and factsheet date disagree.');
  const observedOn = z.iso
    .date()
    .parse(`${y}-${String(m).padStart(2, '0')}-${d!.padStart(2, '0')}`);
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      text(cell[1]!),
    ),
  );
  function fundSize(label: string) {
    const matches = rows.filter((row) => row[0] === label);
    if (matches.length !== 1 || matches[0]!.length !== 2)
      throw Error('Missing or ambiguous ' + label);
    const value = matches[0]![1]!.match(
      /^Rs\s*((?:\d+|\d{1,3}(?:,\d{3})+))\.([0-9]{2})\s*crs$/,
    );
    if (!value) throw Error('Unsupported fund size unit.');
    return decimal.parse(value[1]!.replace(/,/g, '') + '.' + value[2]);
  }
  const start = html.indexOf('Month End Expense Ratio');
  if (start < 0 || html.indexOf('Month End Expense Ratio', start + 1) >= 0)
    throw Error('Ambiguous expense table.');
  const table = html
    .slice(start)
    .match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table || !text(table).includes('Underlying Funds** (Dir Plan)'))
    throw Error('Underlying fee definition changed.');
  const feeRows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (row) =>
      [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
        text(cell[1]!),
      ),
  );
  const plans = (['Direct', 'Regular'] as const).map((plan) => {
    const matches = feeRows.filter((row) => row[0] === plan);
    if (matches.length !== 1 || matches[0]!.length !== 4)
      throw Error('Missing or repeated fee plan.');
    const values = matches[0]!
      .slice(1)
      .map((value) => decimal.parse(value.replace(/%$/, '')));
    const [schemePercent, underlyingPercent, combinedPercent] = values as [
      string,
      string,
      string,
    ];
    if (
      units(schemePercent) + units(underlyingPercent) !==
      units(combinedPercent)
    )
      throw Error('Scheme and underlying base expenses do not reconcile.');
    return { plan, schemePercent, underlyingPercent, combinedPercent };
  });
  return FactsheetValuesSchema.parse({
    scheme: FACTSHEET_SCHEME,
    observedOn,
    aumCrore: fundSize('AUM'),
    averageAumCrore: fundSize('AAUM'),
    expenseBasis: 'base-expense-ratio-excludes-brokerage-transaction-costs',
    plans,
  });
}
