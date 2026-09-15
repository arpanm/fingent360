import { ActionCentreInputSchema } from '../../../packages/contracts/src/index';
export function actionCentreInput(goalId: string) {
  return ActionCentreInputSchema.parse({
    isin: 'INE002A01018',
    holdingsVersion: 1,
    goalId,
    goalVersion: 1,
    traceId: null,
    quantity: '1',
    price: {
      rupees: '200',
      asOf: new Date().toISOString().slice(0, 10),
      basis: 'user-assumption',
      editionId: null,
      sourceHash: null,
    },
    costs: {
      feeMinor: '100',
      taxMinor: '200',
      basis: 'user-assumption',
      note: 'Synthetic explicit fee and tax totals; not an actual tax calculation.',
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
  });
}
