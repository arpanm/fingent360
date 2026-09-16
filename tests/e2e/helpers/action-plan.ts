import { actionCentreInput } from './action-centre';
import { ActionCentreInputSchema } from '../../../packages/contracts/src/index';
export function actionPlanInput(
  goalId: string,
  kind: 'buy' | 'rebalance' | 'sell-fifo' = 'rebalance',
) {
  return ActionCentreInputSchema.parse({
    ...actionCentreInput(goalId),
    plan: {
      kind,
      purchase:
        kind === 'rebalance'
          ? {
              isin: 'INE009A01021',
              quantity: '2',
              rupees: '50',
              asOf: new Date().toISOString().slice(0, 10),
            }
          : null,
      lots:
        kind === 'buy'
          ? []
          : [
              {
                reference: 'Synthetic opening A',
                sequence: 0,
                acquiredOn: '2024-01-02',
                quantity: '1',
                costMinor: '2000',
              },
              {
                reference: 'Synthetic opening B',
                sequence: 1,
                acquiredOn: '2024-02-02',
                quantity: '2.000001',
                costMinor: '8000',
              },
            ],
      evidenceNote:
        'Synthetic open-lot fixture, not a customer statement or tax filing.',
    },
  });
}
export function actionTaxProfile() {
  return {
    policy: 'resident-listed-equity-no-surcharge-2024-v1' as const,
    residentIndividual: true as const,
    capitalAssetNotBusiness: true as const,
    sttConditionsMet: true as const,
    basicExemptionExhausted: true as const,
    noLossOffsetsOrSpecialReliefs: true as const,
    totalTaxableIncomeMinor: '60000000',
    priorEligibleLongTermGainsMinor: '12500000',
    deductibleDisposalFeesMinor: '100',
  };
}
