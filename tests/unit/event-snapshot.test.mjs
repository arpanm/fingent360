import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { captureEvents } from '../../scripts/event-snapshot.mjs';
import {
  EventSaveSchema,
  buildEventRevision,
} from '../../packages/contracts/dist/index.js';
async function fixture() {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const source = bundle.feed.find(
      (row) =>
        row.status === 'published' && row.sourceHash && row.title.length >= 8,
    ),
    id = randomUUID();
  const at = new Date(
    Math.max(Date.now(), Date.parse(source.source.retrievedAt)),
  ).toISOString();
  const input = EventSaveSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    revisionReason: 'Synthetic export fixture',
    editorial: {
      title: 'Synthetic export event',
      family: 'Policy',
      geography: ['India'],
      claimKind: 'inference',
      explanation: 'Synthetic editorial context only.',
      announcedAt: null,
      effectiveAt: null,
      citations: [
        {
          sourceId: source.id,
          version: source.version,
          hash: source.sourceHash,
          field: 'title',
          quote: source.title,
        },
      ],
      links: [],
    },
  });
  const event = buildEventRevision(id, 1, at, input, [source], [], randomUUID);
  event.graph.events[0].publicationState = 'published';
  return {
    bundle,
    record: { id, status: 'published', event, evaluatedAt: at, reviewedAt: at },
  };
}
test('snapshot refuses publication change after history pages instead of exporting stale body', async () => {
  const { bundle, record } = await fixture();
  let reads = 0;
  await assert.rejects(
    captureEvents(async (path) => {
      if (path === '/events')
        return { items: [record], next: null, evaluatedAt: record.evaluatedAt };
      if (path.endsWith('/history'))
        return {
          revisions: [{ version: 1, recordedAt: record.reviewedAt }],
          nextBefore: null,
        };
      if (++reads === 1) return record;
      return { ...record, status: 'withdrawn', event: null };
    }, bundle),
    /publication changed/,
  );
});
test('snapshot strips mismatched captured source context and rejects backward continuation', async () => {
  const { bundle, record } = await fixture();
  const changed = structuredClone(bundle);
  changed.feed = changed.feed.map((source) =>
    source.id === record.event.sources[0].id
      ? { ...source, version: source.version + 1 }
      : source,
  );
  const exported = await captureEvents(
    async (path) =>
      path === '/events'
        ? { items: [record], next: null, evaluatedAt: record.evaluatedAt }
        : record,
    changed,
  );
  assert.deepEqual(exported.events, []);
  const upper = 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    lower = '11111111-1111-4111-8111-111111111111';
  let pages = 0;
  await assert.rejects(
    captureEvents(
      async () => ({
        items: [],
        next: ++pages === 1 ? upper : lower,
        evaluatedAt: record.evaluatedAt,
      }),
      bundle,
    ),
    /cursor did not advance/,
  );
});
