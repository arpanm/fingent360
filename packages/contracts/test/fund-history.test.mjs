import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseAmfiNav,
  FundDetailSchema,
  AMFI_LEGACY_NAV_URL,
} from '../dist/index.js';

test('NAV continuity uses exact decimal equivalence and rejects a forged reconciliation', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/funds-bonds.json', import.meta.url),
      'utf8',
    ),
  );
  const observation = parseAmfiNav(fixture.navText)[0];
  const edition = {
    id: '10000000-0000-4000-8000-000000000001',
    sourceUrl: AMFI_LEGACY_NAV_URL,
    hash: 'a'.repeat(64),
    retrievedAt: '2025-02-01T00:00:00.000Z',
    count: 2,
    parser: 'amfi-navall-v1',
  };
  const input = {
    schemeCode: observation.schemeCode,
    history: [
      { observation, edition },
      {
        observation: { ...observation, nav: '123.4567' },
        edition: { ...edition, id: '10000000-0000-4000-8000-000000000002' },
      },
    ],
    truncated: false,
    lookThrough: 'not-connected',
  };
  const result = FundDetailSchema.parse(input);
  assert.deepEqual(result.reconciliation.conflictingDates, []);
  assert.equal(result.reconciliation.status, 'insufficient-history');
  assert.deepEqual(FundDetailSchema.parse(result), result);
  assert.equal(
    FundDetailSchema.safeParse({
      ...result,
      reconciliation: {
        ...result.reconciliation,
        status: 'consistent-retained-records',
      },
    }).success,
    false,
  );
  input.history[1].observation.nav = '123.45670001';
  assert.equal(
    FundDetailSchema.parse(input).reconciliation.status,
    'review-required',
  );
  input.history[1].observation.schemeCode = '999999';
  assert.equal(FundDetailSchema.safeParse(input).success, false);
});
