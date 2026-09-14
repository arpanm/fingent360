import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureEcbFx } from '../../scripts/ecb-fx-snapshot.mjs';
import {
  EcbFxEditionSchema,
  parseEcbFx,
  compareEcbFx,
  ECB_FX_SOURCE,
  ECB_FX_URL,
  ECB_FX_PARSER,
} from '../../packages/contracts/dist/index.js';
async function current() {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../packages/contracts/test/fixtures/ecb-fx.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const observations = parseEcbFx(fixture.xml).observations;
  const edition = EcbFxEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_FX_PARSER,
    sourceId: ECB_FX_SOURCE,
    sourceUrl: ECB_FX_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    sourceWindow: 'rolling-90-day-file',
    windowStart: observations[0].date,
    windowEnd: observations.at(-1).date,
    observations,
    comparison: compareEcbFx(null, observations),
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
test('FX exporter retains admitted selected numbers and lexical evidence without raw XML', async () => {
  const value = await current(),
    paths = [];
  const captured = await captureEcbFx(async (path) => {
    paths.push(path);
    return path === '/reference-fx'
      ? value
      : { editions: [value.edition], nextBefore: null };
  });
  assert.deepEqual(captured.ecbFxAdmittedEditions, [1]);
  assert.deepEqual(captured.ecbFxHistory, [value.edition]);
  assert.deepEqual(paths, [
    '/reference-fx',
    '/reference-fx/history',
    '/reference-fx',
  ]);
  assert.equal(JSON.stringify(captured).includes('gesmes:Envelope'), false);
});
test('FX snapshot rejects withdrawal races and non-progressing history', async () => {
  const value = await current();
  let reads = 0;
  await assert.rejects(
    captureEcbFx(async (path) =>
      path === '/reference-fx'
        ? ++reads === 1
          ? value
          : { ...value, status: 'withdrawn', edition: null }
        : { editions: [value.edition], nextBefore: null },
    ),
    /changed/,
  );
  await assert.rejects(
    captureEcbFx(async (path) =>
      path === '/reference-fx'
        ? value
        : { editions: [value.edition], nextBefore: 1 },
    ),
    /repeated/,
  );
});
test('withdrawn FX source exports no retained history and performs no history read', async () => {
  const value = { ...(await current()), status: 'withdrawn', edition: null };
  const captured = await captureEcbFx(async (path) => {
    assert.equal(path, '/reference-fx');
    return value;
  });
  assert.deepEqual(captured.ecbFxHistory, []);
  assert.deepEqual(captured.ecbFxAdmittedEditions, []);
});
