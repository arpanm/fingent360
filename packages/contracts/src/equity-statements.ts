import { z } from 'zod';
import { parseNseIndasHtml } from './equity-fundamentals.js';
export const NSE_INDAS_STATEMENTS_PARSER =
  'nse-integrated-indas-statements-html-v2';
const decimal = z.string().regex(/^-?(0|[1-9]\d{0,23})(\.\d{1,8})?$/);
const scaled = (value: string) => {
  const negative = value.startsWith('-'),
    [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return BigInt(whole! + fraction.padEnd(8, '0')) * (negative ? -1n : 1n);
};
const balanceMetrics = [
  'total-assets',
  'total-liabilities',
  'equity',
  'balance-sheet-cash',
  'borrowings-current',
  'borrowings-noncurrent',
  'equity-and-liabilities',
] as const;
const cashMetrics = [
  'operating-cash-flow',
  'investing-cash-flow',
  'financing-cash-flow',
  'cash-change-before-fx',
  'cash-fx-effect',
  'net-cash-change',
  'cash-flow-opening',
  'cash-flow-closing',
] as const;
export const StatementContextSchema = z
  .discriminatedUnion('section', [
    z
      .object({
        section: z.literal('balance-sheet'),
        policy: z.literal('reported-totals-exact-v1'),
        values: z.record(z.enum(balanceMetrics), decimal),
      })
      .strict(),
    z
      .object({
        section: z.literal('cash-flow'),
        policy: z.literal('reported-totals-exact-v1'),
        values: z.record(z.enum(cashMetrics), decimal),
      })
      .strict(),
  ])
  .superRefine((context, issue) => {
    const expected =
      context.section === 'balance-sheet' ? balanceMetrics : cashMetrics;
    if (
      !expected.every(
        (metric) =>
          decimal.safeParse((context.values as Record<string, string>)[metric])
            .success,
      )
    )
      return;
    const values: Record<string, string> = context.values,
      v = (name: string) => scaled(values[name]!);
    const correct =
      context.section === 'balance-sheet'
        ? v('total-assets') === v('equity') + v('total-liabilities') &&
          v('total-assets') === v('equity-and-liabilities')
        : v('operating-cash-flow') +
            v('investing-cash-flow') +
            v('financing-cash-flow') ===
            v('cash-change-before-fx') &&
          v('cash-change-before-fx') + v('cash-fx-effect') ===
            v('net-cash-change') &&
          v('cash-flow-opening') + v('net-cash-change') ===
            v('cash-flow-closing');
    const validSigns =
      context.section !== 'balance-sheet' ||
      balanceMetrics
        .filter((metric) => metric !== 'equity')
        .every((metric) => v(metric) >= 0n);
    if (!correct || !validSigns)
      issue.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Reported statement totals do not reconcile exactly in their original units.',
      });
  });
