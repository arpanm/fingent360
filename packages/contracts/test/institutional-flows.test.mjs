import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseInstitutionalFlows } from '../dist/index.js';
const fixture = (source) => ({
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  source,
  body: readFileSync(
    new URL(
      './fixtures/institutional-flows/' +
        (source === 'nse-cash-html' ? 'nse' : 'cdsl') +
        '-synthetic.html',
      import.meta.url,
    ),
    'utf8',
  ),
  rightsEvidence: 'TEST-SIMULATION, no real source permission.',
  rightsConfirmed: true,
});
const parse = (input) =>
  parseInstitutionalFlows(
    input,
    'a'.repeat(64),
    '2026-09-15T00:00:00.000Z',
    createHash('sha256').update(input.body).digest('hex'),
  );
test('NSE-only and combined scopes remain distinct exact provisional crore reports', () => {
  const value = parse(fixture('nse-cash-html'));
  assert.deepEqual(
    value.datasets.map((d) => d.scope),
    ['NSE', 'NSE-BSE-MSEI'],
  );
  assert.equal(value.datasets[0].rows[1].net, '-5.00');
  assert.equal(value.datasets[0].dateMeaning, 'trade-date-provisional');
});
test('CDSL preserves older cash date, route subtotals and newer derivative contract counts', () => {
  const value = parse(fixture('cdsl-daily-html'));
  assert.equal(value.datasets[0].effectiveOn, '2024-08-30');
  assert.equal(value.datasets[1].effectiveOn, '2026-09-10');
  assert.equal(value.datasets[0].rows.at(-1).net, '48.00');
  assert.equal(value.datasets[1].rows[0].openContracts, '3');
});
test('changed units, incomplete scopes, missing routes and unreconciled amounts fail closed', () => {
  for (const [source, from, to] of [
    ['nse-cash-html', '₹ Crores', '₹ lakh'],
    ['nse-cash-html', 'fiidiiTableNse', 'wrongTable'],
    ['cdsl-daily-html', 'Debt-VRR', 'Debt-FAR'],
    ['cdsl-daily-html', '48.00', '49.00'],
  ]) {
    const input = fixture(source);
    input.body = input.body.replace(from, to);
    assert.throws(() => parse(input));
  }
});
