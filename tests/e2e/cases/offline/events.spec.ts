import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  EventListSchema,
  EventPublicSchema,
  EventSaveSchema,
  buildEventRevision,
} from '../../../../packages/contracts/src/index';
import { actualBundledConnectionSource } from '../../helpers/research-connection-fixture';
import { handleEvents } from '../../../../apps/web/src/offline/events';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-700 installed event snapshot and connected-only editing use zero API network @EVENT-REVIEW-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#events');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const result = EventListSchema.parse(
    await page.evaluate(async () => (await fetch('/api/v1/events')).json()),
  );
  await expect(
    page.getByRole('heading', { name: 'Reviewed events', exact: true }),
  ).toBeVisible();
  if (!result.items.length)
    await expect(
      page.getByText('No reviewed events match this page.', { exact: false }),
    ).toBeVisible();
  expect(
    await page.evaluate(async () => (await fetch('/api/v1/ops/events')).status),
  ).toBe(503);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-701 real local event adapter refuses changed or withdrawn actual source editions without private writes @EVENT-REVIEW-001 @TEST-SIMULATION', async () => {
  const source = await actualBundledConnectionSource(),
    id = randomUUID(),
    now = new Date(
      Math.max(Date.now(), Date.parse(source.source.retrievedAt)),
    ).toISOString();
  const input = EventSaveSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    revisionReason: 'Synthetic local editorial fixture',
    editorial: {
      title: 'Synthetic dated context',
      family: 'Policy',
      geography: ['India'],
      claimKind: 'inference',
      explanation: 'Synthetic editorial association only.',
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
  const event = buildEventRevision(id, 1, now, input, [source], [], randomUUID);
  event.graph.events[0]!.publicationState = 'published';
  const record = EventPublicSchema.parse({
    id,
    status: 'published',
    event,
    evaluatedAt: now,
    reviewedAt: now,
  });
  const bundle: OfflineBundle = {
    generatedAt: now,
    feed: [source],
    histories: {},
    evidence: {},
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: [],
    learningCatalog: null,
    journeyCatalog: null,
    media: {},
    events: [record],
    securities: { items: [], limited: false },
  };
  const state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    before = JSON.stringify(state);
  const call = () =>
    handleEvents(
      {
        method: 'GET',
        path: '/api/v1/events/' + id,
        query: new URLSearchParams(),
        body: null,
        headers: new Headers(),
      },
      state,
      bundle,
    );
  expect(EventPublicSchema.parse((await call())?.body).event?.id).toBe(id);
  bundle.feed = [
    { ...source, status: 'withdrawn', version: source.version + 1 },
  ];
  expect(EventPublicSchema.parse((await call())?.body).event).toBeNull();
  bundle.feed = [{ ...source, version: source.version + 1 }];
  expect(EventPublicSchema.parse((await call())?.body).status).toBe(
    'unavailable',
  );
  expect(JSON.stringify(state)).toBe(before);
});
