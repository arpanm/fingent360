import { z } from 'zod';
import {
  renderedFinancialText as clean,
  renderedFinancialRows as rows,
  renderedFinancialCells as cells,
  renderedFinancialDay as day,
  renderedFinancialAmount as amount,
} from './equity-insurance.js';
export const NSE_LI_PARSER = 'nse-rendered-life-insurance-v1';
export const LI_LABELS = {
  'life-policy-net-premium': ['policy', 'Net premium income'],
  'life-policy-investment-income': ['policy', 'Income from investments (Net)'],
  'life-policy-other-income': ['policy', 'Total other income'],
  'life-policy-transfer-from-shareholders': [
    'policy',
    'Transfer Of Funds From Shareholders Account',
  ],
  'life-policy-total-income': ['policy', 'Total Income'],
  'life-policy-management-expenses': ['policy', 'Total Expenses of Management'],
  'life-policy-debt-provision': [
    'policy',
    'Provisions for doubtful debts (including bad debts written off)',
  ],
  'life-policy-investment-provision': [
    'policy',
    'Provisions for diminution in value of investments',
  ],
  'life-policy-linked-gst': [
    'policy',
    'Goods & Service tax charge on linked charges',
  ],
  'life-policy-tax': ['policy', 'Total provision of taxes'],
  'life-policy-benefits-paid': ['policy', 'Benefits Paid (Net)'],
  'life-policy-actuarial-liability-change': [
    'policy',
    'Change in actuarial liability',
  ],
  'life-policy-total-expenses': ['policy', 'Total Expenses'],
  'life-policy-net-surplus': ['policy', 'Net Surplus(Deficit)'],
  'life-policy-transfer-to-shareholders': [
    'appropriations',
    'Transferred to Shareholders A/c',
  ],
  'life-policy-future-appropriation': [
    'appropriations',
    'Funds for Future Appropriation',
  ],
  'life-shareholder-transfer-from-policyholders': [
    'shareholders',
    "Transfer from Poliycholders' Account",
  ],
  'life-shareholder-investment-income': ['shareholders', 'Investment Income'],
  'life-shareholder-other-income': ['shareholders', 'Total Other income'],
  'life-shareholder-total-income': ['shareholders', 'Total Income'],
  'life-shareholder-other-expenses': [
    'shareholders',
    'Expenses other than those related to insurance business',
  ],
  'life-shareholder-transfer-to-policyholders': [
    'shareholders',
    'Transfer of funds to policyholders account',
  ],
  'life-shareholder-debt-provision': [
    'shareholders',
    'Provisions for doubtful debts (including write off)',
  ],
  'life-shareholder-investment-provision': [
    'shareholders',
    'Provisions for diminution in value of investments',
  ],
  'life-shareholder-total-expenses': ['shareholders', 'Total Expenses'],
  'life-shareholder-profit-before-tax': [
    'shareholders',
    'Profit/ (loss) before tax',
  ],
  'life-shareholder-tax': ['shareholders', 'Provisions for tax'],
  'life-shareholder-profit-after-tax': [
    'shareholders',
    'Profit / (loss) after tax and before Extraordinary Items',
  ],
  'life-shareholder-final-profit': [
    'shareholders',
    'Profit/ (loss) after tax and Extraordinary Items',
  ],
} as const;
export const LiMetricSchema = z.enum(
  Object.keys(LI_LABELS) as [
    keyof typeof LI_LABELS,
    ...(keyof typeof LI_LABELS)[],
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
export const LiContextSchema = z
  .strictObject({
    policy: z.literal(NSE_LI_PARSER),
    captureBasis: z.literal('uploaded-rendered-nse-report'),
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
    amounts: z.record(LiMetricSchema, decimal),
    extraordinaryItems: z.literal('0'),
    ratios: z.literal('not-interpreted'),
  })
  .superRefine((value, ctx) => {
    if (
      Object.values(value.amounts).some(
        (item) => !decimal.safeParse(item).success,
      )
    )
      return;
    const a = (key: keyof typeof LI_LABELS) => exact(value.amounts[key]);
    const sum = (...keys: (keyof typeof LI_LABELS)[]) =>
      keys.reduce((total, key) => total + a(key), 0n);
    if (
      sum(
        'life-policy-net-premium',
        'life-policy-investment-income',
        'life-policy-other-income',
        'life-policy-transfer-from-shareholders',
      ) !== a('life-policy-total-income') ||
      sum(
        'life-policy-management-expenses',
        'life-policy-debt-provision',
        'life-policy-investment-provision',
        'life-policy-linked-gst',
        'life-policy-tax',
        'life-policy-benefits-paid',
        'life-policy-actuarial-liability-change',
      ) !== a('life-policy-total-expenses') ||
      a('life-policy-total-income') - a('life-policy-total-expenses') !==
        a('life-policy-net-surplus') ||
      sum(
        'life-policy-transfer-to-shareholders',
        'life-policy-future-appropriation',
      ) !== a('life-policy-net-surplus') ||
      sum(
        'life-shareholder-transfer-from-policyholders',
        'life-shareholder-investment-income',
        'life-shareholder-other-income',
      ) !== a('life-shareholder-total-income') ||
      sum(
        'life-shareholder-other-expenses',
        'life-shareholder-transfer-to-policyholders',
        'life-shareholder-debt-provision',
        'life-shareholder-investment-provision',
      ) !== a('life-shareholder-total-expenses') ||
      a('life-shareholder-total-income') -
        a('life-shareholder-total-expenses') !==
        a('life-shareholder-profit-before-tax') ||
      a('life-shareholder-profit-before-tax') - a('life-shareholder-tax') !==
        a('life-shareholder-profit-after-tax') ||
      a('life-shareholder-profit-after-tax') !==
        a('life-shareholder-final-profit') ||
      a('life-shareholder-transfer-from-policyholders') !==
        a('life-policy-transfer-to-shareholders') ||
      a('life-shareholder-transfer-to-policyholders') !==
        a('life-policy-transfer-from-shareholders')
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Life-insurance accounts or inter-account transfers do not reconcile.',
      });
    if (new Set(value.reportingColumns).size !== value.reportingColumns.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Repeated life-insurance column role.',
      });
  });
