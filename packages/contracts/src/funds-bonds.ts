import { z } from 'zod';
import {
  BondCreditReferenceSchema,
  BondEvidencePolicySchema,
  bondEvidencePolicy,
} from './bond-evidence.js';
import {
  AMFI_HISTORY_BASE,
  AMFI_HISTORY_HEADER,
  AmfiHistoryUrlSchema,
  amfiHistoryWindow,
  amfiHistoryRowMatches,
  AMFI_HISTORY_CATALOG,
} from './amfi-history.js';
export const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
export const AMFI_LEGACY_NAV_URL =
  'https://portal.amfiindia.com/spages/Original_NAVAll.txt';
const AMFI_LEGACY_HEADER =
  'Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date';
const AMFI_CURRENT_HEADER =
  'Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date';
export function amfiNavFormat(body: string) {
  const header = body
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find((line) => line.trim())
    ?.trim();
  if (header === AMFI_HISTORY_HEADER)
    return {
      parser: 'amfi-history-v1' as const,
      sourceUrl: AMFI_HISTORY_BASE,
      header,
      width: 8,
    };
  if (header === AMFI_CURRENT_HEADER)
    return {
      parser: 'amfi-navall-v2' as const,
      sourceUrl: AMFI_NAV_URL,
      header,
      width: 8,
    };
  if (header === AMFI_LEGACY_HEADER)
    return {
      parser: 'amfi-navall-v1' as const,
      sourceUrl: AMFI_LEGACY_NAV_URL,
      header,
      width: 6,
    };
  throw Error(
    'AMFI header changed; only documented six/eight-column formats are supported.',
  );
}
export const FUNDS_BONDS_METHOD = 'dated-cashflows-act365-v1' as const;
const day = z.iso.date();
const money = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const signedMoney = z.string().regex(/^-?(0|[1-9][0-9]{0,17})$/);
const label = z.string().trim().min(1).max(240);
const isin = z
  .string()
  .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
  .nullable();
export const FundNavSchema = z.strictObject({
  schemeCode: z.string().regex(/^[0-9]{5,8}$/),
  name: label,
  amc: label,
  category: label,
  plan: label.nullable().optional(),
  option: label.nullable().optional(),
  payoutIsin: isin,
  reinvestmentIsin: isin,
  nav: z
    .string()
    .regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$/)
    .nullable(),
  observedOn: day,
  sourceRow: z.number().int().positive(),
});
export type FundNav = z.infer<typeof FundNavSchema>;
export const FundNavCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  permissionReference: z.string().trim().min(12).max(1000),
  writtenPermissionConfirmed: z.literal(true),
  body: z.string().min(1).max(4000000),
  sourceUrl: AmfiHistoryUrlSchema.optional(),
});
export const FundNavEditionSchema = z.strictObject({
  id: z.uuid(),
  sourceUrl: z.union([
    z.enum([AMFI_NAV_URL, AMFI_LEGACY_NAV_URL]),
    AmfiHistoryUrlSchema,
  ]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  permissionReference: z.string(),
  count: z.number().int().min(1).max(50000),
  parser: z.enum(['amfi-navall-v1', 'amfi-navall-v2', 'amfi-history-v1']),
  historyCatalog: z
    .strictObject({
      version: z.literal(AMFI_HISTORY_CATALOG.version),
      observedOn: z.literal(AMFI_HISTORY_CATALOG.observedOn),
      sourceUrl: z.literal(AMFI_HISTORY_CATALOG.sourceUrl),
      sourceHash: z.literal(AMFI_HISTORY_CATALOG.sourceHash),
    })
    .optional(),
});
export const FundNavRecordSchema = z
  .strictObject({
    observation: FundNavSchema,
    edition: FundNavEditionSchema.omit({ permissionReference: true }),
  })
  .superRefine((record, context) => {
    const historical = record.edition.parser === 'amfi-history-v1';
    if (!historical) {
      const expected =
        record.edition.parser === 'amfi-navall-v1'
          ? AMFI_LEGACY_NAV_URL
          : AMFI_NAV_URL;
      if (record.edition.sourceUrl !== expected)
        context.addIssue({
          code: 'custom',
          message: 'NAV parser and source URL do not agree.',
        });
      return;
    }
    try {
      const window = amfiHistoryWindow(record.edition.sourceUrl),
        row = record.observation;
      if (
        row.observedOn < window.from ||
        row.observedOn > window.to ||
        !amfiHistoryRowMatches(window, row.amc, row.category)
      )
        context.addIssue({
          code: 'custom',
          message: 'Historical observation does not match source request.',
        });
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Invalid historical source request.',
      });
    }
  });
