import {
  EquityTaxProfileSchema,
  EquityTaxResultSchema,
  calculateEquityDisposalTax,
} from './action-tax.js';
import { z } from 'zod';
import { AccountHoldingSchema, type HoldingsSnapshot } from './holdings.js';
import { GoalMoneySchema, goalProjection, type SavedGoal } from './goals.js';
import type { ActionCentreInput } from './action-centre.js';
const Quantity = AccountHoldingSchema.shape.quantity;
const Isin = AccountHoldingSchema.shape.isin;
const Price = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$/)
  .refine((v) => /[1-9]/.test(v));
export const ActionPlanSchema = z
  .strictObject({
    kind: z.enum(['buy', 'rebalance', 'sell-fifo']),
    taxProfile: EquityTaxProfileSchema.optional(),
    minimumCashChangeMinor: GoalMoneySchema.optional(),
    purchase: z
      .strictObject({
        isin: Isin,
        quantity: Quantity,
        rupees: Price,
        asOf: z.iso.date(),
      })
      .nullable(),
    lots: z
      .array(
        z.strictObject({
          reference: z.string().trim().min(1).max(100),
          sequence: z.number().int().min(0).max(499),
          acquiredOn: z.iso.date(),
          quantity: Quantity,
          costMinor: GoalMoneySchema,
        }),
      )
      .max(500),
    evidenceNote: z.string().trim().min(5).max(1000),
  })
  .superRefine((p, ctx) => {
    if (p.kind === 'buy' && p.taxProfile)
      ctx.addIssue({
        code: 'custom',
        message: 'Disposal tax is not calculated for a purchase.',
      });
    if (
      (p.kind === 'rebalance') !== (p.purchase !== null) ||
      (p.kind === 'buy' ? p.lots.length !== 0 : p.lots.length === 0)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Rebalance needs a purchase and reconciled lots; buy has no disposal lots.',
      });
    if (
      new Set(p.lots.map((l) => l.reference)).size !== p.lots.length ||
      new Set(p.lots.map((l) => l.sequence)).size !== p.lots.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Lot references must be unique.',
      });
  });
const Signed = z.string().regex(/^-?\d+$/),
  Whole = z.string().regex(/^\d+$/);
