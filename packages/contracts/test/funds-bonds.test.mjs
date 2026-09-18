import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseAmfiNav,
  datedXirr,
  calculateBondComparison,
  BondComparisonInputSchema,
  BondEvidencePolicySchema,
  CORPORATE_RATINGS,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
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

test('bond evidence accepts each credit branch and rejects a canonical-shaped hybrid observation', () => {
  const descriptionOnly = {
    version: 'bond-evidence-policy-v1',
    priceBasis: 'user-entered-estimate',
    evaluatedPrice: 'not-supplied',
    tradingLiquidity: 'not-established',
    recommendation: false,
    assessmentOn: '2026-05-14',
    credit: { status: 'user-description-only' },
  };
  assert.deepEqual(
    BondEvidencePolicySchema.parse(descriptionOnly),
    descriptionOnly,
  );
  const observation = CORPORATE_RATINGS.find(
    (row) => row.isin === 'INE031A08939',
  );
  assert.ok(observation);
  const policy = {
    version: 'bond-evidence-policy-v1',
    priceBasis: 'user-entered-estimate',
    evaluatedPrice: 'not-supplied',
    tradingLiquidity: 'not-established',
    recommendation: false,
    assessmentOn: '2026-05-14',
    credit: {
      status: 'historical-original-attached',
      editionId: '99999999-9999-4999-8999-999999999999',
      sourceUrl: CORPORATE_RATING_SOURCE.url,
      sourceHash: CORPORATE_RATING_SOURCE.hash,
      sourceVersion: CORPORATE_RATING_VERSION,
      publishedOn: CORPORATE_RATING_SOURCE.documentDate,
      annexureAsOf: '2026-03-31',
      reviewedAt: '2026-05-14T00:00:00.000Z',
      admissionWindowDays: 90,
      observation,
    },
  };
  assert.deepEqual(BondEvidencePolicySchema.parse(policy), policy);
  assert.throws(() =>
    BondEvidencePolicySchema.parse({
      ...policy,
      credit: {
        ...policy.credit,
        observation: { ...observation, couponPercent: '5.62' },
      },
    }),
  );
});

test('AMFI eight-column layout preserves plan/option and never shifts them into NAV', async () => {
  const body = await readFile(
    new URL('./fixtures/amfi-nav-v2.txt', import.meta.url),
    'utf8',
  );
  const rows = parseAmfiNav(body);
  assert.equal(rows[0].nav, '123.4500');
  assert.equal(rows[0].plan, 'Direct Plan');
  assert.equal(rows[1].option, 'IDCW Option');
  assert.equal(rows[2].plan, null);
  assert.equal(rows[2].nav, null);
  assert.throws(() =>
    parseAmfiNav(body.replace(';Plan;Option;', ';Unknown;Option;')),
  );
  assert.throws(() =>
    parseAmfiNav(body.replace(';Direct Plan;Growth Option;', ';Direct Plan;')),
  );
});
