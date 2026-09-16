import { z } from 'zod';
export const NSE_BANKING_PARSER = 'nse-rendered-banking-v1';
export const BANK_AMOUNT_LABELS = {
  'bank-interest-earned': 'Total interest earned',
  'bank-other-income': 'Other income',
  'bank-total-income': 'Total income',
  'bank-interest-expense': 'Interest expenses',
  'bank-operating-expenses': 'Total Operating Expenses',
  'bank-total-expenditure':
    'Total expenditure excluding provisions and contingencies',
  'bank-operating-profit':
    'Operating profit before provision and contingencies',
  'bank-provisions': 'Provisions other than tax and contingencies',
  'bank-profit-before-tax':
    'Total profit (loss) from ordinary activities before tax',
  'bank-tax': 'Provision for Tax',
  'bank-ordinary-profit-after-tax':
    'Net profit (loss) from ordinary activities after tax',
  'bank-gross-npa': 'Amount of gross non-performing assets',
  'bank-net-npa': 'Amount of net non-performing assets',
} as const;
export const BANK_RATIO_LABELS = {
  cet1: 'CET 1 ratio',
  additionalTier1: 'Additional Tier 1 ratio',
  grossNpa: '% of gross NPAs',
  netNpa: '% of net NPAs',
} as const;
export const BankMetricSchema = z.enum(
  Object.keys(BANK_AMOUNT_LABELS) as [
    keyof typeof BANK_AMOUNT_LABELS,
    ...(keyof typeof BANK_AMOUNT_LABELS)[],
  ],
);
const decimal = z.string().regex(/^-?(0|[1-9]\d{0,20})(\.\d{1,8})?$/);
function exact(value: string) {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  return (
    BigInt(whole!) * 100000000n * (negative ? -1n : 1n) +
    BigInt(fraction.padEnd(8, '0')) * (negative ? -1n : 1n)
  );
}
export const BankContextSchema = z
  .strictObject({
    policy: z.literal(NSE_BANKING_PARSER),
    captureBasis: z.literal('uploaded-rendered-nse-report'),
    boardApprovedOn: z.iso.date(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    basis: z.enum(['standalone', 'consolidated']),
    audited: z.boolean(),
    scale: z.enum(['rupees', 'thousands', 'lakhs', 'crores']),
    amounts: z.record(BankMetricSchema, decimal),
    ratios: z.strictObject({
      unit: z.literal('percent'),
      cet1: decimal,
      additionalTier1: decimal,
      grossNpa: decimal,
      netNpa: decimal,
    }),
    exceptionalItems: z.literal('0'),
  })
  .superRefine((value, ctx) => {
    if (
      Object.values(value.amounts).some(
        (item) => !decimal.safeParse(item).success,
      ) ||
      Object.entries(value.ratios).some(
        ([key, item]) => key !== 'unit' && !decimal.safeParse(item).success,
      )
    )
      return;
    const amount = (key: keyof typeof BANK_AMOUNT_LABELS) =>
      exact(value.amounts[key]);
    const matches =
      amount('bank-interest-earned') + amount('bank-other-income') ===
        amount('bank-total-income') &&
      amount('bank-interest-expense') + amount('bank-operating-expenses') ===
        amount('bank-total-expenditure') &&
      amount('bank-total-income') - amount('bank-total-expenditure') ===
        amount('bank-operating-profit') &&
      amount('bank-operating-profit') - amount('bank-provisions') ===
        amount('bank-profit-before-tax') &&
      amount('bank-profit-before-tax') - amount('bank-tax') ===
        amount('bank-ordinary-profit-after-tax') &&
      amount('bank-gross-npa') >= amount('bank-net-npa') &&
      amount('bank-net-npa') >= 0n;
    if (!matches)
      ctx.addIssue({
        code: 'custom',
        message: 'Bank income/provision/profit or NPA totals do not reconcile.',
      });
    for (const key of Object.keys(
      BANK_RATIO_LABELS,
    ) as (keyof typeof BANK_RATIO_LABELS)[])
      if (
        exact(value.ratios[key]) < 0n ||
        exact(value.ratios[key]) > 10000000000n
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Reported bank percentage is outside 0–100.',
        });
  });
