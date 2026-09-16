import { z } from 'zod';
import { EquityCompanySchema, equityCsv } from './equity-coverage.js';
import { parseNseActionRows, NSE_ACTIONS_URL } from './equity-actions.js';
const positive = z.string().regex(/^[1-9]\d{0,79}$/),
  money = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/);
export const AdjustmentWindowInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    isin: EquityCompanySchema.shape.isin,
    windowStart: z.iso.date(),
    windowEnd: z.iso.date(),
    sourceUrl: z.literal(NSE_ACTIONS_URL),
    sourceCsv: z.string().min(20).max(2000000),
    coverageEvidence: z.string().trim().min(30).max(3000),
    completeWindowConfirmed: z.literal(true),
    rightsEvidence: z.string().trim().min(20).max(2000),
    rightsConfirmed: z.literal(true),
  })
  .refine(
    (value) => value.windowStart < value.windowEnd,
    'Select an increasing trading-date window.',
  );
export const AdjustmentFactorSchema = z.strictObject({
  exOn: z.iso.date(),
  purpose: z.string(),
  kind: z.enum(['split', 'bonus', 'cash-dividend']),
  numerator: positive,
  denominator: positive,
  referenceOn: z.iso.date().nullable(),
  referenceClose: money.nullable(),
});
const binding = z.strictObject({
  editionId: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const AdjustmentWindowSchema = z.strictObject({
  id: z.uuid(),
  version: z.literal(1),
  isin: EquityCompanySchema.shape.isin,
  windowStart: z.iso.date(),
  windowEnd: z.iso.date(),
  policy: z.literal('nse-reviewed-backward-normalization-v1'),
  sourceUrl: z.literal(NSE_ACTIONS_URL),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  coverageEvidence: z.string(),
  basis: z.literal('independent-review-of-complete-source-window'),
  retainedBindings: z.array(binding).min(1).max(1000),
  factors: z.array(AdjustmentFactorSchema).max(100),
  prices: z
    .array(
      z.strictObject({
        date: z.iso.date(),
        rawClose: money,
        normalizedClose: money,
        editionId: z.uuid(),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(2)
    .max(1000),
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
});
export const AdjustmentReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(3000),
  completeWindowConfirmed: z.boolean(),
});
export const AdjustmentQueueSchema = z
  .array(
    z.strictObject({
      receipt: AdjustmentWindowSchema,
      state: z.enum(['draft', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export const AdjustmentPublicSchema = z.strictObject({
  windows: z.array(AdjustmentWindowSchema).max(100),
  capturedAt: z.iso.datetime(),
});
function decimal(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return { n: BigInt(whole! + fraction), d: 10n ** BigInt(fraction.length) };
}
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}
function ratio(n: bigint, d: bigint) {
  if (n <= 0n || d <= 0n) throw Error('Adjustment ratio must be positive.');
  const g = gcd(n, d);
  return { numerator: (n / g).toString(), denominator: (d / g).toString() };
}
function render(n: bigint, d: bigint) {
  const scale = 1000000000000n;
  const value = (n * scale * 2n + d) / (2n * d);
  const digits = value.toString().padStart(13, '0');
  return `${digits.slice(0, -12)}.${digits.slice(-12)}`
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}
export function normalizeAdjustedClose(
  close: string,
  date: string,
  factors: z.infer<typeof AdjustmentFactorSchema>[],
) {
  let { n, d } = decimal(close);
  for (const factor of factors) {
    if (date >= factor.exOn) continue;
    n *= BigInt(factor.numerator);
    d *= BigInt(factor.denominator);
    const g = gcd(n, d);
    n /= g;
    d /= g;
  }
  return render(n, d);
}
export function exactNseAdjustment(
  purpose: string,
  exOn: string,
  previous: { date: string; close: string } | null,
) {
  const bonus = /^Bonus ([1-9]\d{0,7}):\s*([1-9]\d{0,7})$/.exec(purpose);
  if (bonus)
    return AdjustmentFactorSchema.parse({
      kind: 'bonus',
      exOn,
      purpose,
      ...ratio(BigInt(bonus[2]!), BigInt(bonus[1]!) + BigInt(bonus[2]!)),
      referenceOn: null,
      referenceClose: null,
    });
  const split =
    /^Face Value Split \(Sub-Division\) - From (?:Rs|Re) (\d+(?:\.\d+)?)\/- Per Share To (?:Rs|Re) (\d+(?:\.\d+)?)\/- Per Share$/.exec(
      purpose,
    );
  if (split) {
    const from = decimal(split[1]!),
      to = decimal(split[2]!);
    if (from.n * to.d <= to.n * from.d)
      throw Error('Only a positive face-value subdivision is supported.');
    return AdjustmentFactorSchema.parse({
      kind: 'split',
      exOn,
      purpose,
      ...ratio(to.n * from.d, from.n * to.d),
      referenceOn: null,
      referenceClose: null,
    });
  }
  const dividend =
    /^(?:Interim )?Dividend - (?:Rs|Re) (\d+(?:\.\d+)?) Per Share$/.exec(
      purpose,
    );
  if (dividend) {
    if (!previous)
      throw Error(
        'Cash dividend needs the exact last pre-ex-date close inside this window.',
      );
    const cash = decimal(dividend[1]!),
      price = decimal(previous.close);
    if (cash.n <= 0n) throw Error('Cash dividend must be positive.');
    return AdjustmentFactorSchema.parse({
      kind: 'cash-dividend',
      exOn,
      purpose,
      ...ratio(price.n * cash.d - cash.n * price.d, price.n * cash.d),
      referenceOn: previous.date,
      referenceClose: previous.close,
    });
  }
  throw Error(
    `Unsupported corporate-action purpose: ${purpose}. No adjustment is inferred.`,
  );
}
export function adjustmentBindings(
  company: z.infer<typeof EquityCompanySchema>,
) {
  return [
    ...new Map(
      company.records
        .filter((row) =>
          ['price', 'identity', 'corporate-action'].includes(
            row.observation.kind,
          ),
        )
        .map((row) => [
          row.editionId,
          { editionId: row.editionId, hash: row.hash },
        ]),
    ).values(),
  ].sort((a, b) => a.editionId.localeCompare(b.editionId));
}
export function buildAdjustmentWindow(
  input: z.infer<typeof AdjustmentWindowInputSchema>,
  company: z.infer<typeof EquityCompanySchema>,
  sourceHash: string,
  createdAt: string,
) {
  if (company.isin !== input.isin || company.truncated)
    throw Error('Complete matching company evidence is required.');
  if (input.windowEnd > createdAt.slice(0, 10))
    throw Error('Future windows cannot be certified.');
  const identities = company.records.flatMap((row) =>
    row.observation.kind === 'identity' && row.observation.exchange === 'NSE'
      ? [
          {
            isin: row.observation.isin,
            symbol: row.observation.symbol,
            series: row.observation.series,
            effectiveOn: row.observation.effectiveOn,
            editionId: row.editionId,
            hash: row.hash,
          },
        ]
      : [],
  );
  const before = identities
    .filter((row) => row.effectiveOn <= input.windowStart)
    .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn));
  if (!before.length)
    throw Error(
      'A reviewed identity at or before the window start is required.',
    );
  const identity = before[0]!;
  if (
    before.some(
      (row) =>
        row.effectiveOn === identity.effectiveOn &&
        (row.symbol !== identity.symbol || row.series !== identity.series),
    )
  )
    throw Error('Conflicting identity at window start.');
  if (
    identities.some(
      (row) =>
        row.effectiveOn >= input.windowStart &&
        row.effectiveOn <= input.windowEnd &&
        (row.symbol !== identity.symbol || row.series !== identity.series),
    )
  )
    throw Error(
      'Symbol or series changes need a separate verified identity bridge.',
    );
  const { header, rows } = equityCsv(input.sourceCsv, true);
  const actions = parseNseActionRows(header, rows, input.windowEnd, identities);
  if (
    actions.some(
      (row) =>
        row.isin !== input.isin ||
        row.nseAction.exOn < input.windowStart ||
        row.nseAction.exOn > input.windowEnd,
    )
  )
    throw Error(
      'The original company export must match this exact company and date window.',
    );
  const observed = company.records
    .filter(
      (row) =>
        row.observation.kind === 'price' &&
        row.observation.exchange === 'NSE' &&
        row.observation.effectiveOn >= input.windowStart &&
        row.observation.effectiveOn <= input.windowEnd,
    )
    .sort(
      (a, b) =>
        a.observation.effectiveOn.localeCompare(b.observation.effectiveOn) ||
        a.editionId.localeCompare(b.editionId),
    );
  const seen = new Map<string, (typeof observed)[number]>();
  for (const row of observed) {
    const previous = seen.get(row.observation.effectiveOn);
    if (
      previous &&
      previous.observation.kind === 'price' &&
      row.observation.kind === 'price' &&
      previous.observation.close !== row.observation.close
    )
      throw Error('Conflicting closes require reconciliation.');
    seen.set(row.observation.effectiveOn, row);
  }
  const prices = [...seen.values()];
  if (
    prices[0]?.observation.effectiveOn !== input.windowStart ||
    prices.at(-1)?.observation.effectiveOn !== input.windowEnd
  )
    throw Error('Both coverage endpoints require admitted traded closes.');
  for (let i = 1; i < prices.length; i++)
    if (
      Date.parse(prices[i]!.observation.effectiveOn) -
        Date.parse(prices[i - 1]!.observation.effectiveOn) >
      7 * 86400000
    )
      throw Error('Price coverage contains a gap longer than seven days.');
  const active = actions.filter(
    (row) => row.nseAction.exOn > input.windowStart,
  );
  if (new Set(active.map((row) => row.nseAction.exOn)).size !== active.length)
    throw Error(
      'Multiple same-day actions require an explicit ordering policy.',
    );
  const factors = active
    .map((action) => {
      if (
        !prices.some(
          (row) => row.observation.effectiveOn === action.nseAction.exOn,
        )
      )
        throw Error('Every ex-date requires an admitted traded close.');
      const previous = prices
        .filter((row) => row.observation.effectiveOn < action.nseAction.exOn)
        .at(-1);
      return exactNseAdjustment(
        action.purpose,
        action.nseAction.exOn,
        previous?.observation.kind === 'price'
          ? {
              date: previous.observation.effectiveOn,
              close: previous.observation.close,
            }
          : null,
      );
    })
    .sort((a, b) => a.exOn.localeCompare(b.exOn));
  for (const row of company.records) {
    const action = row.observation;
    if (
      action.kind === 'corporate-action' &&
      action.nseAction &&
      action.nseAction.exOn > input.windowStart &&
      action.nseAction.exOn <= input.windowEnd &&
      !actions.some(
        (candidate) =>
          candidate.purpose === action.purpose &&
          candidate.nseAction.exOn === action.nseAction!.exOn,
      )
    )
      throw Error(
        'Coverage export omits a currently admitted corporate action.',
      );
  }
  const normalized = prices.map((row) => {
    if (row.observation.kind !== 'price') throw Error('Price binding changed.');
    let { n, d } = decimal(row.observation.close);
    if (n <= 0n) throw Error('Closes must be positive.');
    for (const factor of factors) {
      if (row.observation.effectiveOn >= factor.exOn) continue;
      n *= BigInt(factor.numerator);
      d *= BigInt(factor.denominator);
      const g = gcd(n, d);
      n /= g;
      d /= g;
    }
    return {
      date: row.observation.effectiveOn,
      rawClose: row.observation.close,
      normalizedClose: render(n, d),
      editionId: row.editionId,
      hash: row.hash,
    };
  });
  return AdjustmentWindowSchema.parse({
    id: input.requestId,
    version: 1,
    isin: input.isin,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    policy: 'nse-reviewed-backward-normalization-v1',
    sourceUrl: input.sourceUrl,
    sourceHash,
    coverageEvidence: input.coverageEvidence,
    basis: 'independent-review-of-complete-source-window',
    retainedBindings: adjustmentBindings(company),
    factors,
    prices: normalized,
    createdAt,
    reviewedAt: null,
  });
}
