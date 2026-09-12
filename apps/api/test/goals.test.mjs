import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SavedGoalInputSchema,
  goalProjection,
  rupeesToGoalMinor,
  goalMinorToRupees,
} from '@fingent360/contracts';
const input = {
  name: 'Synthetic fixture',
  type: 'education',
  targetMinor: '9999999999999999',
  savedMinor: '9007199254740993',
  monthlyMinor: '1',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
test('goal amounts preserve paise beyond binary number precision', () => {
  assert.equal(rupeesToGoalMinor('90071992547409.93'), '9007199254740993');
  assert.equal(goalMinorToRupees('9007199254740993'), '90071992547409.93');
  assert.equal(
    goalProjection(SavedGoalInputSchema.parse(input)).projectedMinor,
    '9007199254741005',
  );
  assert.equal(goalProjection({ ...input, targetMinor: '1' }).gapMinor, '0');
});
test('goal input rejects rounding, unknown fields and unstated consent', () => {
  for (const targetMinor of ['1.01', 'not-money', '1e6', '']) {
    assert.equal(
      SavedGoalInputSchema.safeParse({ ...input, targetMinor }).success,
      false,
    );
  }
  assert.throws(() => rupeesToGoalMinor('1.001'));
  assert.throws(() => rupeesToGoalMinor('-1'));
  assert.equal(
    SavedGoalInputSchema.safeParse({ ...input, storageConsent: false }).success,
    false,
  );
  assert.equal(
    SavedGoalInputSchema.safeParse({ ...input, targetMinor: 10 }).success,
    false,
  );
  assert.equal(
    SavedGoalInputSchema.safeParse({ ...input, annualReturn: '10' }).success,
    false,
  );
});
