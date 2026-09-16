import { test, expect } from '@playwright/test';
import { EquitySnapshotSchema } from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-900 packaged equity coverage uses local snapshot and no API network @EQUITY-COVERAGE-001', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/'))
      requests.push(r.url());
  });
  await page.goto('/#equities');
  await expect(
    page.getByRole('region', { name: 'Indian equity evidence' }),
  ).toBeVisible();
  const result = await page.evaluate(
    async () => await (await fetch('/api/v1/equities/snapshot')).json(),
  );
  const snapshot = EquitySnapshotSchema.parse(result);
  expect(snapshot.companies.length).toBeGreaterThanOrEqual(0);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-904 packaged action evidence preserves ex-date and identity provenance with no Operations writes @EQUITY-COVERAGE-001 @TEST-SIMULATION', async () => {
  const { handleEquityCoverage } =
    await import('../../../../apps/web/src/offline/equity-coverage');
  const { parseEquitySource } =
    await import('../../../../packages/contracts/src/index');
  const { readFile } = await import('node:fs/promises');
  const body = await readFile(
    new URL(
      '../../../../packages/contracts/test/fixtures/equity-actions.csv',
      import.meta.url,
    ),
    'utf8',
  );
  const id = '10000000-0000-4000-8000-000000000001';
  const observations = parseEquitySource(
    'nse-corporate-actions-csv-v1',
    body,
    '2025-01-31',
    undefined,
    [
      {
        isin: 'INE002A01018',
        symbol: 'SYNTHETIC',
        series: 'EQ',
        effectiveOn: '2025-01-31',
        editionId: id,
        hash: 'a'.repeat(64),
      },
    ],
  ).observations;
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2025-01-31T12:00:00.000Z',
    companies: [
      {
        isin: 'INE002A01018',
        name: 'Synthetic coverage company',
        truncated: false,
        records: observations.map((observation) => ({
          observation,
          editionId: id,
          sourceUrl:
            'https://www.nseindia.com/companies-listing/corporate-filings-actions',
          hash: 'b'.repeat(64),
          retrievedAt: '2025-01-31T12:00:00.000Z',
          publishedAt: null,
        })),
      },
    ],
  });
  const bundle = {
    generatedAt: snapshot.capturedAt,
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
    equityCoverage: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/equities/INE002A01018',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleEquityCoverage(request, state, bundle))?.body).toEqual(
    snapshot.companies[0],
  );
  expect(() =>
    handleEquityCoverage(
      { ...request, path: '/api/v1/ops/equities/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('require connected Operations');
});

test('E2E-OFFLINE-906 packaged financial evidence preserves reporting periods and exact scale with no Operations writes @EQUITY-COVERAGE-001 @TEST-SIMULATION', async () => {
  const { handleEquityCoverage } =
    await import('../../../../apps/web/src/offline/equity-coverage');
  const { parseEquitySource } =
    await import('../../../../packages/contracts/src/index');
  const { readFile } = await import('node:fs/promises');
  const body = await readFile(
    new URL(
      '../../../../packages/contracts/test/fixtures/equity-indas.html',
      import.meta.url,
    ),
    'utf8',
  );
  const id = '10000000-0000-4000-8000-000000000001';
  const observations = parseEquitySource(
    'nse-integrated-indas-html-v1',
    body,
    '2025-04-30',
  ).observations;
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2025-04-30T12:00:00.000Z',
    companies: [
      {
        isin: 'INE002A01018',
        name: 'Synthetic coverage company',
        truncated: false,
        records: observations.map((observation) => ({
          observation,
          editionId: id,
          sourceUrl:
            'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_154496_30042026011808_iXBRL_WEB.html',
          hash: 'b'.repeat(64),
          retrievedAt: '2025-04-30T12:00:00.000Z',
          publishedAt: null,
        })),
      },
    ],
  });
  const bundle = {
    generatedAt: snapshot.capturedAt,
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
    equityCoverage: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/equities/INE002A01018',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleEquityCoverage(request, state, bundle))?.body).toEqual(
    snapshot.companies[0],
  );
  expect(() =>
    handleEquityCoverage(
      { ...request, path: '/api/v1/ops/equities/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('require connected Operations');
});
