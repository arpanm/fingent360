import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReview, valuePortfolio, parseCsv, round } from '../dist/journey-domain.js';
import { PortfolioInputSchema } from '@fingent360/contracts';
const goal = { id: '00000000-0000-4000-8000-000000000001', name: 'Education', type: 'education', target: '1000.00', targetDate: '2030-01-01', priority: 'essential', allocationPercent: 40 };
const portfolio = { holdings: [{ instrumentId: 'alpha-air', quantity: '10' }], cash: '1000.00', goals: [goal] };
test('golden exposure and goal funding use exact amounts', () => {
  const result = valuePortfolio(portfolio);
  assert.equal(result.total, '2000.00');
  assert.equal(result.affected, '1000.00');
  assert.equal(result.affectedPercent, '50.00');
  assert.equal(result.goals[0].funded, '800.00');
  assert.equal(result.goals[0].affected, '400.00');
  assert.equal(result.unallocated, '1200.00');
});
test('half-even rounding and zero denominator are explicit', () => {
  assert.equal(round(5n, 2n), 2n);
  assert.equal(round(7n, 2n), 4n);
  assert.equal(valuePortfolio({ holdings: [], cash: '0.00', goals: [] }).affectedPercent, null);
  assert.equal(valuePortfolio({ ...portfolio, holdings: [{ instrumentId: 'alpha-air', quantity: '0.00015' }] }).positions[0].value, '0.02');
});
test('invalid financial inputs and excessive allocations reject', () => {
  for (const quantity of ['-1', '1e3', 'NaN', '0', '1.0000001'])
    assert.equal(PortfolioInputSchema.safeParse({ ...portfolio, holdings: [{ instrumentId: 'alpha-air', quantity }] }).success, false);
  assert.equal(PortfolioInputSchema.safeParse({ ...portfolio, goals: [{ ...goal, allocationPercent: 101 }] }).success, false);
  assert.equal(PortfolioInputSchema.safeParse({ ...portfolio, extra: true }).success, false);
});
test('review blockers never become no-review conclusions', () => {
  assert.equal(createReview(portfolio, 1, 'baseline').status, 'review');
  for (const scenario of ['stale', 'conflicting']) assert.equal(createReview(portfolio, 1, scenario).status, 'unable_to_assess');
  assert.equal(createReview({ ...portfolio, goals: [] }, 1, 'baseline').status, 'unable_to_assess');
  assert.equal(createReview({ ...portfolio, holdings: [{ instrumentId: 'bharat-software', quantity: '1' }] }, 1, 'baseline').status, 'no_review_trigger');
});
test('CSV rejects duplicate/unknown rows and accepts BOM/CRLF', () => {
  assert.deepEqual(parseCsv('\uFEFFinstrumentId,quantity\r\nalpha-air,10\r\n').holdings, portfolio.holdings);
  for (const csv of ['instrumentId,quantity\nalpha-air,10\nalpha-air,10', 'instrumentId,quantity\nunknown,1', 'wrong,header\nalpha-air,1']) {
    assert.ok(parseCsv(csv).issues.length);
    assert.deepEqual(parseCsv(csv).holdings, []);
  }
});

test('minor-unit allocation remainder is retained and boundary sums stay valid', () => {
  const result = valuePortfolio({ holdings: [], cash: '0.01', goals: [{ ...goal, allocationPercent: 50 }] });
  assert.equal(result.goals[0].funded, '0.00');
  assert.equal(result.unallocated, '0.01');
  assert.equal(valuePortfolio({ holdings: [{ instrumentId: 'alpha-air', quantity: '999999999' }], cash: '999999999999.99', goals: [] }).total, '1099999999899.99');
});