export const FundsListSchema = z.strictObject({
  funds: z.array(FundNavRecordSchema).max(50),
  nextAfter: z
    .string()
    .regex(/^[0-9]{5,8}$/)
    .nullable(),
  snapshot: z
    .strictObject({
      capturedAt: z.iso.datetime(),
      included: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    })
    .nullable()
    .default(null),
});
export const FundHistoryReconciliationSchema = z.strictObject({
  status: z.enum([
    'review-required',
    'consistent-retained-records',
    'insufficient-history',
  ]),
  retainedEditions: z.number().int().nonnegative(),
  distinctDates: z.number().int().nonnegative(),
  firstDate: day.nullable(),
  lastDate: day.nullable(),
  conflictingDates: z.array(day),
  identityChanges: z.array(z.string()),
  limitations: z.array(z.string()),
});
export function reconcileFundHistory(
  records: z.infer<typeof FundNavRecordSchema>[],
  truncated: boolean,
) {
  const dates = [
    ...new Set(records.map((row) => row.observation.observedOn)),
  ].sort();
  const conflictingDates = dates.filter((date) => {
    const values = records
      .filter((row) => row.observation.observedOn === date)
      .flatMap((row) => {
        const nav = row.observation.nav;
        if (nav === null) return [];
        const [whole, fraction = ''] = nav.split('.');
        return [
          (
            BigInt(whole!) * 100000000n +
            BigInt(fraction.padEnd(8, '0'))
          ).toString(),
        ];
      });
    return new Set(values).size > 1;
  });
  const fields = [
    'schemeCode',
    'amc',
    'name',
    'plan',
    'option',
    'payoutIsin',
    'reinvestmentIsin',
  ] as const;
  const identityChanges = fields.filter(
    (field) =>
      new Set(
        records.flatMap((row) => {
          const value = row.observation[field];
          return value == null ? [] : [value];
        }),
      ).size > 1,
  );
  const limitations = [
    'Retained captures are not proof of complete trading-day history.',
  ];
  if (truncated)
    limitations.push('Only the downloaded or bounded history is included.');
  if (records.some((row) => row.observation.nav === null))
    limitations.push('Some retained observations have no reported NAV.');
  if (
    records.some(
      (row) =>
        row.observation.payoutIsin === null &&
        row.observation.reinvestmentIsin === null,
    )
  )
    limitations.push('Some retained observations have no supplied ISIN.');
  if (
    records.some(
      (row) => row.observation.plan == null || row.observation.option == null,
    )
  )
    limitations.push('Some editions do not explicitly supply plan or option.');
  return FundHistoryReconciliationSchema.parse({
    status:
      conflictingDates.length || identityChanges.length
        ? 'review-required'
        : new Set(
              records
                .filter((row) => row.observation.nav !== null)
                .map((row) => row.observation.observedOn),
            ).size < 2
          ? 'insufficient-history'
          : 'consistent-retained-records',
    retainedEditions: new Set(records.map((row) => row.edition.id)).size,
    distinctDates: dates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    conflictingDates,
    identityChanges,
    limitations,
  });
}
export const FundDetailSchema = z
  .strictObject({
    schemeCode: z.string(),
    history: z.array(FundNavRecordSchema).max(500),
    lookThrough: z.literal('not-connected'),
    truncated: z.boolean(),
    reconciliation: FundHistoryReconciliationSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      value.history.some(
        (row) => row.observation.schemeCode !== value.schemeCode,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'History contains a different scheme identity.',
      });
    if (
      value.reconciliation &&
      JSON.stringify(value.reconciliation) !==
        JSON.stringify(reconcileFundHistory(value.history, value.truncated))
    )
      context.addIssue({
        code: 'custom',
        message: 'History reconciliation does not match retained observations.',
      });
  })
  .transform((value) => ({
    ...value,
    reconciliation: reconcileFundHistory(value.history, value.truncated),
  }));
