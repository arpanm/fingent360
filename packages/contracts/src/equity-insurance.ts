import { z } from 'zod';
export const NSE_GI_PARSER = 'nse-rendered-general-insurance-v1';
export const GI_LABELS = {
  'insurance-gross-written-premium': 'Gross Premiums Written',
  'insurance-net-written-premium': 'Net Premium written',
  'insurance-earned-premium': 'Premium Earned (Net)',
  'insurance-operating-investment-income': 'Income from investments (net)',
  'insurance-other-operating-income': 'Total other income',
  'insurance-total-operating-income': 'Total income',
  'insurance-net-commission': 'Net commission',
  'insurance-operating-expenses':
    'Total operating expenses related to insurance business',
  'insurance-premium-deficiency': 'Premium Deficiency',
  'insurance-claims-paid': 'Claims Paid',
  'insurance-outstanding-claims-change':
    'Change in Outstanding Claims (incl. IBNR/IBNER)',
  'insurance-incurred-claims': 'Total Incurred claims',
  'insurance-total-expense': 'Total Expense',
  'insurance-underwriting-result': 'Underwriting Profit(Loss)',
  'insurance-doubtful-debt-provision':
    'Provisions for doubtful debts (including bad debts written off)',
  'insurance-investment-provision':
    'Provisions for diminution in value of investments',
  'insurance-operating-result': 'Operating Profit/loss:',
} as const;
export const GiMetricSchema = z.enum(
  Object.keys(GI_LABELS) as [
    keyof typeof GI_LABELS,
    ...(keyof typeof GI_LABELS)[],
  ],
);
const decimal = z.string().regex(/^-?(0|[1-9]\d{0,20})(\.\d{1,8})?$/);
const exact = (value: string) => {
  const negative = value.startsWith('-'),
    [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  return (
    (BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'))) *
    (negative ? -1n : 1n)
  );
};
export const GiContextSchema = z
  .strictObject({
    policy: z.literal(NSE_GI_PARSER),
    captureBasis: z.literal('uploaded-rendered-nse-report'),
    section: z.literal('general-insurance-operating-results'),
    boardApprovedOn: z.iso.date(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    basis: z.enum(['standalone', 'consolidated']),
    audited: z.boolean(),
    scale: z.enum(['rupees', 'thousands', 'lakhs', 'crores']),
    reportingColumns: z
      .array(z.enum(['current-quarter', 'year-to-date']))
      .min(1)
      .max(2),
    amounts: z.record(GiMetricSchema, decimal),
    ratios: z.strictObject({
      solvencyTimes: decimal,
      incurredClaimPercent: decimal,
      combinedPercent: decimal,
    }),
  })
  .superRefine((value, ctx) => {
    if (
      Object.values(value.amounts).some(
        (item) => !decimal.safeParse(item).success,
      ) ||
      Object.values(value.ratios).some(
        (item) => !decimal.safeParse(item).success,
      )
    )
      return;
    const a = (key: keyof typeof GI_LABELS) => exact(value.amounts[key]);
    if (
      a('insurance-earned-premium') +
        a('insurance-operating-investment-income') +
        a('insurance-other-operating-income') !==
        a('insurance-total-operating-income') ||
      a('insurance-claims-paid') + a('insurance-outstanding-claims-change') !==
        a('insurance-incurred-claims') ||
      a('insurance-net-commission') +
        a('insurance-operating-expenses') +
        a('insurance-premium-deficiency') +
        a('insurance-incurred-claims') !==
        a('insurance-total-expense') ||
      a('insurance-earned-premium') - a('insurance-total-expense') !==
        a('insurance-underwriting-result') ||
      a('insurance-total-operating-income') -
        a('insurance-total-expense') -
        a('insurance-doubtful-debt-provision') -
        a('insurance-investment-provision') !==
        a('insurance-operating-result')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Insurance operating and claims totals do not reconcile.',
      });
    if (new Set(value.reportingColumns).size !== value.reportingColumns.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate reporting column role.',
      });
    if (Object.values(value.ratios).some((ratio) => exact(ratio) < 0n))
      ctx.addIssue({
        code: 'custom',
        message: 'Reported insurance ratios cannot be negative.',
      });
  });
export function isNseGiSource(url: string) {
  const source = new URL(url);
  return (
    source.protocol === 'https:' &&
    source.hostname === 'nsearchives.nseindia.com' &&
    !source.port &&
    !source.username &&
    !source.password &&
    !source.search &&
    !source.hash &&
    /^\/corporate\/ixbrl\/INTEGRATED_FILING_GI_\d+_\d+_iXBRL_WEB\.html$/.test(
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
function rows(table: string) {
  if (/<table\b/i.test(table)) throw Error('Nested GI table unsupported.');
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      clean(cell[1]!),
    ),
  );
}
function cells(data: string[][], label: string, position: number) {
  const matches = data.filter((row) => row.includes(label));
  if (matches.length !== 1 || matches[0]!.indexOf(label) !== position)
    throw Error(`Missing, shifted or duplicate GI field: ${label}`);
  return matches[0]!.slice(position + 1);
}
function day(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw Error('GI dates require DD-MM-YYYY.');
  return z.iso.date().parse(`${match[3]}-${match[2]}-${match[1]}`);
}
function amount(value: string) {
  const negative = /^\([\d,.]+\)$/.test(value),
    raw = negative ? value.slice(1, -1) : value;
  if (
    !/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d?(?:,\d{2})*,\d{3})(?:\.\d{1,8})?$/.test(
      raw,
    )
  )
    throw Error('Unsupported GI decimal.');
  return decimal.parse(`${negative ? '-' : ''}${raw.replaceAll(',', '')}`);
}
export function parseNseGi(body: string, effectiveOn: string) {
  z.iso.date().parse(effectiveOn);
  if (
    !body ||
    body.length > 2000000 ||
    /<(?:script|iframe|object|embed)\b|<!ENTITY/i.test(body)
  )
    throw Error('Unsafe or oversized GI source.');
  const tables = [...body.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  const general = tables.filter((table) =>
    /\bclass\s*=\s*["'][^"']*\bgITabl\b/.test(table[1]!),
  );
  if (
    general.length !== 1 ||
    !body.includes('INTEGRATED FILING') ||
    !body.includes(
      'Format for financial results by general insurance companies filed with stock exchanges',
    )
  )
    throw Error('Unsupported rendered GI report.');
  const info = rows(general[0]![2]!);
  const scalar = (label: string) => {
    const value = cells(info, label, 0);
    if (value.length !== 1) throw Error('GI metadata columns changed.');
    return value[0]!;
  };
  const isin = z
    .string()
    .regex(/^IN[A-Z0-9]{9}[0-9]$/)
    .parse(scalar('ISIN'));
  if (scalar('Description of presentation currency') !== 'INR')
    throw Error('GI monetary amounts require explicit INR.');
  const boardApprovedOn = day(
    scalar('Date of board meeting when results were approved'),
  );
  if (boardApprovedOn > effectiveOn)
    throw Error('GI effective date precedes approval.');
  const scales = {
      Rupees: 'rupees',
      Thousands: 'thousands',
      Lakhs: 'lakhs',
      Crores: 'crores',
    } as const,
    rounding = scalar('Level of rounding used in financial results');
  if (!(rounding in scales)) throw Error('Unknown GI rounding scale.');
  const scale = scales[rounding as keyof typeof scales];
  const operating = tables.filter((table) =>
      rows(table[2]!).some((row) => row.includes('OPERATING RESULTS')),
    ),
    analytical = tables.filter((table) =>
      rows(table[2]!).some((row) => row.includes('Analytical Ratios')),
    );
  if (operating.length !== 1 || analytical.length !== 1)
    throw Error('GI operating and analytical tables must be unambiguous.');
  const before = body.slice(
    general[0]!.index! + general[0]![0].length,
    operating[0]!.index,
  );
  if (!before.includes(`Amount in (${rounding})`))
    throw Error('GI table and metadata scales differ.');
  if (
    !/Solvency ratio are in times and other ratios mentioned below are in %/i.test(
      clean(body),
    )
  )
    throw Error(
      'GI solvency-times and percent interpretation requires its explicit source note.',
    );
  const data = rows(operating[0]![2]!);
  if (data[0]?.join('|') !== 'Partiuclars|Current Quarter|Year to Date Figures')
    throw Error('GI reporting column roles changed.');
  const ratioRows = rows(analytical[0]![2]!);
  const starts = cells(data, 'Date of start of reporting period', 0),
    ends = cells(data, 'Date of end of reporting period', 0),
    bases = cells(data, 'Nature of report standalone or consolidated', 0),
    audits = cells(data, 'Whether results are audited or unaudited', 0);
  const values = Object.fromEntries(
    Object.entries(GI_LABELS).map(([key, label]) => [
      key,
      cells(data, label, 1),
    ]),
  );
  const ratios = {
    solvencyTimes: cells(ratioRows, 'Solvency ratio', 1),
    incurredClaimPercent: cells(ratioRows, 'Incurred Claim Ratio', 1),
    combinedPercent: cells(ratioRows, 'Combined ratio', 1),
  };
  if (
    starts.length !== 2 ||
    [
      ends,
      bases,
      audits,
      ...Object.values(values),
      ...Object.values(ratios),
    ].some((value) => value.length !== 2)
  )
    throw Error('GI current-quarter/year-to-date columns changed.');
  const contexts = starts.map((start, column) => {
    const periodStart = day(start),
      periodEnd = day(ends[column]!);
    if (periodStart > periodEnd || periodEnd > boardApprovedOn)
      throw Error('Invalid GI reporting period.');
    return GiContextSchema.parse({
      policy: NSE_GI_PARSER,
      captureBasis: 'uploaded-rendered-nse-report',
      section: 'general-insurance-operating-results',
      boardApprovedOn,
      periodStart,
      periodEnd,
      basis: z
        .enum(['Standalone', 'Consolidated'])
        .parse(bases[column])
        .toLowerCase(),
      audited:
        z.enum(['Audited', 'Unaudited']).parse(audits[column]) === 'Audited',
      scale,
      reportingColumns: [column === 0 ? 'current-quarter' : 'year-to-date'],
      amounts: Object.fromEntries(
        Object.entries(values).map(([key, values]) => [
          key,
          amount(values[column]!),
        ]),
      ),
      ratios: Object.fromEntries(
        Object.entries(ratios).map(([key, values]) => [
          key,
          amount(values[column]!),
        ]),
      ),
    });
  });
  if (
    contexts[0]!.periodStart === contexts[1]!.periodStart &&
    contexts[0]!.periodEnd === contexts[1]!.periodEnd
  ) {
    if (
      JSON.stringify({ ...contexts[0], reportingColumns: [] }) !==
      JSON.stringify({ ...contexts[1], reportingColumns: [] })
    )
      throw Error('Repeated GI quarter/YTD columns disagree.');
    contexts[0]!.reportingColumns = ['current-quarter', 'year-to-date'];
    contexts.pop();
  }
  return contexts.flatMap((insuranceContext) =>
    (Object.entries(GI_LABELS) as [keyof typeof GI_LABELS, string][]).map(
      ([metric, label]) => ({
        kind: 'fundamental' as const,
        isin,
        effectiveOn,
        sourceRow: data.findIndex((row) => row.includes(label)) + 1,
        metric,
        periodStart: insuranceContext.periodStart,
        periodEnd: insuranceContext.periodEnd,
        basis: insuranceContext.basis,
        currency: 'INR' as const,
        scale,
        value: insuranceContext.amounts[metric],
        audited: insuranceContext.audited,
        insuranceContext,
      }),
    ),
  );
}
// Shared lexical readers; calling adapters still enforce their own verified tables and account meanings.
export {
  clean as renderedFinancialText,
  rows as renderedFinancialRows,
  cells as renderedFinancialCells,
  day as renderedFinancialDay,
  amount as renderedFinancialAmount,
};
