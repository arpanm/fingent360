import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGoalFeasibility,
  GoalFeasibilityInputSchema,
  GoalFeasibilitySchema,
} from '../dist/index.js';
const goal = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 1,
  name: 'Synthetic capacity',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '20000',
  monthlyMinor: '10000',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
  projectedMinor: '140000',
  gapMinor: '0',
};
const input = {
  goalId: goal.id,
  expectedVersion: 1,
  affordableMonthlyMinor: '8000',
  interruptionMonths: 3,
  protectedSavingsMinor: '10000',
  storageConsent: true,
};
test('GOAL-FEASIBILITY-001 exact downside golden reconciles savings reserve and interruption', () => {
  const before = structuredClone(goal);
  assert.deepEqual(calculateGoalFeasibility(goal, input), {
    status: 'shortfall',
    baselineProjectedMinor: '140000',
    baselineGapMinor: '0',
    stressedProjectedMinor: '82000',
    stressedGapMinor: '18000',
    overBudgetMonthlyMinor: '2000',
    reserveDeficitMinor: '0',
  });
  assert.deepEqual(goal, before);
});
test('unknown is not zero, reserve deficit and horizon endpoints remain explicit', () => {
  assert.equal(
    calculateGoalFeasibility(goal, { ...input, affordableMonthlyMinor: null })
      .stressedProjectedMinor,
    null,
  );
  assert.equal(
    calculateGoalFeasibility(goal, {
      ...input,
      interruptionMonths: 12,
      protectedSavingsMinor: '30000',
    }).reserveDeficitMinor,
    '10000',
  );
  assert.equal(
    calculateGoalFeasibility(goal, {
      ...input,
      interruptionMonths: 0,
      protectedSavingsMinor: '0',
      affordableMonthlyMinor: '10000',
    }).status,
    'within-entered-limits',
  );
  assert.throws(() =>
    calculateGoalFeasibility(goal, { ...input, interruptionMonths: 13 }),
  );
});
test('exact large amounts and strict no-return schema', () => {
  const value = calculateGoalFeasibility(
    {
      ...goal,
      savedMinor: '9007199254740993',
      monthlyMinor: '1',
      targetMinor: '9999999999999999',
    },
    {
      ...input,
      affordableMonthlyMinor: '1',
      interruptionMonths: 0,
      protectedSavingsMinor: '0',
    },
  );
  assert.equal(value.stressedProjectedMinor, '9007199254741005');
  assert.equal(
    GoalFeasibilityInputSchema.safeParse({ ...input, annualReturn: '12' })
      .success,
    false,
  );
  const receipt = {
    id: goal.id,
    createdAt: goal.createdAt,
    goal,
    input,
    policy: 'downside-capacity-v1',
    currency: 'INR',
    scale: 2,
    result: calculateGoalFeasibility(goal, input),
  };
  assert.equal(GoalFeasibilitySchema.safeParse(receipt).success, true);
  receipt.result.stressedGapMinor = '0';
  assert.equal(GoalFeasibilitySchema.safeParse(receipt).success, false);
});
