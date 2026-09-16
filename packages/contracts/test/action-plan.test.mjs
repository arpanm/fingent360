import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateActionCentre,
  actionComparisonTimeReview,
  ActionCentreInputSchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
} from '../dist/index.js';
const at = '2026-09-15T00:00:00.000Z';
const goal = SavedGoalSchema.parse({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  version: 1,
  name: 'Synthetic goal',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '1000',
  monthlyMinor: '100',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
  createdAt: at,
  updatedAt: at,
  projectedMinor: '2200',
  gapMinor: '97800',
});
const holdings = HoldingsSnapshotSchema.parse({
  version: 1,
  holdings: [
    { isin: 'INE002A01018', quantity: '3.000001', totalCostMinor: '10000' },
  ],
  totalCostMinor: '10000',
  currency: 'INR',
  scale: 2,
  provenance: 'user-entered-unverified',
  updatedAt: at,
});
function input(kind = 'rebalance') {
  return ActionCentreInputSchema.parse({
    isin: 'INE002A01018',
    holdingsVersion: 1,
    goalId: goal.id,
    goalVersion: 1,
    traceId: null,
    quantity: '1',
    price: {
      rupees: '200',
      asOf: '2026-09-15',
      basis: 'user-assumption',
      editionId: null,
      sourceHash: null,
    },
    costs: {
      feeMinor: '100',
      taxMinor: '200',
      basis: 'user-assumption',
      note: 'Synthetic explicit totals.',
    },
    suitability: {
      availableCashMinor: '50000',
      emergencyReserveMinor: '10000',
      lossCapacityMinor: '1000',
      understandsRisk: true,
      obligationsReviewed: true,
      needsMoneyWithinDays: 30,
    },
    limits: {
      executableQuantity: '1',
      settlementDays: 2,
      maximumConcentrationBps: 10000,
      turnoverBudgetBps: 4000,
      previousTurnoverCostMinor: '0',
      lastDisposalOn: null,
      cooldownDays: 7,
      downsideStressBps: 1000,
      basis: 'user-assumption',
    },
    earmarkNetProceeds: true,
    storageConsent: true,
    educationalAcknowledgement: true,
    plan: {
      kind,
      purchase:
        kind === 'rebalance'
          ? {
              isin: 'INE009A01021',
              quantity: '2',
              rupees: '50',
              asOf: '2026-09-15',
            }
          : null,
      lots:
        kind === 'buy'
          ? []
          : [
              {
                reference: 'First',
                sequence: 0,
                acquiredOn: '2024-01-02',
                quantity: '1',
                costMinor: '2000',
              },
              {
                reference: 'Second',
                sequence: 1,
                acquiredOn: '2024-02-02',
                quantity: '2.000001',
                costMinor: '8000',
              },
            ],
      evidenceNote: 'Synthetic reconciled open lots.',
    },
  });
}
test('FIFO rebalance conserves exact quantity, cost and cash across both legs', () => {
  const value = calculateActionCentre(input(), holdings, goal, at);
  assert.equal(value.proposal.afterCashMinor, '59700');
  assert.equal(value.proposal.remainingPortfolioCostMinor, '18000');
  assert.deepEqual(value.plan.positions, [
    { isin: 'INE002A01018', quantity: '2.000001', costMinor: '8000' },
    { isin: 'INE009A01021', quantity: '2', costMinor: '10000' },
  ]);
  assert.equal(value.plan.realizedGainMinor, '18000');
  assert.equal(value.proposal.projectedGoalMinor, '11900');
});
test('purchase consumes cash without creating fictitious goal savings', () => {
  const value = calculateActionCentre(input('buy'), holdings, goal, at);
  assert.equal(value.proposal.afterCashMinor, '29700');
  assert.equal(value.proposal.remainingQuantity, '4.000001');
  assert.equal(value.proposal.projectedGoalMinor, '2200');
  assert.equal(value.plan.realizedGainMinor, '0');
});
test('partial FIFO allocation retains the unsold residual cost exactly', () => {
  const value = input('sell-fifo');
  value.quantity = '1.500001';
  const result = calculateActionCentre(value, holdings, goal, at);
  assert.equal(result.proposal.disposedCostMinor, '4000');
  assert.equal(result.proposal.remainingHoldingCostMinor, '6000');
  assert.equal(result.proposal.remainingQuantity, '1.5');
  assert.equal(
    result.plan.lotDisposals
      .reduce((a, l) => a + BigInt(l.proceedsMinor), 0n)
      .toString(),
    result.proposal.grossProceedsMinor,
  );
});
test('same-day explicit order is used and missing quantity/cost or duplicate order is refused', () => {
  const value = input('sell-fifo');
  value.plan.lots[1].acquiredOn = '2024-01-02';
  value.plan.lots[0].sequence = 1;
  value.plan.lots[1].sequence = 0;
  assert.equal(
    calculateActionCentre(value, holdings, goal, at).plan.lotDisposals[0]
      .reference,
    'Second',
  );
  value.plan.lots[0].sequence = 0;
  assert.throws(() => calculateActionCentre(value, holdings, goal, at));
  const bad = input();
  bad.plan.lots[0].costMinor = '1999';
  assert.throws(
    () => calculateActionCentre(bad, holdings, goal, at),
    /reconcile/,
  );
});
test('unfunded purchase breaches cash and funding even with no disposal', () => {
  const value = input('buy');
  value.suitability.availableCashMinor = '0';
  const result = calculateActionCentre(value, holdings, goal, at);
  assert.equal(result.classification, 'constraints-breached');
  assert.equal(
    result.constraints.find((c) => c.id === 'net-proceeds').status,
    'breached',
  );
});

test('FIFO primary price age remains visible instead of disappearing in the plan branch', () => {
  const value = input('sell-fifo');
  value.price.asOf = '2026-01-01';
  assert.ok(
    calculateActionCentre(value, holdings, goal, at).warnings.some((w) =>
      w.includes('Primary price'),
    ),
  );
});
test('saved rebalance price and tax freshness are recomputed without changing its receipt inputs', () => {
  const value = input(),
    before = JSON.stringify(value);
  value.plan.purchase.asOf = '2026-09-01';
  assert.deepEqual(actionComparisonTimeReview(value, at), [
    'Purchase price is beyond the seven-day review window.',
  ]);
  value.plan.purchase.asOf = '2026-09-15';
  assert.equal(JSON.stringify(value), before);
  assert.deepEqual(actionComparisonTimeReview(value, at), []);
  value.plan.taxProfile = {
    policy: 'resident-listed-equity-no-surcharge-2024-v1',
    residentIndividual: true,
    capitalAssetNotBusiness: true,
    sttConditionsMet: true,
    basicExemptionExhausted: true,
    noLossOffsetsOrSpecialReliefs: true,
    totalTaxableIncomeMinor: '60000000',
    priorEligibleLongTermGainsMinor: '12500000',
    deductibleDisposalFeesMinor: '0',
  };
  assert.ok(
    actionComparisonTimeReview(value, '2027-04-01T00:00:00.000Z').some(
      (reason) => reason.includes('renewed review'),
    ),
  );
  assert.equal(value.plan.purchase.asOf, '2026-09-15');
});
