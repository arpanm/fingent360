import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquityDisposalTax } from '../dist/index.js';
const profile = {
  policy: 'resident-listed-equity-no-surcharge-2024-v1',
  residentIndividual: true,
  capitalAssetNotBusiness: true,
  sttConditionsMet: true,
  basicExemptionExhausted: true,
  noLossOffsetsOrSpecialReliefs: true,
  totalTaxableIncomeMinor: '60000000',
  priorEligibleLongTermGainsMinor: '12500000',
  deductibleDisposalFeesMinor: '100',
};
const lot = {
  reference: 'Synthetic',
  acquiredOn: '2024-01-02',
  costMinor: '2000',
  proceedsMinor: '20000',
};
test('eligible long-term disposal uses remaining annual threshold, deductible fee and stated rounding', () => {
  const result = calculateEquityDisposalTax(
    profile,
    '2026-09-15',
    [lot],
    '100',
  );
  assert.equal(result.longTermGainMinor, '17900');
  assert.equal(result.taxMinor, '2328');
  assert.equal(result.cessMinor, '90');
  const exempt = calculateEquityDisposalTax(
    { ...profile, priorEligibleLongTermGainsMinor: '0' },
    '2026-09-15',
    [lot],
    '100',
  );
  assert.equal(exempt.taxMinor, '0');
  assert.equal(exempt.longTermExemptionUsedMinor, '17900');
});
test('twelve-month boundary is short term; following day is long term', () => {
  const input = { ...profile, deductibleDisposalFeesMinor: '0' };
  assert.equal(
    calculateEquityDisposalTax(
      input,
      '2026-09-15',
      [{ ...lot, acquiredOn: '2025-09-15' }],
      '0',
    ).shortTermGainMinor,
    '18000',
  );
  assert.equal(
    calculateEquityDisposalTax(
      input,
      '2026-09-16',
      [{ ...lot, acquiredOn: '2025-09-15' }],
      '0',
    ).longTermGainMinor,
    '18000',
  );
});
test('unsupported income, grandfathering, loss and excessive deducted fees cannot silently produce tax', () => {
  for (const [p, l] of [
    [{ ...profile, totalTaxableIncomeMinor: '500000001' }, lot],
    [profile, { ...lot, acquiredOn: '2018-01-31' }],
    [profile, { ...lot, proceedsMinor: '1' }],
    [{ ...profile, deductibleDisposalFeesMinor: '101' }, lot],
  ])
    assert.throws(() =>
      calculateEquityDisposalTax(p, '2026-09-15', [l], '100'),
    );
});
test('zero total proceeds cannot enter proportional fee allocation', () => {
  assert.throws(
    () =>
      calculateEquityDisposalTax(
        { ...profile, deductibleDisposalFeesMinor: '0' },
        '2026-09-15',
        [
          { ...lot, costMinor: '0', proceedsMinor: '0' },
          { ...lot, reference: 'Second', costMinor: '0', proceedsMinor: '0' },
        ],
        '0',
      ),
    /positive total proceeds/,
  );
});
