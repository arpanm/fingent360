import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileHoldings, holdingsTotal } from '../dist/index.js';
const row = (isin, quantity, totalCostMinor) => ({
  isin,
  quantity,
  totalCostMinor,
});
const baselineRows = [
  row('INE002A01018', '1.000001', '9007199254740993'),
  row('INE009A01021', '2', '200'),
  row('INE467B01029', '3', '300'),
];
const baseline = {
  version: 1,
  holdings: baselineRows,
  totalCostMinor: holdingsTotal(baselineRows),
  currency: 'INR',
  scale: 2,
  provenance: 'user-entered-unverified',
  updatedAt: '2026-09-14T00:00:00.000Z',
};
const dependencies = {
  allocationRows: 2,
  holdingConnections: 1,
  checkedAt: '2026-09-14T00:00:00.000Z',
};
test('replacement compares exact financial records, absent sides and unchanged lexical equivalents', () => {
  const review = reconcileHoldings(
    baseline,
    [
      row('INE002A01018', '0.000001', '9007199254740992'),
      row('INE009A01021', '2.000000', '200'),
      row('INE040A01034', '1', '100'),
    ],
    dependencies,
  );
  const byId = Object.fromEntries(
    review.changes.map((change) => [change.isin, change]),
  );
  assert.equal(byId.INE002A01018.status, 'changed');
  assert.equal(byId.INE002A01018.quantityDelta, '-1');
  assert.equal(byId.INE002A01018.costDeltaMinor, '-1');
  assert.equal(byId.INE009A01021.status, 'unchanged');
  assert.equal(byId.INE467B01029.status, 'removed');
  assert.equal(byId.INE467B01029.after, null);
  assert.equal(byId.INE040A01034.before, null);
  assert.equal(byId.INE040A01034.status, 'added');
  assert.equal(review.totalCostDeltaMinor, '-201');
  assert.deepEqual(review.dependencies, dependencies);
  assert.deepEqual(baseline.holdings, baselineRows);
});
test('empty replacement lists every removal and rejects an inconsistent captured baseline', () => {
  const review = reconcileHoldings(baseline, [], dependencies);
  assert.equal(review.changes.length, 3);
  assert.ok(review.changes.every((change) => change.status === 'removed'));
  assert.equal(review.totalCostDeltaMinor, '-' + baseline.totalCostMinor);
  assert.throws(
    () =>
      reconcileHoldings({ ...baseline, totalCostMinor: '0' }, [], dependencies),
    /do not reconcile/,
  );
});
