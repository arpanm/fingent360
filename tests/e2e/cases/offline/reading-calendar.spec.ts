import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ReadingFollowViewSchema } from '../../../../packages/contracts/src/index';
import { readingCalendarFixture } from '../../helpers/reading-calendar';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1882 actual local handler shows stale downloaded calendar without generating an alert @DEV-018 @TEST-SIMULATION', async () => {
  const { handleReadingFollow } =
    await import('../../../../apps/web/src/offline/reading-follow');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  bundle.researchCalendars = { 'bea-calendar': readingCalendarFixture(true) };
  const id = randomUUID(),
    at = new Date().toISOString();
  const config = {
    version: 1,
    sources: ['bea-gdp-original'],
    topics: [],
    muted: false,
    savedAt: at,
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: id,
    users: {
      [id]: {
        id,
        username: 'synthetic-calendar',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic-only',
        passwordSalt: 'synthetic-only',
      },
    },
    data: { localReadingFollow: { [id]: { config, items: {}, events: [] } } },
  };
  const result = await handleReadingFollow(
    {
      path: '/api/v1/account/reading-follow',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: {},
    },
    state,
    bundle,
  );
  const view = ReadingFollowViewSchema.parse(result?.body);
  expect(view.calendarContext).toMatchObject({
    state: 'stale',
    createsNotice: false,
    urgency: 'none',
  });
  expect(view.calendarContext?.events[0]?.cancelled).toBe(true);
  expect(view.items).toEqual([]);
  expect(view.bundleGeneratedAt).toBe(bundle.generatedAt);
  config.sources = ['bea-gdp-history'];
  const unmatched = await handleReadingFollow(
    {
      path: '/api/v1/account/reading-follow',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: {},
    },
    state,
    bundle,
  );
  expect(
    ReadingFollowViewSchema.parse(unmatched?.body).calendarContext?.state,
  ).toBe('not-selected');
});
