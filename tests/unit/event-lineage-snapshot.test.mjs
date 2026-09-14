import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { captureEventLineage } from '../../scripts/event-lineage-snapshot.mjs';
test('lineage snapshot refuses changed publication during capture', async () => {
  const id = randomUUID(),
    at = '2026-09-14T00:00:00.000Z';
  const event = {
    id,
    status: 'withdrawn',
    event: null,
    reviewedAt: at,
    evaluatedAt: at,
  };
  const get = async (path) =>
    path.endsWith('/lineage')
      ? { eventId: id, relations: [], evaluatedAt: at }
      : { ...event, reviewedAt: '2026-09-14T01:00:00.000Z' };
  await assert.rejects(
    captureEventLineage(get, [event]),
    /changed during lineage export/,
  );
});
test('lineage snapshot strips uncaptured target titles and checks final relation stability', async () => {
  const id = randomUUID(),
    target = randomUUID(),
    at = '2026-09-14T00:00:00.000Z';
  const event = {
    id,
    status: 'withdrawn',
    event: null,
    reviewedAt: at,
    evaluatedAt: at,
  };
  const relation = {
    id: randomUUID(),
    kind: 'merge',
    direction: 'replaced-by',
    reviewedAt: at,
    reason: 'Synthetic reviewed replacement',
    related: [{ id: target, available: true, title: 'Uncaptured title' }],
  };
  const value = { eventId: id, relations: [relation], evaluatedAt: at };
  const result = await captureEventLineage(
    async (path) => (path.endsWith('/lineage') ? value : event),
    [event],
  );
  assert.deepEqual(result[id].relations[0].related, [
    { id: target, available: false, title: null },
  ]);
  let reads = 0;
  await assert.rejects(
    captureEventLineage(
      async (path) =>
        path.endsWith('/lineage')
          ? { ...value, relations: ++reads === 1 ? [relation] : [] }
          : event,
      [event],
    ),
    /lineage changed/,
  );
});
test('lineage snapshot rejects wrong response identity rather than storing it under another key', async () => {
  const id = randomUUID(),
    at = '2026-09-14T00:00:00.000Z';
  const event = {
    id,
    status: 'withdrawn',
    event: null,
    reviewedAt: at,
    evaluatedAt: at,
  };
  await assert.rejects(
    captureEventLineage(
      async () => ({ eventId: randomUUID(), relations: [], evaluatedAt: at }),
      [event],
    ),
    /Wrong event lineage identity/,
  );
});
test('lineage snapshot refuses known changed title or availability of an already captured target', async () => {
  const { readFile } = await import('node:fs/promises');
  const { buildEventRevision, currentPublications } =
    await import('../../packages/contracts/dist/index.js');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (item) =>
      item.status === 'published' && item.sourceHash && item.title.length >= 8,
  );
  assert.ok(source);
  const at = new Date(
      Math.max(Date.now(), Date.parse(source.source.retrievedAt)),
    ).toISOString(),
    id = randomUUID(),
    target = randomUUID();
  const editorial = {
    title: 'Synthetic captured target',
    family: 'Policy',
    geography: ['India'],
    claimKind: 'inference',
    explanation: 'Synthetic source-bound context.',
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
  };
  const revision = buildEventRevision(
    target,
    1,
    at,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic captured target',
      editorial,
    },
    [source],
    [],
    randomUUID,
  );
  revision.graph.events[0].publicationState = 'published';
  const events = [
    {
      id: target,
      status: 'published',
      event: revision,
      reviewedAt: at,
      evaluatedAt: at,
    },
    { id, status: 'withdrawn', event: null, reviewedAt: at, evaluatedAt: at },
  ];
  for (const related of [
    { id: target, available: true, title: 'Changed target title' },
    { id: target, available: false, title: null },
  ]) {
    const get = async (path) => {
      const requested = path.split('/')[2];
      if (!path.endsWith('/lineage'))
        return events.find((event) => event.id === requested);
      return {
        eventId: requested,
        evaluatedAt: at,
        relations:
          requested === target
            ? []
            : [
                {
                  id: randomUUID(),
                  kind: 'merge',
                  direction: 'replaced-by',
                  reviewedAt: at,
                  reason: 'Synthetic reviewed replacement',
                  related: [related],
                },
              ],
      };
    };
    // Keep the immutable relation identity stable across the two reads.
    const relationId = randomUUID();
    await assert.rejects(
      captureEventLineage(async (path) => {
        const result = await get(path);
        if (result.relations?.length) result.relations[0].id = relationId;
        return result;
      }, events),
      /Related event changed/,
    );
  }
});
