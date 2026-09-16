import {
  ResearchPolicyBindingSchema,
  ResearchGovernanceRevisionSchema,
  type ResearchGovernanceRevision,
} from './research-governance.js';
import {
  ActionPlanSchema,
  ActionPlanOutcomeSchema,
  calculateActionPlan,
} from './action-plan.js';
import { z } from 'zod';
import {
  AccountHoldingSchema,
  HoldingsSnapshotSchema,
  type HoldingsSnapshot,
} from './holdings.js';
import {
  SavedGoalSchema,
  GoalMoneySchema,
  goalProjection,
  type SavedGoal,
} from './goals.js';
import { ImpactTraceReceiptSchema } from './impact-trace.js';
import { EquityCompanySchema } from './equity-coverage.js';
const PriceSchema = z
  .strictObject({
    rupees: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$/)
      .refine((value) => /[1-9]/.test(value), 'Price must be positive.'),
    asOf: z.iso.date(),
    basis: z.enum(['user-assumption', 'published-equity-close']),
    editionId: z.uuid().nullable(),
    sourceHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .superRefine((value, context) => {
    if (
      (value.basis === 'published-equity-close') !==
        (value.editionId !== null && value.sourceHash !== null) ||
      (value.basis === 'user-assumption' &&
        (value.editionId || value.sourceHash))
    )
      context.addIssue({
        code: 'custom',
        message:
          'Select an exact published close or an explicitly labelled assumption.',
      });
  });
export const ActionCentreInputSchema = z.strictObject({
  researchPolicy: ResearchPolicyBindingSchema.optional(),
  plan: ActionPlanSchema.optional(),
  isin: AccountHoldingSchema.shape.isin,
  holdingsVersion: z.number().int().positive(),
  goalId: z.uuid(),
  goalVersion: z.number().int().positive(),
  traceId: z.uuid().nullable(),
  quantity: AccountHoldingSchema.shape.quantity,
  price: PriceSchema,
  costs: z.strictObject({
    feeMinor: GoalMoneySchema,
    taxMinor: GoalMoneySchema,
    basis: z.literal('user-assumption'),
    note: z.string().trim().min(5).max(500),
  }),
  suitability: z.strictObject({
    availableCashMinor: GoalMoneySchema,
    emergencyReserveMinor: GoalMoneySchema,
    lossCapacityMinor: GoalMoneySchema,
    understandsRisk: z.boolean(),
    obligationsReviewed: z.boolean(),
    needsMoneyWithinDays: z.number().int().min(0).max(36500),
  }),
  limits: z.strictObject({
    executableQuantity: AccountHoldingSchema.shape.quantity,
    settlementDays: z.number().int().min(0).max(365),
    maximumConcentrationBps: z.number().int().min(0).max(10000),
    turnoverBudgetBps: z.number().int().min(0).max(10000),
    previousTurnoverCostMinor: GoalMoneySchema,
    lastDisposalOn: z.iso.date().nullable(),
    cooldownDays: z.number().int().min(0).max(3650),
    downsideStressBps: z.number().int().min(0).max(10000),
    basis: z.literal('user-assumption'),
  }),
  earmarkNetProceeds: z.boolean(),
  storageConsent: z.literal(true),
  educationalAcknowledgement: z.literal(true),
});
export type ActionCentreInput = z.infer<typeof ActionCentreInputSchema>;
const Whole = z.string().regex(/^\d+$/);
const ConstraintSchema = z.strictObject({
  id: z.enum([
    'materiality',
    'risk-understanding',
    'obligations',
    'liquidity',
    'settlement',
    'cash-reserve',
    'concentration',
    'turnover',
    'downside-capacity',
    'net-proceeds',
    'cooldown',
  ]),
  status: z.enum(['within-assumptions', 'breached', 'needs-review']),
  description: z.string(),
});
export const ActionCentreResultSchema = z.strictObject({
  plan: ActionPlanOutcomeSchema.optional(),
  currency: z.literal('INR'),
  scale: z.literal(2),
  classification: z.enum([
    'constraints-breached',
    'needs-review',
    'within-assumptions',
  ]),
  baseline: z.strictObject({
    holdingQuantity: z.string(),
    holdingCostMinor: Whole,
    portfolioCostMinor: Whole,
    availableCashMinor: Whole,
    projectedGoalMinor: Whole,
    goalGapMinor: Whole,
  }),
  proposal: z.strictObject({
    grossProceedsMinor: Whole,
    feeMinor: Whole,
    taxMinor: Whole,
    netProceedsMinor: Whole,
    disposedCostMinor: Whole,
    remainingQuantity: z.string(),
    remainingHoldingCostMinor: Whole,
    remainingPortfolioCostMinor: Whole,
    afterCashMinor: z.string().regex(/^-?\d+$/),
    concentrationBps: z.number().int().min(0).max(10000),
    turnoverBps: z.number().int().min(0),
    stressedLossMinor: Whole,
    projectedGoalMinor: Whole,
    goalGapMinor: Whole,
  }),
  constraints: z.array(ConstraintSchema).min(10).max(11),
  warnings: z.array(z.string()).min(1),
  action: z.literal('none-educational-comparison'),
});
export const ActionCentreReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    policy: z.enum([
      'proposed-disposal-education-v1',
      'proposed-trades-education-v2',
    ]),
    input: ActionCentreInputSchema,
    holdings: HoldingsSnapshotSchema,
    goal: SavedGoalSchema,
    trace: ImpactTraceReceiptSchema.nullable(),
    equity: EquityCompanySchema.nullable(),
    researchPolicy: ResearchGovernanceRevisionSchema.optional(),
    contextWarnings: z.array(z.string()),
    result: ActionCentreResultSchema,
  })
  .superRefine((value, context) => {
    try {
      const expected = calculateActionCentre(
        value.input,
        value.holdings,
        value.goal,
        value.createdAt,
        value.contextWarnings,
        value.researchPolicy,
      );
      if (
        value.policy !==
          (value.input.plan
            ? 'proposed-trades-education-v2'
            : 'proposed-disposal-education-v1') ||
        JSON.stringify(expected) !== JSON.stringify(value.result) ||
        !actionPriceBindingCurrent(value.input, value.equity) ||
        value.input.traceId !== (value.trace?.id ?? null) ||
        (value.trace &&
          (value.trace.input.isin !== value.input.isin ||
            value.trace.goal.id !== value.goal.id))
      )
        throw Error('mismatch');
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Comparison must reconstruct from its exact input and retained records.',
      });
    }
  });
