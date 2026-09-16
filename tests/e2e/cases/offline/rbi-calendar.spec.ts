import { test, expect } from '@playwright/test';
import {
  RBI_CALENDAR_URL,
  parseRbiCalendar,
} from '../../../../packages/contracts/src/rbi-calendar';
import { handleRbiCalendar } from '../../../../apps/web/src/offline/rbi-calendar';
import { rbiShape } from '../../helpers/rbi-calendar';
test('E2E-OFFLINE-1550 RBI installed capture preserves day precision and rejects missing history and tampering @RESEARCH-AUTO-002 @TEST-SIMULATION', async () => {
  const now = '2026-09-15T00:00:00.000Z',
    edition = 'a'.repeat(64),
    calendar = {
      sourceId: 'rbi-mpc-calendar',
      sourceUrl: RBI_CALENDAR_URL,
      version: 'rbi-mpc-html-v1',
      edition,
      retrievedAt: now,
      data: parseRbiCalendar(rbiShape),
      editions: [{ edition, retrievedAt: now }],
    };
  const state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: now,
      feed: [],
      histories: {},
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
      rbiCalendar: calendar,
    },
    request = {
      path: '/api/v1/research-calendar/rbi',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect((await handleRbiCalendar(request, state, bundle))?.body).toEqual(
    calendar,
  );
  await expect(
    Promise.resolve().then(() =>
      handleRbiCalendar(
        { ...request, query: new URLSearchParams({ edition: 'b'.repeat(64) }) },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    Promise.resolve().then(() =>
      handleRbiCalendar(request, state, {
        ...bundle,
        rbiCalendar: { ...calendar, sourceUrl: 'https://untrusted.example' },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
});
