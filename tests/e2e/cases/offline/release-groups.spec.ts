import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  buildEventRevision,
  EventPublicSchema,
  ReleaseGroupsSchema,
} from '../../../../packages/contracts/src/index';
import { handleEvents } from '../../../../apps/web/src/offline/events';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
import { releaseSources, releaseInput } from '../../helpers/release-groups';

test('E2E-OFFLINE-2300 installed same-event groups require current evidence and unambiguous membership without network @UX-002C @TEST-SIMULATION', async () => {
  const sources = await releaseSources();
  const now = new Date(
    Math.max(
      Date.now(),
      ...sources.map((source) => Date.parse(source.source.retrievedAt)),
    ),
  ).toISOString();
  const record = (selected = sources.slice(0, 2)) => {
    const event = buildEventRevision(
      randomUUID(),
      1,
      now,
      releaseInput(selected),
      selected,
      [],
      randomUUID,
    );
    event.graph.events[0]!.publicationState = 'published';
    return EventPublicSchema.parse({
      id: event.id,
      status: 'published',
      event,
      evaluatedAt: now,
      reviewedAt: now,
    });
  };
  const first = record();
  const bundle: OfflineBundle = {
    generatedAt: now,
    feed: sources,
    histories: {},
    evidence: {},
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: [],
    learningCatalog: null,
    journeyCatalog: null,
    media: {},
    events: [first],
    securities: { items: [], limited: false },
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const before = JSON.stringify(state);
  const read = async () =>
    ReleaseGroupsSchema.parse(
      (
        await handleEvents(
          {
            method: 'GET',
            path: '/api/v1/events/release-groups',
            query: new URLSearchParams({ sources: sources[0]!.id }),
            body: null,
            headers: new Headers(),
          },
          state,
          bundle,
        )
      )?.body,
    );
  expect((await read()).groups[0]?.members.map((member) => member.id)).toEqual(
    sources.slice(0, 2).map((source) => source.id),
  );
  bundle.events = [first, record(sources.slice(1))];
  expect((await read()).groups).toEqual([]);
  expect((await read()).conflicted).toBe(true);
  bundle.events = [first];
  bundle.feed = sources.map((source, index) =>
    index === 1 ? { ...source, version: 2 } : source,
  );
  expect((await read()).groups).toEqual([]);
  bundle.feed = sources.map((source, index) =>
    index === 1
      ? { ...source, version: 2, status: 'withdrawn' as const }
      : source,
  );
  expect((await read()).groups).toEqual([]);
  bundle.feed = sources;
  bundle.eventLineage = {
    [first.id]: {
      eventId: first.id,
      evaluatedAt: now,
      relations: [
        {
          id: randomUUID(),
          kind: 'merge',
          direction: 'replaced-by',
          reviewedAt: now,
          reason: 'Synthetic independently reviewed replacement',
          related: [{ id: randomUUID(), available: false, title: null }],
        },
      ],
    },
  };
  expect((await read()).groups).toEqual([]);
  expect(bundle.feed).toHaveLength(3);
  expect(JSON.stringify(state)).toBe(before);
});
