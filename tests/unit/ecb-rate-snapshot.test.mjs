import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureEcbRates } from '../../scripts/ecb-rate-snapshot.mjs';
import {
  EcbRateEditionSchema,
  parseEcbRates,
  ECB_RATE_PARSER,
  ECB_RATE_SOURCE,
  ECB_RATE_URL,
} from '../../packages/contracts/dist/index.js';
async function current() {
  const parsed = parseEcbRates(
    await readFile(
      new URL(
        '../../packages/contracts/test/fixtures/ecb-policy-rates.xml',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const edition = EcbRateEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_RATE_PARSER,
    sourceId: ECB_RATE_SOURCE,
    sourceUrl: ECB_RATE_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    responsePreparedAt: parsed.responsePreparedAt,
    sourceHash: 'a'.repeat(64),
    unit: 'percent-per-annum',
    region: 'euro-area',
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    observations: parsed.observations,
  });
  return {
    status: 'published',
    edition,
    checkedAt: edition.retrievedAt,
    reviewedAt: edition.retrievedAt,
    evaluatedAt: edition.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'Europe/Berlin',
  };
}
test('synthetic exporter records only admitted complete public history and does not persist raw data', async () => {
  const value = await current(),
    paths = [];
  const captured = await captureEcbRates(async (path) => {
    paths.push(path);
    return path === '/policy-rates'
      ? value
      : { editions: [value.edition], nextBefore: null };
  });
  assert.deepEqual(captured.policyRateAdmittedEditions, [1]);
  assert.deepEqual(captured.policyRateHistory, [value.edition]);
  assert.deepEqual(paths, [
    '/policy-rates',
    '/policy-rates/history',
    '/policy-rates',
  ]);
});
test('snapshot rejects a withdrawal racing capture and repeated non-progressing pages', async () => {
  const value = await current();
  let reads = 0;
  await assert.rejects(
    captureEcbRates(async (path) =>
      path === '/policy-rates'
        ? ++reads === 1
          ? value
          : { ...value, status: 'withdrawn', edition: null }
        : { editions: [value.edition], nextBefore: null },
    ),
    /changed/,
  );
  await assert.rejects(
    captureEcbRates(async (path) =>
      path === '/policy-rates'
        ? value
        : { editions: [value.edition], nextBefore: 1 },
    ),
    /repeated/,
  );
});
test('withdrawn snapshots carry no retained numerical history and need no history request', async () => {
  const value = { ...(await current()), status: 'withdrawn', edition: null };
  const captured = await captureEcbRates(async (path) => {
    assert.equal(path, '/policy-rates');
    return value;
  });
  assert.deepEqual(captured.policyRateAdmittedEditions, []);
  assert.deepEqual(captured.policyRateHistory, []);
});