export function isNseBankingSource(url: string) {
  const source = new URL(url);
  return (
    source.protocol === 'https:' &&
    source.hostname === 'nsearchives.nseindia.com' &&
    !source.port &&
    !source.username &&
    !source.password &&
    !source.search &&
    !source.hash &&
    /^\/corporate\/ixbrl\/INTEGRATED_FILING_BANKING_\d+_\d+_iXBRL_WEB\.html$/.test(
      source.pathname,
    )
  );
}
function clean(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function rows(value: string) {
  if (/<table\b/i.test(value))
    throw Error('Nested banking tables are unsupported.');
  return [...value.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1]!.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(
      (cell) => clean(cell[1]!),
    ),
  );
}
function cells(data: string[][], label: string, position = 1) {
  const found = data.filter((row) => row.includes(label));
  if (found.length !== 1 || found[0]!.indexOf(label) !== position)
    throw Error(`Missing, shifted or duplicate banking field: ${label}`);
  return found[0]!.slice(found[0]!.indexOf(label) + 1);
}
function day(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw Error('Banking dates require DD-MM-YYYY.');
  return z.iso.date().parse(`${match[3]}-${match[2]}-${match[1]}`);
}
function amount(value: string) {
  const negative = /^\([\d,.]+\)$/.test(value);
  const raw = negative ? value.slice(1, -1) : value;
  if (
    !/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d?(?:,\d{2})*,\d{3})(?:\.\d{1,8})?$/.test(
      raw,
    )
  )
    throw Error('Unsupported or missing exact banking decimal.');
  return decimal.parse(`${negative ? '-' : ''}${raw.replaceAll(',', '')}`);
}
export function parseNseBanking(body: string, effectiveOn: string) {
  z.iso.date().parse(effectiveOn);
  if (
    !body ||
    body.length > 2000000 ||
    /<(?:script|iframe|object|embed)\b|<!ENTITY/i.test(body)
  )
    throw Error('Unsafe or oversized banking source.');
  const tables = [...body.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  const metadata = tables.filter((table) =>
    /\bclass\s*=\s*["'][^"']*\bgITable\b/.test(table[1]!),
  );
  const heading = body.indexOf('Financial Results - Banking');
  if (
    metadata.length !== 1 ||
    heading < 0 ||
    !body.includes('INTEGRATED FILING')
  )
    throw Error('Unsupported NSE Banking rendered layout.');
  const general = rows(metadata[0]![2]!);
  const scalar = (label: string) => {
    const values = cells(general, label, 0);
    if (values.length !== 1) throw Error('Bank metadata column count changed.');
    return values[0]!;
  };
  const isin = z
    .string()
    .regex(/^IN[A-Z0-9]{9}[0-9]$/)
    .parse(scalar('ISIN'));
  if (
    !scalar('Name of bank') ||
    scalar('Description of presentation currency') !== 'INR'
  )
    throw Error('Explicit bank identity and INR are required.');
  const boardApprovedOn = day(
    scalar('Date of board meeting when results were approved'),
  );
  if (boardApprovedOn > effectiveOn)
    throw Error('Effective date precedes bank board approval.');
  const scales = {
    Rupees: 'rupees',
    Thousands: 'thousands',
    Lakhs: 'lakhs',
    Crores: 'crores',
  } as const;
  const rounding = scalar('Level of rounding used in financial results');
  if (!(rounding in scales)) throw Error('Unsupported bank amount scale.');
  const scale = scales[rounding as keyof typeof scales];
  const table = tables.find((candidate) => candidate.index! > heading);
  if (
    !table ||
    !/customTablewidth3Col/.test(table[1]!) ||
    !body.slice(heading, table.index).includes(`Amount in (${rounding})`)
  )
    throw Error('Banking financial table or units changed.');
  const data = rows(table[2]!);
  const starts = cells(data, 'Date of start of reporting period'),
    ends = cells(data, 'Date of end of reporting period'),
    bases = cells(data, 'Nature of report standalone or consolidated'),
    audits = cells(data, 'Whether results are audited or unaudited');
  const labels = [
    ...Object.values(BANK_AMOUNT_LABELS),
    ...Object.values(BANK_RATIO_LABELS),
    'Exceptional items',
  ];
  const all = Object.fromEntries(
    labels.map((label) => [label, cells(data, label)]),
  );
  if (
    starts.length !== 2 ||
    [ends, bases, audits, ...Object.values(all)].some(
      (values) => values.length !== 2,
    )
  )
    throw Error('Banking reporting columns changed.');
  return starts.flatMap((start, column) => {
    const periodStart = day(start),
      periodEnd = day(ends[column]!);
    if (periodStart > periodEnd || periodEnd > boardApprovedOn)
      throw Error('Invalid banking reporting period.');
    const basis = z
      .enum(['Standalone', 'Consolidated'])
      .parse(bases[column])
      .toLowerCase() as 'standalone' | 'consolidated';
    const audited =
      z.enum(['Audited', 'Unaudited']).parse(audits[column]) === 'Audited';
    if (exact(amount(all['Exceptional items']![column]!)) !== 0n)
      throw Error(
        'Nonzero exceptional items require a separately verified banking policy.',
      );
    const amounts = Object.fromEntries(
      Object.entries(BANK_AMOUNT_LABELS).map(([key, label]) => [
        key,
        amount(all[label]![column]!),
      ]),
    );
    const ratios = Object.fromEntries(
      Object.entries(BANK_RATIO_LABELS).map(([key, label]) => [
        key,
        amount(all[label]![column]!),
      ]),
    );
    const bankContext = BankContextSchema.parse({
      periodStart,
      periodEnd,
      basis,
      audited,
      scale,
      policy: NSE_BANKING_PARSER,
      captureBasis: 'uploaded-rendered-nse-report',
      boardApprovedOn,
      amounts,
      ratios: { unit: 'percent', ...ratios },
      exceptionalItems: '0',
    });
    return (
      Object.entries(BANK_AMOUNT_LABELS) as [
        keyof typeof BANK_AMOUNT_LABELS,
        string,
      ][]
    ).map(([metric, label]) => ({
      kind: 'fundamental' as const,
      isin,
      effectiveOn,
      sourceRow: data.findIndex((row) => row.includes(label)) + 1,
      metric,
      periodStart,
      periodEnd,
      basis,
      currency: 'INR' as const,
      scale,
      value: bankContext.amounts[metric],
      audited,
      bankContext,
    }));
  });
}
