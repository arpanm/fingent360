import { test, expect } from '@playwright/test';
import {
  FOMC_CALENDAR_URL,
  parseFomcCalendar,
} from '../../../../packages/contracts/src/policy-calendar';
import { handlePolicyCalendar } from '../../../../apps/web/src/offline/policy-calendar';
import { fomcShape } from '../../helpers/policy-calendar';
test('E2E-OFFLINE-1440 downloaded policy calendar cannot invent historical captures or precise timestamps @RESEARCH-AUTO-002 @TEST-SIMULATION', async () => {
  const now = '2026-09-15T00:00:00.000Z',
    edition = 'a'.repeat(64),
    calendar = {
      sourceId: 'fomc-calendar',
      sourceUrl: FOMC_CALENDAR_URL,
      version: 'fomc-calendar-html-v1',
      edition,
      retrievedAt: now,
      basis: 'retained-calendar-capture',
      meetings: parseFomcCalendar(await fomcShape()),
      editions: [
        { edition, retrievedAt: now },
        { edition: 'b'.repeat(64), retrievedAt: now },
      ],
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
      policyCalendar: calendar,
    },
    request = {
      path: '/api/v1/research-calendar/policy',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect(
    (await handlePolicyCalendar(request, state, bundle))?.body,
  ).toMatchObject({
    meetings: calendar.meetings,
    editions: [{ edition, retrievedAt: now }],
  });
  await expect(
    Promise.resolve().then(() =>
      handlePolicyCalendar(
        { ...request, query: new URLSearchParams({ edition: 'b'.repeat(64) }) },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 404 });
  const corrupt = structuredClone(calendar);
  corrupt.meetings[0]!.statementUrl = 'https://untrusted.example';
  await expect(
    Promise.resolve().then(() =>
      handlePolicyCalendar(request, state, {
        ...bundle,
        policyCalendar: corrupt,
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handlePolicyCalendar({ ...request, method: 'POST' }, state, bundle),
    ),
  ).rejects.toMatchObject({ status: 405 });
});
