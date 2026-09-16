import { z } from 'zod';
import { GoalMoneySchema } from './goals.js';
export const EquityTaxProfileSchema = z.strictObject({
  policy: z.literal('resident-listed-equity-no-surcharge-2024-v1'),
  residentIndividual: z.literal(true),
  capitalAssetNotBusiness: z.literal(true),
  sttConditionsMet: z.literal(true),
  basicExemptionExhausted: z.literal(true),
  noLossOffsetsOrSpecialReliefs: z.literal(true),
  totalTaxableIncomeMinor: GoalMoneySchema.refine(
    (v) => BigInt(v) <= 500000000n,
    'This policy excludes income above INR50 lakh.',
  ),
  priorEligibleLongTermGainsMinor: GoalMoneySchema,
  deductibleDisposalFeesMinor: GoalMoneySchema,
});
export const EquityTaxResultSchema = z.strictObject({
  policy: EquityTaxProfileSchema.shape.policy,
  saleOn: z.iso.date(),
  shortTermGainMinor: GoalMoneySchema,
  longTermGainMinor: GoalMoneySchema,
  longTermExemptionUsedMinor: GoalMoneySchema,
  basicTaxMinor: GoalMoneySchema,
  cessMinor: GoalMoneySchema,
  taxMinor: GoalMoneySchema,
  source: z.literal('https://www.incometaxindia.gov.in/w/capital-gain'),
  lots: z
    .array(
      z.strictObject({
        reference: z.string(),
        term: z.enum(['short', 'long']),
        taxableGainMinor: GoalMoneySchema,
        deductibleFeeMinor: GoalMoneySchema,
      }),
    )
    .max(500),
});
const positive = (v: bigint) => (v > 0n ? v : 0n);
function anniversary(date: string) {
  const [year, month, day] = date.split('-').map(Number),
    next = year! + 1;
  const last = new Date(Date.UTC(next, month!, 0)).getUTCDate();
  return `${next}-${String(month).padStart(2, '0')}-${String(Math.min(day!, last)).padStart(2, '0')}`;
}
/** Restricted incremental educational computation, never a complete tax return. */
export function calculateEquityDisposalTax(
  raw: z.infer<typeof EquityTaxProfileSchema>,
  saleOn: string,
  disposals: {
    reference: string;
    acquiredOn: string;
    costMinor: string;
    proceedsMinor: string;
  }[],
  totalFeesMinor: string,
) {
  const profile = EquityTaxProfileSchema.parse(raw);
  if (saleOn < '2024-07-23' || saleOn > '2027-03-31' || !disposals.length)
    throw Error(
      'Choose an in-scope post23July2024 disposal; policy review is required after March2027.',
    );
  if (disposals.some((l) => l.acquiredOn <= '2018-01-31'))
    throw Error(
      'Pre-February2018 lots require separate grandfathering evidence and are outside this tax policy.',
    );
  const fees = BigInt(profile.deductibleDisposalFeesMinor),
    gross = disposals.reduce((a, l) => a + BigInt(l.proceedsMinor), 0n);
  if (gross <= 0n)
    throw Error('A taxable disposal requires positive total proceeds.');
  if (fees > BigInt(totalFeesMinor) || fees > gross)
    throw Error(
      'Deductible disposal fees cannot exceed entered total charges or proceeds; exclude STT.',
    );
  let allocated = 0n,
    st = 0n,
    lt = 0n;
  const lots = disposals.map((l, index) => {
    const fee =
      index === disposals.length - 1
        ? fees - allocated
        : (fees * BigInt(l.proceedsMinor)) / gross;
    allocated += fee;
    const gain = BigInt(l.proceedsMinor) - BigInt(l.costMinor) - fee;
    if (gain < 0n)
      throw Error(
        'Loss-making lots need the full loss-offset calculation; use explicit reviewed tax inputs instead.',
      );
    const term =
      saleOn > anniversary(l.acquiredOn)
        ? ('long' as const)
        : ('short' as const);
    if (term === 'long') lt += gain;
    else st += gain;
    return {
      reference: l.reference,
      term,
      taxableGainMinor: String(gain),
      deductibleFeeMinor: String(fee),
    };
  });
  if (
    st + lt + BigInt(profile.priorEligibleLongTermGainsMinor) >
    BigInt(profile.totalTaxableIncomeMinor)
  )
    throw Error('Total taxable income must include these gains.');
  const remaining = positive(
      12500000n - BigInt(profile.priorEligibleLongTermGainsMinor),
    ),
    exemption = lt < remaining ? lt : remaining;
  const taxNumerator = st * 2000n + (lt - exemption) * 1250n;
  const basic = (taxNumerator + 9999n) / 10000n,
    cess = (basic * 400n + 9999n) / 10000n;
  return EquityTaxResultSchema.parse({
    policy: profile.policy,
    saleOn,
    shortTermGainMinor: String(st),
    longTermGainMinor: String(lt),
    longTermExemptionUsedMinor: String(exemption),
    basicTaxMinor: String(basic),
    cessMinor: String(cess),
    taxMinor: String(basic + cess),
    source: 'https://www.incometaxindia.gov.in/w/capital-gain',
    lots,
  });
}