export function isNseLiSource(url: string) {
  const source = new URL(url);
  return (
    source.protocol === 'https:' &&
    source.hostname === 'nsearchives.nseindia.com' &&
    !source.port &&
    !source.username &&
    !source.password &&
    !source.search &&
    !source.hash &&
    /^\/corporate\/ixbrl\/INTEGRATED_FILING_LI_\d+_\d+_iXBRL_WEB\.html$/.test(
      source.pathname,
    )
  );
}
export function parseNseLi(body: string, effectiveOn: string) {
  z.iso.date().parse(effectiveOn);
  if (
    !body ||
    body.length > 2000000 ||
    /<(?:script|iframe|object|embed)\b|<!ENTITY/i.test(body)
  )
    throw Error('Unsafe or oversized LI source.');
  const tables = [...body.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  const general = tables.filter((table) =>
    /\bclass\s*=\s*["'][^"']*\bgITable\b/.test(table[1]!),
  );
  if (
    general.length !== 1 ||
    !clean(body).includes(
      'Format for financial results by life insurance companies filed with stock exchanges',
    )
  )
    throw Error('Unsupported rendered life-insurance report.');
  const info = rows(general[0]![2]!);
  const scalar = (label: string) => {
    const values = cells(info, label, 0);
    if (values.length !== 1)
      throw Error('Life-insurance metadata columns changed.');
    return values[0]!;
  };
  const isin = z
    .string()
    .regex(/^IN[A-Z0-9]{9}[0-9]$/)
    .parse(scalar('ISIN'));
  if (scalar('Description of presentation currency') !== 'INR')
    throw Error('Life-insurance amounts require explicit INR.');
  const boardApprovedOn = day(
    scalar('Date of board meeting when results were approved'),
  );
  if (boardApprovedOn > effectiveOn)
    throw Error('Life-insurance effective date precedes board approval.');
  const scales = {
      Rupees: 'rupees',
      Thousands: 'thousands',
      Lakhs: 'lakhs',
      Crores: 'crores',
    } as const,
    rounding = scalar('Level of rounding used in financial results');
  if (!(rounding in scales)) throw Error('Unknown LI scale.');
  const scale = scales[rounding as keyof typeof scales];
  const select = (label: string) => {
    const found = tables.filter((table) =>
      rows(table[2]!).some((row) => row.includes(label)),
    );
    if (found.length !== 1)
      throw Error(`Missing or ambiguous life-insurance account: ${label}`);
    return found[0]!;
  };
  const policy = select("Policyholders' Accounts"),
    appropriations = select('Appropriations'),
    shareholders = select("Transfer from Poliycholders' Account");
  if (!(
    policy.index! < appropriations.index! &&
    appropriations.index! < shareholders.index!
  ))
    throw Error('LI account order changed.');
  if (
    !body
      .slice(general[0]!.index! + general[0]![0].length, policy.index)
      .includes(`Amount in (${rounding})`) ||
    !body
      .slice(
        appropriations.index! + appropriations[0].length,
        shareholders.index,
      )
      .includes(`Amount in (${rounding})`)
  )
    throw Error('Life-insurance account scales disagree.');
  const data = {
    policy: rows(policy[2]!),
    appropriations: rows(appropriations[2]!),
    shareholders: rows(shareholders[2]!),
  };
  if (
    data.policy[0]?.join('|') !==
    'Partiuclars|Current Quarter|Year to Date Figures'
  )
    throw Error('LI reporting column roles changed.');
  const starts = cells(data.policy, 'Date of start of reporting period', 0),
    ends = cells(data.policy, 'Date of end of reporting period', 0),
    bases = cells(
      data.policy,
      'Nature of report standalone or consolidated',
      0,
    ),
    audits = cells(data.policy, 'Whether results are audited or unaudited', 0);
  const values = Object.fromEntries(
      Object.entries(LI_LABELS).map(([key, [account, label]]) => [
        key,
        cells(data[account], label, 1),
      ]),
    ),
    extraordinary = cells(
      data.shareholders,
      'Extraordinary Items (Net of tax expenses)',
      1,
    );
  if (
    starts.length !== 2 ||
    [ends, bases, audits, extraordinary, ...Object.values(values)].some(
      (value) => value.length !== 2,
    )
  )
    throw Error('Life-insurance reporting columns changed.');
  const contexts = starts.map((start, column) => {
    const periodStart = day(start),
      periodEnd = day(ends[column]!);
    if (periodStart > periodEnd || periodEnd > boardApprovedOn)
      throw Error('Invalid LI period.');
    if (exact(amount(extraordinary[column]!)) !== 0n)
      throw Error(
        'Nonzero extraordinary items require a separately verified LI policy.',
      );
    return LiContextSchema.parse({
      policy: NSE_LI_PARSER,
      captureBasis: 'uploaded-rendered-nse-report',
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
      extraordinaryItems: '0',
      ratios: 'not-interpreted',
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
      throw Error('Repeated life-insurance quarter/YTD columns disagree.');
    contexts[0]!.reportingColumns = ['current-quarter', 'year-to-date'];
    contexts.pop();
  }
  return contexts.flatMap((lifeInsuranceContext) =>
    (
      Object.entries(LI_LABELS) as [
        keyof typeof LI_LABELS,
        readonly ['policy' | 'appropriations' | 'shareholders', string],
      ][]
    ).map(([metric, [account, label]]) => ({
      kind: 'fundamental' as const,
      isin,
      effectiveOn,
      sourceRow: data[account].findIndex((row) => row.includes(label)) + 1,
      metric,
      periodStart: lifeInsuranceContext.periodStart,
      periodEnd: lifeInsuranceContext.periodEnd,
      basis: lifeInsuranceContext.basis,
      currency: 'INR' as const,
      scale,
      value: lifeInsuranceContext.amounts[metric],
      audited: lifeInsuranceContext.audited,
      lifeInsuranceContext,
    })),
  );
}
