import { z } from 'zod';
export const GoalMoneySchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,15})$/, 'Use whole paise, up to 16 digits.');
export const SavedGoalInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['retirement', 'education', 'purchase', 'emergency', 'other']),
  targetMinor: GoalMoneySchema.refine(
    (v) => /^(0|[1-9][0-9]{0,15})$/.test(v) && BigInt(v) > 0n,
    'Target must be positive.',
  ),
  savedMinor: GoalMoneySchema,
  monthlyMinor: GoalMoneySchema,
  horizonMonths: z.number().int().min(1).max(1200),
  currency: z.literal('INR'),
  scale: z.literal(2),
  assumptions: z.literal('no-growth-nominal-v1'),
  storageConsent: z.literal(true),
});
export const SavedGoalSchema = SavedGoalInputSchema.extend({
  id: z.uuid(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  projectedMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  gapMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
});
export const SavedGoalsSchema = z.strictObject({
  goals: z.array(SavedGoalSchema).max(100),
});
export const SavedGoalUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  goal: SavedGoalInputSchema,
});
export const SavedGoalDeleteSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});
export const SavedGoalHistorySchema = z.strictObject({
  revisions: z.array(SavedGoalSchema),
});
export type SavedGoalInput = z.infer<typeof SavedGoalInputSchema>;
export type SavedGoal = z.infer<typeof SavedGoalSchema>;
export function goalProjection(input: SavedGoalInput) {
  const projected =
    BigInt(input.savedMinor) +
    BigInt(input.monthlyMinor) * BigInt(input.horizonMonths);
  const gap = BigInt(input.targetMinor) - projected;
  return {
    projectedMinor: projected.toString(),
    gapMinor: (gap > 0n ? gap : 0n).toString(),
  };
}
export function rupeesToGoalMinor(value: string): string {
  if (!/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,2})?$/.test(value))
    throw new Error(
      'Enter a nonnegative INR amount with at most two decimal places.',
    );
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}
export function goalMinorToRupees(value: string): string {
  const amount = BigInt(value);
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`;
}