export type ActionCentreReceipt = z.infer<typeof ActionCentreReceiptSchema>;
export const ActionCentreListSchema = z.strictObject({
  assessments: z
    .array(
      z.strictObject({
        receipt: ActionCentreReceiptSchema,
        reviewReasons: z.array(z.string()),
      }),
    )
    .max(100),
});
export const ActionCentreChoicesSchema = z.strictObject({
  researchPolicies: z
    .array(ResearchGovernanceRevisionSchema)
    .max(100)
    .default([]),
  holdings: HoldingsSnapshotSchema,
  goals: z.array(SavedGoalSchema).max(100),
  traces: z.array(ImpactTraceReceiptSchema).max(100),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
function scaled(value: string, scale: number) {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole!) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'))
  );
}
function units(value: bigint) {
  const whole = value / 1000000n,
    fraction = (value % 1000000n)
      .toString()
      .padStart(6, '0')
      .replace(/0+$/, '');
  return `${whole}${fraction ? '.' + fraction : ''}`;
}
export function actionPriceBindingCurrent(
  input: ActionCentreInput,
  equity: z.infer<typeof EquityCompanySchema> | null,
) {
  if (input.price.basis === 'user-assumption') return true;
  return (
    !!equity &&
    equity.isin === input.isin &&
    equity.records.some(
      (row) =>
        row.editionId === input.price.editionId &&
        row.hash === input.price.sourceHash &&
        row.observation.kind === 'price' &&
        row.observation.currency === 'INR' &&
        row.observation.effectiveOn === input.price.asOf &&
        row.observation.close === input.price.rupees,
    )
  );
}
export function calculateActionCentre(
  raw: ActionCentreInput,
  holdings: HoldingsSnapshot,
  goal: SavedGoal,
  now: string,
  contextWarnings: string[] = [],
  policyRevision?: ResearchGovernanceRevision,
) {
  raw = applyActionGovernancePolicy(raw, policyRevision, now);
  if (policyRevision)
    contextWarnings = [
      ...contextWarnings,
      `Released educational policy ${policyRevision.input.title}, version ${policyRevision.version}, applies stricter caps and minimum tests; it does not enable advice or trading.`,
    ];
  if (raw.plan)
    return ActionCentreResultSchema.parse(
      calculateActionPlan(
        ActionCentreInputSchema.parse(raw),
        holdings,
        goal,
        now,
        contextWarnings,
      ),
    );
  const input = ActionCentreInputSchema.parse(raw),
    holding = holdings.holdings.find((item) => item.isin === input.isin);
  if (
    !holding ||
    input.holdingsVersion !== holdings.version ||
    input.goalId !== goal.id ||
    input.goalVersion !== goal.version
  )
    throw Error('Your holdings or goal changed. Review current inputs.');
  const proposedUnits = scaled(input.quantity, 6),
    heldUnits = scaled(holding.quantity, 6);
  if (proposedUnits > heldUnits)
    throw Error('Proposed quantity exceeds your saved holding.');
  const portfolioCost = holdings.holdings.reduce(
    (sum, item) => sum + BigInt(item.totalCostMinor),
    0n,
  );
  if (portfolioCost !== BigInt(holdings.totalCostMinor))
    throw Error('Saved portfolio cost does not reconcile.');
  const holdingCost = BigInt(holding.totalCostMinor),
    disposedCost = (holdingCost * proposedUnits) / heldUnits;
  const gross =
    (proposedUnits * scaled(input.price.rupees, 8)) / 1000000000000n;
  const fees = BigInt(input.costs.feeMinor),
    tax = BigInt(input.costs.taxMinor);
  const charges = fees + tax,
    net = gross > charges ? gross - charges : 0n;
  const remainingCost = holdingCost - disposedCost,
    remainingPortfolio = portfolioCost - disposedCost;
  const remainingUnits = heldUnits - proposedUnits;
  const concentration = remainingPortfolio
    ? Number((remainingCost * 10000n) / remainingPortfolio)
    : 0;
  const turnover = portfolioCost
    ? Number((disposedCost * 10000n) / portfolioCost)
    : 0;
  const stress =
    (remainingCost * BigInt(input.limits.downsideStressBps) + 9999n) / 10000n;
  const cash = BigInt(input.suitability.availableCashMinor),
    afterCash = cash + gross - charges;
  const baseline = goalProjection(goal),
    projected =
      BigInt(baseline.projectedMinor) + (input.earmarkNetProceeds ? net : 0n),
    gap = BigInt(goal.targetMinor) - projected;
  const constraint = (
    id: z.infer<typeof ConstraintSchema>['id'],
    pass: boolean,
    description: string,
    unknown = false,
  ) => ({
    id,
    status: unknown
      ? ('needs-review' as const)
      : pass
        ? ('within-assumptions' as const)
        : ('breached' as const),
    description,
  });
  const constraints = [
    constraint(
      'risk-understanding',
      input.suitability.understandsRisk,
      'Confirm understanding of price, tax and liquidity uncertainty.',
      !input.suitability.understandsRisk,
    ),
    constraint(
      'obligations',
      input.suitability.obligationsReviewed,
      'Review financial obligations independently of this comparison.',
      !input.suitability.obligationsReviewed,
    ),
    constraint(
      'liquidity',
      proposedUnits <= scaled(input.limits.executableQuantity, 6),
      'Proposed units cannot exceed your explicitly assumed executable quantity.',
    ),
    constraint(
      'settlement',
      input.limits.settlementDays <= input.suitability.needsMoneyWithinDays,
      'Assumed settlement must occur before your stated cash need.',
    ),
    constraint(
      'cash-reserve',
      afterCash >= BigInt(input.suitability.emergencyReserveMinor),
      'Available cash after assumed fees/taxes must preserve the stated reserve.',
    ),
    constraint(
      'concentration',
      remainingCost * 10000n <=
        remainingPortfolio * BigInt(input.limits.maximumConcentrationBps),
      'Remaining holding share uses acquisition cost, not market value.',
    ),
    constraint(
      'turnover',
      (disposedCost + BigInt(input.limits.previousTurnoverCostMinor)) *
        10000n <=
        portfolioCost * BigInt(input.limits.turnoverBudgetBps),
      'This and your declared prior disposed acquisition cost must fit the cost-based turnover budget.',
    ),
    constraint(
      'downside-capacity',
      stress <= BigInt(input.suitability.lossCapacityMinor),
      'Explicit remaining-cost stress must fit stated loss capacity; this is not a forecast.',
    ),
    constraint(
      'cooldown',
      !input.limits.lastDisposalOn ||
        Date.parse(now) -
          Date.parse(input.limits.lastDisposalOn + 'T00:00:00Z') >=
          input.limits.cooldownDays * 86400000,
      'Respect the declared cooldown from the last disposal date; this comparison does not record a trade.',
      input.limits.lastDisposalOn === null && input.limits.cooldownDays > 0,
    ),
    constraint(
      'net-proceeds',
      gross >= charges,
      'Assumed disposal proceeds must cover the entered fees and taxes.',
    ),
  ];
  const warnings = [
    ...contextWarnings,
    'This compares your proposed disposal with no action. It does not recommend a transaction or change your records.',
    'Fee and tax amounts, liquidity, settlement, reserve and risk limits are explicit user assumptions; no legal tax rate is inferred.',
    'Acquisition-cost concentration, turnover and stress are not market-value risk measures.',
    'Average acquisition cost is proportional and rounded down to a paise; it is not a tax-lot or realised-gain calculation.',
    'Gross proceeds round down and downside stress rounds up to a paise. No-action assumes no growth, inflation or future taxes.',
    ...(input.earmarkNetProceeds
      ? [
          'The goal comparison hypothetically earmarks net proceeds once. Actual goal and cash records remain unchanged.',
          'If goal savings already include this holding, earmarking proceeds again double-counts wealth. Review the allocation before relying on this comparison.',
        ]
      : []),
  ];
  const date = Date.parse(input.price.asOf + 'T00:00:00Z'),
    current = Date.parse(now);
  if (date > current || current - date > 7 * 86400000)
    warnings.push(
      'Price date is future-dated or beyond the seven-day review window.',
    );
  if (input.price.basis === 'user-assumption')
    warnings.push(
      'Price is a user assumption, not a verified current market quote.',
    );
  const needsReview =
    contextWarnings.length > 0 ||
    input.price.basis === 'user-assumption' ||
    date > current ||
    current - date > 7 * 86400000 ||
    portfolioCost === 0n;
  return ActionCentreResultSchema.parse({
    currency: 'INR',
    scale: 2,
    classification: constraints.some((item) => item.status === 'breached')
      ? 'constraints-breached'
      : needsReview ||
          constraints.some((item) => item.status === 'needs-review')
        ? 'needs-review'
        : 'within-assumptions',
    baseline: {
      holdingQuantity: holding.quantity,
      holdingCostMinor: holding.totalCostMinor,
      portfolioCostMinor: portfolioCost.toString(),
      availableCashMinor: cash.toString(),
      projectedGoalMinor: baseline.projectedMinor,
      goalGapMinor: baseline.gapMinor,
    },
    proposal: {
      grossProceedsMinor: gross.toString(),
      feeMinor: fees.toString(),
      taxMinor: tax.toString(),
      netProceedsMinor: net.toString(),
      disposedCostMinor: disposedCost.toString(),
      remainingQuantity: units(remainingUnits),
      remainingHoldingCostMinor: remainingCost.toString(),
      remainingPortfolioCostMinor: remainingPortfolio.toString(),
      afterCashMinor: afterCash.toString(),
      concentrationBps: concentration,
      turnoverBps: turnover,
      stressedLossMinor: stress.toString(),
      projectedGoalMinor: projected.toString(),
      goalGapMinor: (gap > 0n ? gap : 0n).toString(),
    },
    constraints,
    warnings,
    action: 'none-educational-comparison',
  });
}

export function applyActionGovernancePolicy(
  input: ActionCentreInput,
  revision: ResearchGovernanceRevision | undefined,
  at: string,
): ActionCentreInput {
  if (!input.researchPolicy) {
    if (revision) throw Error('Unexpected released policy snapshot.');
    return input;
  }
  if (
    !revision ||
    revision.id !== input.researchPolicy.id ||
    revision.version !== input.researchPolicy.version ||
    revision.input.content.kind !== 'educational-policy' ||
    revision.input.reviewBy < at.slice(0, 10)
  )
    throw Error('Choose a current admitted educational policy release.');
  const rules = revision.input.content.rules;
  return {
    ...input,
    limits: {
      ...input.limits,
      maximumConcentrationBps: Math.min(
        input.limits.maximumConcentrationBps,
        rules.maximumConcentrationBps,
      ),
      turnoverBudgetBps: Math.min(
        input.limits.turnoverBudgetBps,
        rules.turnoverBudgetBps,
      ),
      cooldownDays: Math.max(
        input.limits.cooldownDays,
        rules.minimumCooldownDays,
      ),
      downsideStressBps: Math.max(
        input.limits.downsideStressBps,
        rules.minimumDownsideStressBps,
      ),
    },
  };
}
