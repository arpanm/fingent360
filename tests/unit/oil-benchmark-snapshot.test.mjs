import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureOilBenchmarks } from '../../scripts/oil-benchmark-snapshot.mjs';
import {
  OilBenchmarkEditionSchema,
  roundOilSource,
  OIL_BENCHMARK_SOURCE,
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_PARSER,
} from '../../packages/contracts/dist/index.js';
async function current() {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../packages/contracts/test/fixtures/oil-benchmarks.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const observations = ['BRENT', 'WTI'].flatMap((series) =>
    fixture.rows.map((row) => {
      const sourceValue = row[series === 'BRENT' ? 'brent' : 'wti'];
      return {
        series,
        period: row.period.replace('M', '-'),
        sourceValue,
        value: sourceValue === null ? null : roundOilSource(sourceValue),
      };
    }),
  );
  const edition = OilBenchmarkEditionSchema.parse({
    edition: 1,
    parserVersion: OIL_BENCHMARK_PARSER,
    sourceId: OIL_BENCHMARK_SOURCE,
    sourceUrl: OIL_BENCHMARK_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    reportedUpdatedOn: fixture.reportedUpdatedOn,
    sourceHash: 'a'.repeat(64),
    unit: 'USD-per-barrel',
    region: 'global-benchmarks',
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    precision: 1,
    transformation: 'workbook-display-half-away-from-zero',
    observations,
  });
  return {
    status: 'published',
    edition,
    checkedAt: edition.retrievedAt,
    reviewedAt: edition.retrievedAt,
    evaluatedAt: edition.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'UTC',
  };
}
test('oil exporter retains admitted selected numbers and lexical evidence without full workbook', async () => {
  const value = await current(),
    paths = [];
  const captured = await captureOilBenchmarks(async (path) => {
    paths.push(path);
    return path === '/oil-benchmarks'
      ? value
      : { editions: [value.edition], nextBefore: null };
  });
  assert.deepEqual(captured.oilBenchmarkAdmittedEditions, [1]);
  assert.deepEqual(captured.oilBenchmarkHistory, [value.edition]);
  assert.deepEqual(paths, [
    '/oil-benchmarks',
    '/oil-benchmarks/history',
    '/oil-benchmarks',
  ]);
  assert.equal(JSON.stringify(captured).includes('base64'), false);
});
test('oil snapshot rejects withdrawal races and non-progressing history', async () => {
  const value = await current();
  let reads = 0;
  await assert.rejects(
    captureOilBenchmarks(async (path) =>
      path === '/oil-benchmarks'
        ? ++reads === 1
          ? value
          : { ...value, status: 'withdrawn', edition: null }
        : { editions: [value.edition], nextBefore: null },
    ),
    /changed/,
  );
  await assert.rejects(
    captureOilBenchmarks(async (path) =>
      path === '/oil-benchmarks'
        ? value
        : { editions: [value.edition], nextBefore: 1 },
    ),
    /repeated/,
  );
});
test('withdrawn oil source exports no retained history and performs no history read', async () => {
  const value = { ...(await current()), status: 'withdrawn', edition: null };
  const captured = await captureOilBenchmarks(async (path) => {
    assert.equal(path, '/oil-benchmarks');
    return value;
  });
  assert.deepEqual(captured.oilBenchmarkHistory, []);
  assert.deepEqual(captured.oilBenchmarkAdmittedEditions, []);
});
