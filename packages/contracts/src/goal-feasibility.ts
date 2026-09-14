import { z } from 'zod';
import { GoalMoneySchema, SavedGoalSchema, goalProjection } from './goals.js';

const Minor = z.string().regex(/^(0|[1-9][0-9]{0,23})$/);
export const GoalFeasibilityInputSchema = z.strictObject({
  goalId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  affordableMonthlyMinor: GoalMoneySchema.nullable(),
  interruptionMonths: z.number().int().min(0).max(1200).nullable(),
  protectedSavingsMinor: GoalMoneySchema.nullable(),
  storageConsent: z.literal(true),
});
export type GoalFeasibilityInput = z.infer<typeof GoalFeasibilityInputSchema>;

export function calculateGoalFeasibility(
  goal: z.infer<typeof SavedGoalSchema>,
  input: GoalFeasibilityInput,
) {
  const baseline = goalProjection(goal);
  if (
    input.interruptionMonths !== null &&
    input.interruptionMonths > goal.horizonMonths
  )
    throw Error('Interruption cannot exceed the saved goal horizon.');
  if (
    input.affordableMonthlyMinor === null ||
    input.interruptionMonths === null ||
    input.protectedSavingsMinor === null
  )
    return {
      status: 'unknown' as const,
      baselineProjectedMinor: baseline.projectedMinor,
      baselineGapMinor: baseline.gapMinor,
      stressedProjectedMinor: null,
      stressedGapMinor: null,
      overBudgetMonthlyMinor: null,
      reserveDeficitMinor: null,
    };
  const monthly = BigInt(goal.monthlyMinor),
    budget = BigInt(input.affordableMonthlyMinor);
  const saved = BigInt(goal.savedMinor),
    reserve = BigInt(input.protectedSavingsMinor);
  const target = BigInt(goal.targetMinor),
    nonnegative = (value: bigint) => (value > 0n ? value : 0n);
  const stressed =
    nonnegative(saved - reserve) +
    (monthly < budget ? monthly : budget) *
      BigInt(goal.horizonMonths - input.interruptionMonths);
  const gap = nonnegative(target - stressed),
    over = nonnegative(monthly - budget);
  const deficit = nonnegative(reserve - saved);
  return {
    status:
      gap || over || deficit
        ? ('shortfall' as const)
        : ('within-entered-limits' as const),
    baselineProjectedMinor: baseline.projectedMinor,
    baselineGapMinor: baseline.gapMinor,
    stressedProjectedMinor: stressed.toString(),
    stressedGapMinor: gap.toString(),
    overBudgetMonthlyMinor: over.toString(),
    reserveDeficitMinor: deficit.toString(),
  };
}
const Result = z.strictObject({
  status: z.enum(['unknown', 'shortfall', 'within-entered-limits']),
  baselineProjectedMinor: Minor,
  baselineGapMinor: Minor,
  stressedProjectedMinor: Minor.nullable(),
  stressedGapMinor: Minor.nullable(),
  overBudgetMonthlyMinor: Minor.nullable(),
  reserveDeficitMinor: Minor.nullable(),
});
export const GoalFeasibilitySchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    policy: z.literal('downside-capacity-v1'),
    currency: z.literal('INR'),
    scale: z.literal(2),
    goal: SavedGoalSchema,
    input: GoalFeasibilityInputSchema,
    result: Result,
  })
  .superRefine((value, context) => {
    if (
      value.goal.id !== value.input.goalId ||
      value.goal.version !== value.input.expectedVersion
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Captured goal revision mismatch.',
      });
      return;
    }
    try {
      const baseline = goalProjection(value.goal);
      if (
        baseline.projectedMinor !== value.goal.projectedMinor ||
        baseline.gapMinor !== value.goal.gapMinor
      )
        context.addIssue({
          code: 'custom',
          message: 'Saved goal projection does not reconcile.',
        });
      if (Date.parse(value.goal.updatedAt) > Date.parse(value.createdAt))
        context.addIssue({
          code: 'custom',
          message: 'Goal revision was not available when assessed.',
        });
      if (
        JSON.stringify(calculateGoalFeasibility(value.goal, value.input)) !==
        JSON.stringify(value.result)
      )
        context.addIssue({
          code: 'custom',
          message: 'Assessment does not reconcile.',
        });
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Invalid assessment assumptions.',
      });
    }
  });
export type GoalFeasibility = z.infer<typeof GoalFeasibilitySchema>;
export const GoalFeasibilityExportSchema = z.strictObject({
  assessments: z.array(GoalFeasibilitySchema).max(100),
  deletedRequestCount: z.number().int().nonnegative(),
});
export const GoalFeasibilitiesSchema = z.strictObject({
  assessments: z.array(GoalFeasibilitySchema).max(100),
});
