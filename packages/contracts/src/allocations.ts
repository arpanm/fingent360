import { z } from 'zod';
import {
  AccountHoldingSchema,
  HoldingsSnapshotSchema,
  type HoldingsSnapshot,
} from './holdings.js';
import { SavedGoalsSchema, type SavedGoal } from './goals.js';
export const AllocationRowInputSchema = z.strictObject({
  goalId: z.uuid(),
  goalVersion: z.number().int().positive(),
  isin: AccountHoldingSchema.shape.isin,
  quantity: AccountHoldingSchema.shape.quantity,
});
export const AllocationRowsInputSchema = z
  .array(AllocationRowInputSchema)
  .max(200)
  .refine(
    (rows) =>
      new Set(rows.map((r) => `${r.goalId}:${r.isin}`)).size === rows.length,
    'Use one row per goal and ISIN.',
  );
export const AllocationWriteSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  expectedHoldingsVersion: z.number().int().nonnegative(),
  rows: AllocationRowsInputSchema,
  storageConsent: z.literal(true),
});
export const AllocationRowSchema = AllocationRowInputSchema.extend({
  goalName: z.string().min(1).max(100),
  recordedCostMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
});
export const AllocationSnapshotSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  holdingsVersion: z.number().int().nonnegative(),
  rows: z.array(AllocationRowSchema).max(200),
  savedAt: z.iso.datetime().nullable(),
  currency: z.literal('INR'),
  scale: z.literal(2),
  method: z.literal('pro-rata-floor-paise-v1'),
});
export const AllocationReviewSchema = z.strictObject({
  goalId: z.uuid(),
  isin: z.string(),
  reasons: z.array(z.string()).min(1),
});
export const AllocationStateSchema = z.strictObject({
  snapshot: AllocationSnapshotSchema,
  goals: SavedGoalsSchema.shape.goals,
  holdings: HoldingsSnapshotSchema,
  review: z.array(AllocationReviewSchema),
  requiresReview: z.boolean(),
});
export const AllocationHistorySchema = z.strictObject({
  revisions: z.array(AllocationSnapshotSchema),
});
export type AllocationInput = z.infer<typeof AllocationWriteSchema>;
export type AllocationRowInput = z.infer<typeof AllocationRowInputSchema>;
export type AllocationSnapshot = z.infer<typeof AllocationSnapshotSchema>;
export type AllocationState = z.infer<typeof AllocationStateSchema>;
export function quantityMillionths(value: string): bigint {
  AccountHoldingSchema.shape.quantity.parse(value);
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}
export function millionthsQuantity(value: bigint): string {
  if (value < 0n) throw Error('Quantity cannot be negative.');
  const fraction = (value % 1000000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return `${value / 1000000n}${fraction ? '.' + fraction : ''}`;
}
export function emptyAllocation(): AllocationSnapshot {
  return {
    version: 0,
    holdingsVersion: 0,
    rows: [],
    savedAt: null,
    currency: 'INR',
    scale: 2,
    method: 'pro-rata-floor-paise-v1',
  };
}
export function makeAllocation(
  input: AllocationInput,
  holdings: HoldingsSnapshot,
  goals: SavedGoal[],
  savedAt: string,
): AllocationSnapshot {
  const totals = new Map<string, bigint>();
  const rows = input.rows.map((row) => {
    const goal = goals.find((g) => g.id === row.goalId);
    if (!goal) throw Error('Choose an active goal belonging to this account.');
    if (goal.version !== row.goalVersion)
      throw Error('Goal changed. Reload and review this allocation.');
    const holding = holdings.holdings.find((h) => h.isin === row.isin);
    if (!holding)
      throw Error('Choose a holding currently recorded in this account.');
    const units = quantityMillionths(row.quantity);
    const allocated = (totals.get(row.isin) ?? 0n) + units;
    totals.set(row.isin, allocated);
    if (allocated > quantityMillionths(holding.quantity))
      throw Error(
        `Allocated quantity exceeds recorded holdings for ${row.isin}.`,
      );
    return {
      ...row,
      quantity: millionthsQuantity(units),
      goalName: goal.name,
      recordedCostMinor: (
        (BigInt(holding.totalCostMinor) * units) /
        quantityMillionths(holding.quantity)
      ).toString(),
    };
  });
  return AllocationSnapshotSchema.parse({
    version: input.expectedVersion + 1,
    holdingsVersion: holdings.version,
    rows,
    savedAt,
    currency: 'INR',
    scale: 2,
    method: 'pro-rata-floor-paise-v1',
  });
}
export function allocationState(
  snapshot: AllocationSnapshot,
  holdings: HoldingsSnapshot,
  goals: SavedGoal[],
): AllocationState {
  const totals = new Map<string, bigint>();
  for (const row of snapshot.rows)
    totals.set(
      row.isin,
      (totals.get(row.isin) ?? 0n) + quantityMillionths(row.quantity),
    );
  const review = snapshot.rows.flatMap((row) => {
    const reasons: string[] = [];
    const goal = goals.find((g) => g.id === row.goalId);
    const holding = holdings.holdings.find((h) => h.isin === row.isin);
    if (!goal) reasons.push('Goal was removed. Remove or reassign this row.');
    else if (goal.version !== row.goalVersion)
      reasons.push('Goal changed since this allocation was saved.');
    if (!holding) reasons.push('Holding was removed from your records.');
    else if (totals.get(row.isin)! > quantityMillionths(holding.quantity))
      reasons.push('Total allocated quantity now exceeds recorded holdings.');
    if (holdings.version !== snapshot.holdingsVersion)
      reasons.push(
        'Holdings changed. Review quantities and recorded cost before saving again.',
      );
    return reasons.length
      ? [{ goalId: row.goalId, isin: row.isin, reasons }]
      : [];
  });
  return AllocationStateSchema.parse({
    snapshot,
    holdings,
    goals,
    review,
    requiresReview: review.length > 0,
  });
}
