import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareGoal,
  adoptGoal,
  goalProjection,
  GoalComparisonInputSchema,
} from '../dist/index.js';
const goal = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 1,
  name: 'Synthetic goal',
  type: 'education',
  savedMinor: '9999999999999999',
  targetMinor: '9999999999999999',
  monthlyMinor: '0',
  horizonMonths: 1,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  projectedMinor: '9999999999999999',
  gapMinor: '0',
};
const input = {
  goalId: goal.id,
  expectedGoalVersion: 1,
  alternatives: [{ monthlyMinor: '9999999999999999', horizonMonths: 1200 }],
  storageConsent: true,
};
test('GOAL-SCENARIOS-001 exact extreme comparison retains unchanged goal and adoption revisions', () => {
  const copy = structuredClone(goal),
    result = compareGoal(
      '00000000-0000-4000-8000-000000000002',
      goal,
      input,
      goal.updatedAt,
    );
  assert.equal(
    result.alternatives[0].projectedMinor,
    (9999999999999999n * 1201n).toString(),
  );
  assert.deepEqual(goal, copy);
  const adoption = adoptGoal(
    result,
    goal,
    {
      requestId: '00000000-0000-4000-8000-000000000003',
      alternativeIndex: 0,
      storageConsent: true,
    },
    goal.updatedAt,
  );
  assert.equal(adoption.goal.version, 2);
  assert.deepEqual(goalProjection(adoption.goal), {
    projectedMinor: result.alternatives[0].projectedMinor,
    gapMinor: '0',
  });
  assert.throws(
    () =>
      adoptGoal(
        result,
        { ...goal, version: 2 },
        {
          requestId: adoption.requestId,
          alternativeIndex: 0,
          storageConsent: true,
        },
        goal.updatedAt,
      ),
    /changed/,
  );
});
test('GOAL-SCENARIOS-001 reject unknown return assumptions and more than3 alternatives', () => {
  assert.equal(
    GoalComparisonInputSchema.safeParse({ ...input, returnPercent: '10' })
      .success,
    false,
  );
  assert.equal(
    GoalComparisonInputSchema.safeParse({
      ...input,
      alternatives: Array(4).fill(input.alternatives[0]),
    }).success,
    false,
  );
});