export const ActionPlanOutcomeSchema = z.strictObject({
  kind: ActionPlanSchema.shape.kind,
  tax: EquityTaxResultSchema.optional(),
  materiality: z.strictObject({
    minimumCashChangeMinor: GoalMoneySchema,
    absoluteCashChangeMinor: Whole,
    met: z.boolean(),
  }),
  purchaseIsin: Isin.nullable(),
  purchaseQuantity: z.string().nullable(),
  purchaseCostMinor: Whole,
  saleGrossMinor: Whole,
  realizedGainMinor: Signed,
  lotDisposals: z
    .array(
      z.strictObject({
        reference: z.string(),
        acquiredOn: z.iso.date(),
        quantity: z.string(),
        costMinor: Whole,
        proceedsMinor: Whole,
        gainMinor: Signed,
      }),
    )
    .max(500),
  positions: z
    .array(
      z.strictObject({
        isin: Isin,
        quantity: Quantity,
        costMinor: GoalMoneySchema,
      }),
    )
    .max(1001),
});
const scaled = (value: string, scale: number) => {
  const [w, f = ''] = value.split('.');
  return BigInt(w!) * 10n ** BigInt(scale) + BigInt(f.padEnd(scale, '0'));
};
const units = (v: bigint) => {
  const f = (v % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return String(v / 1000000n) + (f ? '.' + f : '');
};
const max = (a: bigint, b: bigint) => (a > b ? a : b);
/** Current review flags are separate from the immutable calculation at creation. */
export function actionComparisonTimeReview(
  input: ActionCentreInput,
  now: string,
): string[] {
  const today = now.slice(0, 10),
    reasons: string[] = [];
  if (input.price.asOf > today) reasons.push('Primary price is future-dated.');
  else if (
    Date.parse(now) - Date.parse(input.price.asOf + 'T00:00:00Z') >
    7 * 86400000
  )
    reasons.push('Price is beyond the seven-day review window.');
  const purchase = input.plan?.purchase;
  if (purchase?.asOf && purchase.asOf > today)
    reasons.push('Purchase price is future-dated.');
  else if (
    purchase &&
    Date.parse(now) - Date.parse(purchase.asOf + 'T00:00:00Z') > 7 * 86400000
  )
    reasons.push('Purchase price is beyond the seven-day review window.');
  if (input.plan?.taxProfile && today > '2027-03-31')
    reasons.push(
      'The calculated tax policy needs renewed review after March 2027; the saved historical calculation is unchanged.',
    );
  return reasons;
}
export function calculateActionPlan(
  input: ActionCentreInput,
  holdings: HoldingsSnapshot,
  goal: SavedGoal,
  now: string,
  contextWarnings: string[],
) {
  const plan = ActionPlanSchema.parse(input.plan),
    holding = holdings.holdings.find((h) => h.isin === input.isin);
  if (
    !holding ||
    holdings.version !== input.holdingsVersion ||
    goal.id !== input.goalId ||
    goal.version !== input.goalVersion
  )
    throw Error('Holdings or goal changed. Review current inputs.');
  const portfolio = holdings.holdings.reduce(
    (a, h) => a + BigInt(h.totalCostMinor),
    0n,
  );
  if (portfolio !== BigInt(holdings.totalCostMinor))
    throw Error('Saved portfolio cost does not reconcile.');
  const held = scaled(holding.quantity, 6),
    quantity = scaled(input.quantity, 6),
    cost = BigInt(holding.totalCostMinor);
  const saleQuantity = plan.kind === 'buy' ? 0n : quantity;
  if (saleQuantity > held)
    throw Error('Proposed disposal exceeds your saved holding.');
  const gross = (saleQuantity * scaled(input.price.rupees, 8)) / 1000000000000n;
  let disposed = 0n,
    allocatedGross = 0n,
    left = saleQuantity;
  const lotDisposals: z.infer<typeof ActionPlanOutcomeSchema>['lotDisposals'] =
    [];
  if (plan.kind !== 'buy') {
    if (
      plan.lots.reduce((a, l) => a + scaled(l.quantity, 6), 0n) !== held ||
      plan.lots.reduce((a, l) => a + BigInt(l.costMinor), 0n) !== cost
    )
      throw Error(
        'Open acquisition lots must reconcile exactly to saved quantity and cost.',
      );
    if (
      plan.lots.some(
        (l) =>
          l.acquiredOn > input.price.asOf || l.acquiredOn > now.slice(0, 10),
      )
    )
      throw Error('Acquisition dates cannot follow the comparison date.');
    const lots = [...plan.lots].sort(
      (a, b) =>
        a.acquiredOn.localeCompare(b.acquiredOn) || a.sequence - b.sequence,
    );
    for (const lot of lots) {
      if (!left) break;
      const available = scaled(lot.quantity, 6),
        taken = left < available ? left : available;
      const basis =
        taken === available
          ? BigInt(lot.costMinor)
          : (BigInt(lot.costMinor) * taken) / available;
      const proceeds =
        taken === left
          ? gross - allocatedGross
          : (gross * taken) / saleQuantity;
      lotDisposals.push({
        reference: lot.reference,
        acquiredOn: lot.acquiredOn,
        quantity: units(taken),
        costMinor: String(basis),
        proceedsMinor: String(proceeds),
        gainMinor: String(proceeds - basis),
      });
      disposed += basis;
      allocatedGross += proceeds;
      left -= taken;
    }
  }
  const purchase =
    plan.kind === 'buy'
      ? {
          isin: input.isin,
          quantity: input.quantity,
          rupees: input.price.rupees,
          asOf: input.price.asOf,
        }
      : plan.purchase;
  if (purchase && purchase.asOf > now.slice(0, 10))
    throw Error('Purchase price cannot be future-dated.');
  if (plan.kind === 'rebalance' && purchase?.isin === input.isin)
    throw Error('Choose a different purchase security for rebalance.');
  const purchaseGross = purchase
    ? (scaled(purchase.quantity, 6) * scaled(purchase.rupees, 8)) /
      1000000000000n
    : 0n;
  if ((purchase && purchaseGross === 0n) || (saleQuantity > 0n && gross === 0n))
    throw Error('Rounded transaction value must be at least one paise.');
  if (plan.taxProfile && input.costs.taxMinor !== '0')
    throw Error(
      'Leave assumed tax at zero when using the calculated policy to avoid double counting.',
    );
  const taxResult = plan.taxProfile
    ? calculateEquityDisposalTax(
        plan.taxProfile,
        input.price.asOf,
        lotDisposals,
        input.costs.feeMinor,
      )
    : undefined;
  const fees = BigInt(input.costs.feeMinor),
    tax = BigInt(taxResult?.taxMinor ?? input.costs.taxMinor),
    cash = BigInt(input.suitability.availableCashMinor);
  const positions = holdings.holdings.map((h) => ({
    isin: h.isin,
    quantity: scaled(h.quantity, 6),
    cost: BigInt(h.totalCostMinor),
  }));
  const source = positions.find((h) => h.isin === input.isin)!;
  source.quantity -= saleQuantity;
  source.cost -= disposed;
  if (purchase) {
    const target = positions.find((h) => h.isin === purchase.isin);
    if (target) {
      target.quantity += scaled(purchase.quantity, 6);
      target.cost += purchaseGross;
    } else
      positions.push({
        isin: purchase.isin,
        quantity: scaled(purchase.quantity, 6),
        cost: purchaseGross,
      });
  }
  const afterPortfolio = portfolio - disposed + purchaseGross,
    afterCash = cash + gross - purchaseGross - fees - tax;
  const largest = positions.reduce((a, p) => max(a, p.cost), 0n),
    stress =
      (afterPortfolio * BigInt(input.limits.downsideStressBps) + 9999n) /
      10000n;
  const turnoverCost =
    disposed + purchaseGross + BigInt(input.limits.previousTurnoverCostMinor);
  const net = max(gross - purchaseGross - fees - tax, 0n),
    baseline = goalProjection(goal);
  const earmarked = input.earmarkNetProceeds && plan.kind !== 'buy' ? net : 0n,
    projected = BigInt(baseline.projectedMinor) + earmarked;
  const checks: [string, boolean, string, boolean?][] = [
    [
      'risk-understanding',
      input.suitability.understandsRisk,
      'Price and tax uncertainty reviewed.',
      !input.suitability.understandsRisk,
    ],
    [
      'obligations',
      input.suitability.obligationsReviewed,
      'Personal obligations reviewed.',
      !input.suitability.obligationsReviewed,
    ],
    [
      'liquidity',
      quantity <= scaled(input.limits.executableQuantity, 6),
      'Primary transaction fits stated liquidity; rebalance target liquidity needs separate confirmation.',
      plan.kind === 'rebalance',
    ],
    [
      'settlement',
      input.limits.settlementDays <= input.suitability.needsMoneyWithinDays,
      'Assumed settlement fits stated cash need. Rebalance assumes settled proceeds; no intraday credit.',
    ],
    [
      'cash-reserve',
      afterCash >= BigInt(input.suitability.emergencyReserveMinor),
      'After all cash flows, preserve stated reserve.',
    ],
    [
      'concentration',
      largest * 10000n <=
        afterPortfolio * BigInt(input.limits.maximumConcentrationBps),
      'Largest position by acquisition cost, across the complete saved portfolio.',
    ],
    [
      'turnover',
      turnoverCost * 10000n <=
        portfolio * BigInt(input.limits.turnoverBudgetBps),
      'Count both disposed cost and proposed purchase cost plus declared prior turnover.',
    ],
    [
      'downside-capacity',
      stress <= BigInt(input.suitability.lossCapacityMinor),
      'Stress applies to all remaining acquisition cost; not a market forecast.',
    ],
    [
      'cooldown',
      !input.limits.lastDisposalOn ||
        Date.parse(now) -
          Date.parse(input.limits.lastDisposalOn + 'T00:00:00Z') >=
          input.limits.cooldownDays * 86400000,
      'Respect declared prior disposal cooldown.',
      !input.limits.lastDisposalOn && input.limits.cooldownDays > 0,
    ],
    [
      'net-proceeds',
      afterCash >= 0n,
      'Purchase and total fees/taxes must be fully funded; no margin credit.',
    ],
    [
      'materiality',
      (afterCash > cash ? afterCash - cash : cash - afterCash) >=
        BigInt(plan.minimumCashChangeMinor ?? '0'),
      'Absolute cash change meets the explicitly chosen minimum comparison size; this is not a benefit or expected return.',
    ],
  ];
  const constraints = checks.map(([id, pass, description, unknown]) => ({
    id,
    status: !pass
      ? 'breached'
      : unknown
        ? 'needs-review'
        : 'within-assumptions',
    description,
  }));
  return {
    currency: 'INR',
    scale: 2,
    classification: constraints.some((c) => c.status === 'breached')
      ? 'constraints-breached'
      : 'needs-review',
    baseline: {
      holdingQuantity: holding.quantity,
      holdingCostMinor: holding.totalCostMinor,
      portfolioCostMinor: String(portfolio),
      availableCashMinor: String(cash),
      projectedGoalMinor: baseline.projectedMinor,
      goalGapMinor: baseline.gapMinor,
    },
    proposal: {
      grossProceedsMinor: String(gross),
      feeMinor: String(fees),
      taxMinor: String(tax),
      netProceedsMinor: String(net),
      disposedCostMinor: String(disposed),
      remainingQuantity: units(source.quantity),
      remainingHoldingCostMinor: String(source.cost),
      remainingPortfolioCostMinor: String(afterPortfolio),
      afterCashMinor: String(afterCash),
      concentrationBps: afterPortfolio
        ? Number((largest * 10000n) / afterPortfolio)
        : 0,
      turnoverBps: portfolio
        ? Number(((disposed + purchaseGross) * 10000n) / portfolio)
        : 0,
      stressedLossMinor: String(stress),
      projectedGoalMinor: String(projected),
      goalGapMinor: String(max(BigInt(goal.targetMinor) - projected, 0n)),
    },
    constraints,
    warnings: [
      ...contextWarnings,
      ...(input.price.asOf > now.slice(0, 10) ||
      Date.parse(now) - Date.parse(input.price.asOf + 'T00:00:00Z') >
        7 * 86400000
        ? [
            'Primary price is future-dated or beyond the seven-day review window.',
          ]
        : []),
      'Educational proposal versus no action; no trade, holding or goal record is changed.',
      'Acquisition lots and costs are user-attested, not broker-verified. FIFO uses acquisition date then your stated within-day order; partial lot cost rounds down and keeps residual cost.',
      'Realized gain is before disposal fees and tax adjustments. Grandfathering, corporate actions and prior disposals must already be reflected in supplied open lots. No filing liability is inferred.',
      taxResult
        ? 'Restricted tax policy uses attested eligibility and open lots; rounded up to paise, not the final statutory tax-return rounding. Excludes losses, grandfathering, surcharge, unexhausted basic exemption and special reliefs.'
        : 'Tax and combined fees remain explicit assumptions with retained explanation; purchase cost excludes these charges.',
      'All arithmetic uses integer paise and six-decimal units; transaction values round down. Portfolio stress is cost-based, not market value.',
      'Rebalance purchase price is an explicit assumption; funding assumes proceeds have settled.',
      ...(purchase &&
      Date.parse(now) - Date.parse(purchase.asOf + 'T00:00:00Z') > 7 * 86400000
        ? ['Purchase price is beyond the seven-day review window.']
        : []),
      ...(earmarked > 0n
        ? ['Do not earmark proceeds already included in goal savings.']
        : []),
    ],
    action: 'none-educational-comparison',
    plan: {
      kind: plan.kind,
      materiality: {
        minimumCashChangeMinor: plan.minimumCashChangeMinor ?? '0',
        absoluteCashChangeMinor: String(
          afterCash > cash ? afterCash - cash : cash - afterCash,
        ),
        met:
          (afterCash > cash ? afterCash - cash : cash - afterCash) >=
          BigInt(plan.minimumCashChangeMinor ?? '0'),
      },
      ...(taxResult ? { tax: taxResult } : {}),
      purchaseIsin: purchase?.isin ?? null,
      purchaseQuantity: purchase?.quantity ?? null,
      purchaseCostMinor: String(purchaseGross),
      saleGrossMinor: String(gross),
      realizedGainMinor: String(gross - disposed),
      lotDisposals,
      positions: positions
        .filter((p) => p.quantity > 0n)
        .map((p) => ({
          isin: p.isin,
          quantity: units(p.quantity),
          costMinor: String(p.cost),
        })),
    },
  };
}