export const FundsSnapshotSchema = z
  .strictObject({
    capturedAt: z.iso.datetime(),
    history: z.array(FundNavRecordSchema).max(5000).optional(),
    historyTruncated: z.boolean().default(true),
    funds: z.array(FundNavRecordSchema).max(5000),
    totalSchemeCount: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .refine(
    (v) =>
      v.totalSchemeCount >= v.funds.length &&
      v.truncated === v.totalSchemeCount > v.funds.length,
    'Snapshot coverage count does not reconcile.',
  )
  .superRefine((snapshot, context) => {
    if (!snapshot.history) return;
    const schemes = new Set(
      snapshot.funds.map((row) => row.observation.schemeCode),
    );
    const keys = snapshot.history.map(
      (row) =>
        `${row.edition.id}:${row.observation.schemeCode}:${row.observation.observedOn}`,
    );
    if (
      snapshot.history.some(
        (row) => !schemes.has(row.observation.schemeCode),
      ) ||
      new Set(keys).size !== keys.length
    )
      context.addIssue({
        code: 'custom',
        message:
          'Snapshot history has an unknown scheme or duplicate edition/date.',
      });
  });
export const FundNavReviewSchema = z.strictObject({
  requestId: z.uuid(),
  editionId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(5).max(1000),
});
export const FundNavQueueSchema = z.strictObject({
  editions: z
    .array(
      z.strictObject({
        edition: FundNavEditionSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
      }),
    )
    .max(30),
});
/** AMFI source is a sectioned semicolon text file; no provider formulas are evaluated. */
export function parseAmfiNav(body: string, sourceUrl?: string): FundNav[] {
  if (!body || body.length > 4000000)
    throw Error('NAV source exceeds its bound.');
  const lines = body
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const format = amfiNavFormat(body);
  const historical = format.parser === 'amfi-history-v1';
  const window = historical
    ? amfiHistoryWindow(AmfiHistoryUrlSchema.parse(sourceUrl))
    : null;
  if (!historical && sourceUrl)
    throw Error('History URL requires the exact historical report header.');
  const header = format.header;
  let found = false,
    category = '',
    amc = '';
  const records: FundNav[] = [];
  const codes = new Set<string>();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (line === header) {
      found = true;
      continue;
    }
    if (!found) throw Error('AMFI header changed.');
    if (!line.includes(';')) {
      if (
        /^(Open Ended Schemes|Close Ended Schemes|Interval Fund Schemes)/i.test(
          line,
        )
      ) {
        category = line;
        amc = '';
      } else amc = line;
      continue;
    }
    const fields = line.split(';').map((value) => value.trim());
    if (fields.length !== format.width || !category || !amc)
      throw Error('NAV row or section is incomplete.');
    const date = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(
      fields[format.width - 1]!,
    );
    if (!date) throw Error('NAV date changed format.');
    const month = months.findIndex(
      (value) => value.toLowerCase() === date[2]!.toLowerCase(),
    );
    if (month < 0) throw Error('Invalid NAV month.');
    const code = fields[0]!;
    const observedOn = `${date[3]}-${String(month + 1).padStart(2, '0')}-${date[1]}`;
    const key = historical ? `${code}:${observedOn}` : code;
    if (codes.has(key)) throw Error('Duplicate scheme/date in NAV edition.');
    codes.add(key);
    if (
      window &&
      (observedOn < window.from ||
        observedOn > window.to ||
        !amfiHistoryRowMatches(window, amc, category))
    )
      throw Error(
        'History observation does not match requested interval, AMC or category.',
      );
    const optional = (value: string) =>
      value === '' || value === '-' || value === 'N.A.' ? null : value;
    records.push(
      FundNavSchema.parse({
        schemeCode: code,
        name: fields[historical ? 1 : 3],
        amc,
        category,
        payoutIsin: optional(fields[historical ? 4 : 1]!),
        reinvestmentIsin: optional(fields[historical ? 5 : 2]!),
        ...(format.width === 8
          ? {
              plan: optional(fields[historical ? 2 : 4]!),
              option: optional(fields[historical ? 3 : 5]!),
            }
          : {}),
        nav: optional(fields[format.width - 2]!),
        observedOn,
        sourceRow: i + 1,
      }),
    );
    if (records.length > 50000) throw Error('Too many NAV rows.');
  }
  if (!records.length) throw Error('No valid NAV rows.');
  return records;
}

export const DatedCashflowSchema = z.strictObject({
  date: day,
  amountPaise: signedMoney,
});
export const XirrResultSchema = z.strictObject({
  status: z.enum([
    'unique',
    'no-root',
    'non-conventional',
    'outside-search-range',
  ]),
  annualPercent: z.string().nullable(),
  method: z.literal('ACT/365 bisection'),
  searchRange: z.literal('-99.9999% to 100000000%'),
  reason: z.string(),
});
export type XirrResult = z.infer<typeof XirrResultSchema>;
const days = (from: string, to: string) =>
  Math.round(
    (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) /
      86400000,
  );
export function datedXirr(
  input: z.infer<typeof DatedCashflowSchema>[],
): XirrResult {
  const rows = z.array(DatedCashflowSchema).min(1).max(240).parse(input);
  const grouped = new Map<string, bigint>();
  for (const row of rows)
    grouped.set(
      row.date,
      (grouped.get(row.date) ?? 0n) + BigInt(row.amountPaise),
    );
  const flows = [...grouped]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b));
  const base = {
    method: 'ACT/365 bisection' as const,
    searchRange: '-99.9999% to 100000000%' as const,
    annualPercent: null,
  };
  if (
    flows.length < 2 ||
    !flows.some(([, v]) => v < 0n) ||
    !flows.some(([, v]) => v > 0n)
  )
    return {
      ...base,
      status: 'no-root',
      reason:
        'Cashflows need different dates and both payment and receipt after same-day netting.',
    };
  let changes = 0;
  for (let i = 1; i < flows.length; i++)
    if (flows[i]![1] > 0n !== flows[i - 1]![1] > 0n) changes++;
  if (changes > 1)
    return {
      ...base,
      status: 'non-conventional',
      reason:
        'Several sign changes can produce multiple or no rates. A single XIRR is not reported.',
    };
  if (flows.reduce((sum, [, value]) => sum + value, 0n) === 0n)
    return {
      ...base,
      status: 'unique',
      annualPercent: '0.00000000',
      reason:
        'The supplied conventional cashflows have an exact zero rate before timing-sensitive alternatives.',
    };
  const maximum = Math.max(...flows.map(([, v]) => Math.abs(Number(v))));
  const values = flows.map(([date, amount]) => ({
    t: days(flows[0]![0], date) / 365,
    c: Number(amount) / maximum,
  }));
  // Log-scaled evaluation avoids overflow close to -100%; scaling never changes the zero.
  const npv = (rate: number) => {
    const exponents = values.map((r) => -r.t * Math.log1p(rate));
    const largest = Math.max(...exponents);
    return values.reduce(
      (sum, row, i) => sum + row.c * Math.exp(exponents[i]! - largest),
      0,
    );
  };
  let low = -0.999999,
    high = 1000000,
    fl = npv(low);
  const fh = npv(high);
  if (fl === 0 || fh === 0 || Math.sign(fl) === Math.sign(fh))
    return {
      ...base,
      status: 'outside-search-range',
      reason: 'No numerically resolved root inside the declared search range.',
    };
  for (let i = 0; i < 220; i++) {
    const mid = (low + high) / 2;
    const fm = npv(mid);
    if (fm === 0) {
      low = mid;
      high = mid;
      break;
    }
    if (Math.sign(fm) === Math.sign(fl)) {
      low = mid;
      fl = fm;
    } else high = mid;
    if (high - low < 1e-12 * Math.max(1, Math.abs(mid))) break;
  }
  const rate = (low + high) / 2;
  return {
    ...base,
    status: 'unique',
    annualPercent: (rate * 100).toFixed(8),
    reason:
      'Approximate annualized rate of supplied dated cashflows, not a guaranteed return.',
  };
}
export const BondComparisonInputSchema = z
  .strictObject({
    title: label,
    sourceReference: z.string().trim().min(5).max(1000),
    settlementOn: day,
    cleanPricePaise: money,
    previousCouponOn: day,
    nextCouponOn: day,
    couponAmountPaise: money,
    feesPaise: money,
    creditDescription: z.string().trim().min(1).max(1000),
    creditEvidence: BondCreditReferenceSchema.optional(),
    cashflows: z
      .array(z.strictObject({ date: day, amountPaise: money }))
      .min(1)
      .max(120),
    depositAnnualBps: z.number().int().min(0).max(10000),
    depositDeductionBps: z.number().int().min(0).max(10000),
    consent: z.literal(true),
  })
  .superRefine((v, ctx) => {
    if (
      v.previousCouponOn > v.settlementOn ||
      v.nextCouponOn <= v.settlementOn ||
      v.nextCouponOn <= v.previousCouponOn
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Settlement must fall in the declared coupon interval.',
      });
    if (BigInt(v.cleanPricePaise) <= 0n)
      ctx.addIssue({
        code: 'custom',
        message: 'Purchase price must be positive.',
      });
    if (
      v.cashflows.some(
        (r) =>
          r.date <= v.settlementOn || days(v.settlementOn, r.date) > 365 * 100,
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Cashflows must follow settlement within 100 years.',
      });
    if (v.cashflows.every((r) => BigInt(r.amountPaise) === 0n))
      ctx.addIssue({
        code: 'custom',
        message: 'At least one future receipt must be positive.',
      });
  });
