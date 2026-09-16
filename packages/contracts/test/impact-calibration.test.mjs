import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateImpact } from '../dist/impact-calibration.js';
const at = '2026-09-15T00:00:00Z';
const missing = {
  status: 'never-published',
  edition: null,
  checkedAt: null,
  reviewedAt: null,
  evaluatedAt: at,
  evaluatedOn: '2026-09-15',
  timeZone: 'Europe/Berlin',
};
test('missing real sources produce a reproducible blocked receipt without fabricated fit', () => {
  const result = calibrateImpact(null, missing, at);
  assert.equal(result.status, 'insufficient-data');
  assert.equal(result.fit, null);
  assert.equal(result.pairs, 0);
  assert.equal(result.forecastEnabled, false);
});
test('synthetic golden perfect linear daily returns reconstruct slope while unadjusted histories remain diagnostic only', () => {
  let x = 100,
    y = 100;
  const observations = [],
    records = [];
  for (let i = 0; i < 90; i++) {
    const date = new Date(Date.parse(at) - (89 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    const dx = ((i % 5) - 2) * 0.001;
    x *= 1 + dx;
    y *= 1 + 2 * dx;
    observations.push({ date, derivedInrPerUsd: { value: String(x) } });
    records.push({
      observation: { kind: 'price', effectiveOn: date, close: String(y) },
    });
  }
  const result = calibrateImpact(
    { records, truncated: false },
    { status: 'published', edition: { observations } },
    at,
  );
  assert.equal(result.status, 'diagnostic-only');
  assert.ok(Math.abs(result.fit.slope - 2) < 1e-9);
  assert.equal(result.forecastEnabled, false);
  assert.ok(result.reasons.some((r) => r.includes('unadjusted')));
  const conflict = calibrateImpact(
    {
      records: [
        ...records,
        {
          observation: {
            kind: 'price',
            effectiveOn: observations[0].date,
            close: '1',
          },
        },
      ],
      truncated: false,
    },
    { status: 'published', edition: { observations } },
    at,
  );
  assert.equal(conflict.fit, null);
});