export function statementValue(
  context: z.infer<typeof StatementContextSchema>,
  metric: string,
) {
  return (context.values as Record<string, string>)[metric];
}
const balanceLabels = [
  'Total assets',
  'Total liabilities',
  'Total equity',
  'Cash and cash equivalents',
  'Borrowings, current',
  'Borrowings, non-current',
  'Total equity and liabilites',
];
const cashLabels = [
  'Net cash flows from (used in) operating activities',
  'Net cash flows from (used in) investing activities',
  'Net cash flows from (used in) financing activities',
  'Net increase (decrease) in cash and cash equivalents before effect of exchange rate changes',
  'Effect of exchange rate changes on cash and cash equivalents',
  'Net increase (decrease) in cash and cash equivalents',
  'Cash and cash equivalents cash flow statement at beginning of period',
  'Cash and cash equivalents cash flow statement at end of period',
];
const clean = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
function amount(value: string) {
  const negative = /^\([\d,.]+\)$/.test(value),
    raw = negative ? value.slice(1, -1) : value;
  if (!/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,8})?$/.test(raw))
    throw Error('An explicit reported exact decimal is required.');
  return decimal.parse((negative ? '-' : '') + raw.replaceAll(',', ''));
}
function day(value: string) {
  const match = /^(\d{2})-(\d{2})-(20\d{2})$/.exec(value);
  if (!match) throw Error('Statement dates require DD-MM-YYYY.');
  return z.iso.date().parse(`${match[3]}-${match[2]}-${match[1]}`);
}
export function parseNseIndasStatements(body: string, effectiveOn: string) {
  const income = parseNseIndasHtml(body, effectiveOn),
    metadata = income[0];
  if (!metadata) throw Error('Original financial metadata required.');
  const sections = [
    {
      heading: 'Statement of Asset and Liabilities',
      section: 'balance-sheet' as const,
      metrics: balanceMetrics,
      labels: balanceLabels,
    },
    {
      heading: 'Cash flow statement, indirect',
      section: 'cash-flow' as const,
      metrics: cashMetrics,
      labels: cashLabels,
    },
  ];
  const result: Array<
    Omit<typeof metadata, 'metric'> & {
      metric: string;
      statementContext?: z.infer<typeof StatementContextSchema>;
    }
  > = [...income];
  for (const section of sections) {
    const headings = [...body.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].filter(
      (match) => clean(match[1]!) === section.heading,
    );
    if (headings.length !== 1)
      throw Error('One supported statement section required.');
    const start = (headings[0]!.index ?? 0) + headings[0]![0].length,
      tail = body.slice(start),
      table = /<table\b([^>]*)>([\s\S]*?)<\/table>/i.exec(tail);
    if (
      !table ||
      !/\bgridtable\b/.test(table[1]!) ||
      /<table\b/i.test(table[2]!)
    )
      throw Error('Unsupported financial statement table.');
    const scales = {
      rupees: 'Rupees',
      thousands: 'Thousands',
      lakhs: 'Lakhs',
      crores: 'Crores',
    };
    if (
      clean(tail.slice(0, table.index)) !==
      `Amount in (${scales[metadata.scale]})`
    )
      throw Error(
        'Statement amount scale differs from original financial metadata.',
      );
    const rows = [...table[2]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
      (row) =>
        [
          ...row[1]!.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi),
        ].map((cell) => clean(cell[1]!)),
    );
    const field = (label: string) => {
      const matches = rows
        .map((row, index) => ({
          index,
          values: row.includes(label) ? row.slice(row.indexOf(label) + 1) : [],
        }))
        .filter((row) => row.values.some((value) => value !== ''));
      if (matches.length !== 1)
        throw Error(`Missing or duplicate statement value: ${label}`);
      return matches[0]!;
    };
    const starts = field('Date of start of reporting period').values,
      ends = field('Date of end of reporting period').values,
      audits = field('Whether results are audited or unaudited').values,
      bases = field('Nature of report standalone or consolidated').values;
    const fields = section.labels.map(field);
    if (
      !starts.length ||
      starts.length > 12 ||
      [ends, audits, bases, ...fields.map((row) => row.values)].some(
        (values) => values.length !== starts.length,
      )
    )
      throw Error('Statement column widths differ.');
    for (let column = 0; column < starts.length; column++) {
      const periodStart = day(starts[column]!),
        periodEnd = day(ends[column]!),
        basis = z
          .enum(['Standalone', 'Consolidated'])
          .parse(bases[column])
          .toLowerCase() as 'standalone' | 'consolidated',
        audited =
          z.enum(['Audited', 'Unaudited']).parse(audits[column]) === 'Audited';
      if (periodStart > periodEnd || periodEnd > effectiveOn)
        throw Error('Invalid statement reporting period.');
      if (
        !income.some(
          (row) =>
            row.periodStart === periodStart &&
            row.periodEnd === periodEnd &&
            row.basis === basis &&
            row.audited === audited,
        )
      )
        throw Error(
          'Statement context must agree with an explicit income-statement reporting column.',
        );
      const values = Object.fromEntries(
        section.metrics.map((metric, index) => [
          metric,
          amount(fields[index]!.values[column]!),
        ]),
      );
      const statementContext = StatementContextSchema.parse({
        section: section.section,
        policy: 'reported-totals-exact-v1',
        values,
      });
      for (const [index, metric] of section.metrics.entries())
        result.push({
          ...metadata,
          metric,
          periodStart,
          periodEnd,
          basis,
          audited,
          value: values[metric]!,
          sourceRow: fields[index]!.index + 1,
          statementContext,
        });
    }
  }
  return result;
}
