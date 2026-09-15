import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseAmfiNav,
  datedXirr,
  calculateBondComparison,
  BondComparisonInputSchema,
} from '../dist/index.js';
const fixture = async () =>
  JSON.parse(
    await readFile(
      new URL('./fixtures/funds-bonds.json', import.meta.url),
      'utf8',
    ),
  );
test('AMFI synthetic shape preserves plan identities precision missing NAV and source rows', async () => {
  const value = await fixture(),
    rows = parseAmfiNav(value.navText);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].nav, '123.456700');
  assert.equal(rows[1].nav, null);
  assert.equal(rows[0].schemeCode, '108001');
  assert.equal(rows[0].observedOn, '2025-01-31');
  assert.notEqual(rows[0].name, rows[1].name);
});
test('AMFI rejects unknown header duplicate code and truncated row', async () => {
  const { navText } = await fixture();
  assert.throws(() =>
    parseAmfiNav(navText.replace('Net Asset Value', 'Changed')),
  );
  assert.throws(() => parseAmfiNav(navText.replace('108002', '108001')));
  assert.throws(() => parseAmfiNav(navText.replace(';31-Jan-2025', '')));
});
test('dated XIRR conventional year return is ten percent with exact same-day netting', () => {
  const result = datedXirr([
    { date: '2025-01-01', amountPaise: '-10000' },
    { date: '2026-01-01', amountPaise: '11000' },
  ]);
  assert.equal(result.status, 'unique');
  assert.equal(result.annualPercent, '10.00000000');
  assert.equal(
    datedXirr([
      { date: '2025-01-01', amountPaise: '-10000' },
      { date: '2025-01-01', amountPaise: '5000' },
      { date: '2026-01-01', amountPaise: '5000' },
    ]).annualPercent,
    '0.00000000',
  );
});
test('non-conventional multiple-root candidate and no-root cashflows are never reported as a unique yield', () => {
  assert.equal(
    datedXirr([
      { date: '2025-01-01', amountPaise: '-100' },
      { date: '2026-01-01', amountPaise: '230' },
      { date: '2027-01-01', amountPaise: '-132' },
    ]).status,
    'non-conventional',
  );
  assert.equal(
    datedXirr([
      { date: '2025-01-01', amountPaise: '100' },
      { date: '2026-01-01', amountPaise: '200' },
    ]).status,
    'no-root',
  );
  assert.equal(
    datedXirr([
      { date: '2025-01-01', amountPaise: '-100' },
      { date: '2025-01-01', amountPaise: '100' },
    ]).status,
    'no-root',
  );
});
test('bond accrual fees and deposit comparison reconcile in integer paise', async () => {
  const { comparison } = await fixture(),
    result = calculateBondComparison(comparison);
  assert.equal(result.accruedPaise, '4972');
  assert.equal(result.totalOutlayPaise, '105072');
  assert.equal(result.totalReceiptsPaise, '120000');
  assert.equal(result.netGainPaise, '14928');
  assert.equal(result.depositInterestPaise, '3958');
  assert.equal(result.depositDeductionPaise, '396');
  assert.equal(result.depositMaturityPaise, '108634');
  assert.equal(result.xirr.status, 'unique');
});
test('bond settlement and future cashflow boundaries reject impossible assumptions', async () => {
  const { comparison } = await fixture();
  assert.equal(
    BondComparisonInputSchema.safeParse({
      ...comparison,
      nextCouponOn: comparison.settlementOn,
    }).success,
    false,
  );
  assert.equal(
    BondComparisonInputSchema.safeParse({
      ...comparison,
      cashflows: [{ date: comparison.settlementOn, amountPaise: '100' }],
    }).success,
    false,
  );
});
