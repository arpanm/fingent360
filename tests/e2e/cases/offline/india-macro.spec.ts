import { test, expect } from '@playwright/test';
import { handleIndiaMacro } from '../../../../apps/web/src/offline/india-macro';
import { selectIndiaCpiVintages } from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1320 retained original publication cutoff never borrows later revisions and source writes stay connected-only @SRC-007 @TEST-SIMULATION', async () => {
  const publishedAt = '2026-07-13T10:30:00.000Z';
  const edition = {
    id: '10000000-0000-4000-8000-000000000001',
    parser: 'mospi-cpi2024-pib-v1' as const,
    hash: 'a'.repeat(64),
    retrievedAt: '2026-09-15T00:00:00.000Z',
    publishedAt,
    sourceUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=9999901',
    title: 'Synthetic release',
    points: [
      {
        period: '2026-06',
        index: '101.03',
        inflation: '1.03',
        status: 'provisional' as const,
      },
      {
        period: '2026-05',
        index: '100.93',
        inflation: '0.93',
        status: 'final' as const,
      },
    ],
    apiPoints: [],
    reconciliation: 'different-current-capture' as const,
  };
  expect(selectIndiaCpiVintages([edition], '2026-07-13T10:29:59.000Z')).toEqual(
    [],
  );
  const bundle = {
    generatedAt: edition.retrievedAt,
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
    indiaMacro: {
      cpi: {
        capturedAt: edition.retrievedAt,
        asOf: null,
        editions: [edition],
        selected: selectIndiaCpiVintages([edition], null),
      },
      calendar: null,
      calendarHistory: [],
    },
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/india-macro',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams({ asOf: publishedAt }),
  };
  expect((await handleIndiaMacro(request, state, bundle))?.body).toMatchObject({
    cpi: { selected: [{ index: '101.03' }, { index: '100.93' }] },
  });
  expect(() =>
    handleIndiaMacro(
      { ...request, path: '/api/v1/ops/india-macro/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
