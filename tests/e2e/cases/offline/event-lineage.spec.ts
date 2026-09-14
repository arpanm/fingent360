import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  currentPublications,
  buildEventRevision,
  EventLineagePublicSchema,
} from '../../../../packages/contracts/src/index';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-830 installed event lineage uses admitted stored targets and refuses changed source without network @EVENT-LINEAGE-001', async () => {
  const { handleEvents } =
    await import('../../../../apps/web/src/offline/events');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (item) =>
      item.status === 'published' && item.sourceHash && item.title.length >= 8,
  )!;
  expect(source).toBeTruthy();
  const at = new Date().toISOString(),
    ids = [randomUUID(), randomUUID()];
  bundle.events = ids.map((id, index) => {
    const event = buildEventRevision(
      id,
      1,
      at,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason: 'Synthetic local lineage',
        editorial: {
          title: 'Synthetic local lineage ' + index,
          family: 'Policy',
          geography: ['India'],
          claimKind: 'inference',
          explanation: 'Synthetic context using actual stored source evidence.',
          announcedAt: null,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: source.version,
              hash: source.sourceHash!,
              field: 'title',
              quote: source.title,
            },
          ],
          links: [],
        },
      },
      [source],
      [],
      randomUUID,
    );
    event.graph.events[0]!.publicationState = 'published';
    return { id, status: 'published', event, evaluatedAt: at, reviewedAt: at };
  });
  bundle.eventLineage = {
    [ids[0]!]: {
      eventId: ids[0],
      evaluatedAt: at,
      relations: [
        {
          id: randomUUID(),
          kind: 'merge',
          direction: 'replaced-by',
          reviewedAt: at,
          reason: 'Synthetic reviewed relation for local fixture.',
          related: [
            { id: ids[1], available: true, title: 'Synthetic local lineage 1' },
          ],
        },
      ],
    },
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: { preserved: 'Synthetic unrelated owned-state sentinel' },
  };
  const before = structuredClone(state),
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Local event lineage must never use network.');
  };
  try {
    const request = {
      method: 'GET',
      path: '/api/v1/events/' + ids[0] + '/lineage',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: undefined,
    };
    const result = EventLineagePublicSchema.parse(
      (await handleEvents(request, state, bundle))!.body,
    );
    expect(result.relations[0]?.related[0]?.available).toBe(true);
    bundle.histories[source.id] = [
      ...(bundle.histories[source.id] ?? []),
      { ...source, version: source.version + 1, status: 'withdrawn' },
    ];
    const hidden = EventLineagePublicSchema.parse(
      (await handleEvents(request, state, bundle))!.body,
    );
    expect(hidden.relations[0]?.related[0]?.title).toBeNull();
    expect(hidden.relations[0]?.related[0]?.available).toBe(false);
    expect(state).toEqual(before);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-831 installed event page cold reload does not call API and labels unsupported editorial work @EVENT-LINEAGE-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      traffic.push(request.url());
  });
  await page.goto('/#events');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const status = await page.evaluate(
    async () => (await fetch('/api/v1/ops/event-lineage')).status,
  );
  expect(status).toBe(503);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(traffic).toEqual([]);
});