export type BondComparisonInput = z.infer<typeof BondComparisonInputSchema>;
export const BondComparisonResultSchema = z.strictObject({
  method: z.literal(FUNDS_BONDS_METHOD),
  evidencePolicy: BondEvidencePolicySchema.optional(),
  accruedPaise: money,
  dirtyPricePaise: money,
  totalOutlayPaise: money,
  totalReceiptsPaise: money,
  netGainPaise: signedMoney,
  xirr: XirrResultSchema,
  macaulayYears: z.string().nullable(),
  depositInterestPaise: money,
  depositDeductionPaise: money,
  depositMaturityPaise: money,
  depositXirr: XirrResultSchema,
  maturityOn: day,
  notes: z.array(z.string()),
});
const rounded = (numerator: bigint, denominator: bigint) =>
  (numerator * 2n + denominator) / (denominator * 2n);
export function calculateBondComparison(
  value: BondComparisonInput,
  ratingEdition?: unknown,
) {
  const input = BondComparisonInputSchema.parse(value),
    period = days(input.previousCouponOn, input.nextCouponOn),
    elapsed = days(input.previousCouponOn, input.settlementOn);
  const accrued = rounded(
    BigInt(input.couponAmountPaise) * BigInt(elapsed),
    BigInt(period),
  );
  const dirty = BigInt(input.cleanPricePaise) + accrued,
    outlay = dirty + BigInt(input.feesPaise),
    receipts = input.cashflows.reduce(
      (sum, r) => sum + BigInt(r.amountPaise),
      0n,
    );
  const maturity = input.cashflows
    .map((r) => r.date)
    .sort()
    .at(-1)!;
  const xirr = datedXirr([
    { date: input.settlementOn, amountPaise: (-outlay).toString() },
    ...input.cashflows,
  ]);
  const interest = rounded(
      outlay *
        BigInt(input.depositAnnualBps) *
        BigInt(days(input.settlementOn, maturity)),
      365n * 10000n,
    ),
    deduction = rounded(interest * BigInt(input.depositDeductionBps), 10000n),
    deposit = outlay + interest - deduction;
  let duration: string | null = null;
  if (xirr.status === 'unique') {
    const rate = Number(xirr.annualPercent) / 100;
    const discounted = input.cashflows.map((r) => ({
      years: days(input.settlementOn, r.date) / 365,
      pv:
        Number(r.amountPaise) /
        Math.pow(1 + rate, days(input.settlementOn, r.date) / 365),
    }));
    const pv = discounted.reduce((sum, r) => sum + r.pv, 0),
      weighted = discounted.reduce((sum, r) => sum + r.pv * r.years, 0);
    if (Number.isFinite(weighted / pv)) duration = (weighted / pv).toFixed(6);
  }
  return BondComparisonResultSchema.parse({
    method: FUNDS_BONDS_METHOD,
    evidencePolicy: bondEvidencePolicy(
      input.settlementOn,
      input.creditEvidence,
      ratingEdition,
    ),
    accruedPaise: accrued.toString(),
    dirtyPricePaise: dirty.toString(),
    totalOutlayPaise: outlay.toString(),
    totalReceiptsPaise: receipts.toString(),
    netGainPaise: (receipts - outlay).toString(),
    xirr,
    macaulayYears: duration,
    depositInterestPaise: interest.toString(),
    depositDeductionPaise: deduction.toString(),
    depositMaturityPaise: deposit.toString(),
    depositXirr: datedXirr([
      { date: input.settlementOn, amountPaise: (-outlay).toString() },
      { date: maturity, amountPaise: deposit.toString() },
    ]),
    maturityOn: maturity,
    notes: [
      input.creditEvidence
        ? 'Attached agency opinion applies only to the recorded historical assessment; entered price and cashflows remain unverified.'
        : 'User-supplied cashflows and credit description are not verified market quotes or ratings.',
      'Accrual uses actual elapsed days / actual coupon-interval days, rounded half-up to paise; verify the instrument convention.',
      'Deposit uses simple ACT/365 interest and an explicitly assumed interest deduction, not a bank offer or tax determination.',
      'XIRR and duration are numerical estimates; cash accounting uses exact integer paise.',
      'Reinvestment, default, early sale, liquidity, fees not entered and future tax changes are not modelled.',
    ],
  });
}
export const SavedBondComparisonSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    input: BondComparisonInputSchema,
    result: BondComparisonResultSchema,
  })
  .superRefine((v, c) => {
    if (
      !v.input.creditEvidence &&
      v.result.evidencePolicy?.credit.status === 'historical-original-attached'
    )
      c.addIssue({
        code: 'custom',
        message: 'Attached credit requires the matching saved input reference.',
      });
    if (v.input.creditEvidence) {
      const credit = v.result.evidencePolicy?.credit;
      if (
        !credit ||
        credit.status !== 'historical-original-attached' ||
        credit.editionId !== v.input.creditEvidence.editionId ||
        credit.observation.isin !== v.input.creditEvidence.isin ||
        v.result.evidencePolicy?.assessmentOn !== v.input.settlementOn
      )
        c.addIssue({
          code: 'custom',
          message: 'Saved credit receipt does not match its original input.',
        });
    }
  });
export const BondComparisonsSchema = z.strictObject({
  comparisons: z.array(SavedBondComparisonSchema).max(100),
});
