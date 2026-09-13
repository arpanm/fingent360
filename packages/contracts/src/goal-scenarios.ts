import { z } from 'zod';
import {
  SavedGoalSchema,
  GoalMoneySchema,
  goalProjection,
  type SavedGoal,
} from './goals.js';
export const GoalAlternativeSchema = z.strictObject({
  monthlyMinor: GoalMoneySchema,
  horizonMonths: z.number().int().min(1).max(1200),
});
export const GoalComparisonInputSchema = z.strictObject({
  goalId: z.uuid(),
  expectedGoalVersion: z.number().int().positive(),
  alternatives: z.array(GoalAlternativeSchema).min(1).max(3),
  storageConsent: z.literal(true),
});
const Integer = z.string().regex(/^-?(0|[1-9][0-9]*)$/);
export const GoalAlternativeResultSchema = GoalAlternativeSchema.extend({
  projectedMinor: GoalMoneySchema.or(z.string().regex(/^[1-9][0-9]{16,20}$/)),
  gapMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  projectedDifferenceMinor: Integer,
  gapDifferenceMinor: Integer,
});
export const GoalComparisonSchema = z.strictObject({
  id: z.uuid(),
  baseline: SavedGoalSchema,
  alternatives: z.array(GoalAlternativeResultSchema).min(1).max(3),
  savedAt: z.iso.datetime(),
  assumptions: z.literal('no-growth-nominal-v1'),
});
export const GoalAdoptionInputSchema = z.strictObject({
  requestId: z.uuid(),
  alternativeIndex: z.number().int().min(0).max(2),
  storageConsent: z.literal(true),
});
export const GoalAdoptionSchema = z.strictObject({
  requestId: z.uuid(),
  comparisonId: z.uuid(),
  alternativeIndex: z.number().int().min(0).max(2),
  goal: SavedGoalSchema,
  adoptedAt: z.iso.datetime(),
});
export const GoalComparisonsSchema = z.strictObject({
  comparisons: z.array(GoalComparisonSchema).max(100),
  adoptions: z.array(GoalAdoptionSchema),
  goals: z.array(SavedGoalSchema).max(100),
});
export const GoalScenarioExportSchema = z.strictObject({
  comparisons: z.array(GoalComparisonSchema),
  adoptions: z.array(GoalAdoptionSchema),
});
export type GoalComparison = z.infer<typeof GoalComparisonSchema>;
export type GoalAdoption = z.infer<typeof GoalAdoptionSchema>;
export function compareGoal(
  id: string,
  baseline: SavedGoal,
  input: z.infer<typeof GoalComparisonInputSchema>,
  now: string,
): GoalComparison {
  if (
    baseline.id !== input.goalId ||
    baseline.version !== input.expectedGoalVersion
  )
    throw Error(
      'Goal changed. Reload and create a comparison from its current edition.',
    );
  const unchanged = goalProjection(baseline);
  return GoalComparisonSchema.parse({
    id,
    baseline: { ...baseline, ...unchanged },
    alternatives: input.alternatives.map((option) => {
      const result = goalProjection({ ...baseline, ...option });
      return {
        ...option,
        ...result,
        projectedDifferenceMinor: (
          BigInt(result.projectedMinor) - BigInt(unchanged.projectedMinor)
        ).toString(),
        gapDifferenceMinor: (
          BigInt(result.gapMinor) - BigInt(unchanged.gapMinor)
        ).toString(),
      };
    }),
    savedAt: now,
    assumptions: 'no-growth-nominal-v1',
  });
}
export function adoptGoal(
  comparison: GoalComparison,
  current: SavedGoal,
  input: z.infer<typeof GoalAdoptionInputSchema>,
  now: string,
): GoalAdoption {
  if (
    current.id !== comparison.baseline.id ||
    current.version !== comparison.baseline.version
  )
    throw Error('Goal changed. Create a new comparison before adopting.');
  const option = comparison.alternatives[input.alternativeIndex];
  if (!option) throw Error('Choose an existing alternative.');
  const change = {
    ...current,
    monthlyMinor: option.monthlyMinor,
    horizonMonths: option.horizonMonths,
  };
  return GoalAdoptionSchema.parse({
    requestId: input.requestId,
    comparisonId: comparison.id,
    alternativeIndex: input.alternativeIndex,
    goal: {
      ...change,
      ...goalProjection(change),
      version: current.version + 1,
      updatedAt: now,
    },
    adoptedAt: now,
  });
}
