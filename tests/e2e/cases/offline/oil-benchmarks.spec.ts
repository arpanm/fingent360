import { test, expect } from '@playwright/test';
import { oilWorkbook } from '../../helpers/oil-benchmarks';
import {
  OilBenchmarkEditionSchema,
  OilBenchmarkPublicSchema,
  OilBenchmarkHistorySchema,
  parseOilBenchmarks,
  OIL_BENCHMARK_SOURCE,
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_PARSER,
} from '../../../../packages/contracts/src/index';
import { handleOilBenchmarks } from '../../../../apps/web/src/offline/oil-benchmarks';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-OFFLINE-740 actual packaged rate snapshot or honest unavailable state and connected Operations notice use zero API requests @EIA-BENCHMARKS-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(new URL(request.url()).pathname);
  });
  await page.goto('/#oil-benchmarks');
  await expect(
    page.getByRole('complementary', { name: 'On-device mode', exact: true }),
  ).toBeVisible();
  const current = OilBenchmarkPublicSchema.parse(
    await page.evaluate(async () =>
      (await fetch('/api/v1/oil-benchmarks')).json(),
    ),
  );
  const region = page.getByRole('region', {
    name: 'Oil benchmarks',
    exact: true,
  });
  if (current.status === 'published') {
    await expect(region).toContainText('not a reconstructed as-of vintage');
    await region
      .getByRole('link', { name: 'Inspect numerical evidence', exact: true })
      .click();
    await expect(page.getByRole('table')).toBeVisible();
    await page
      .getByRole('button', {
        name: 'Back to previous oil-benchmark view',
        exact: true,
      })
      .click();
  } else
    await expect(region).toContainText(
      current.status === 'withdrawn'
        ? 'source was withdrawn'
        : 'No reviewed monthly oil edition',
    );
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Oil benchmark capture, retained raw evidence/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/ops/oil-benchmarks')).status,
    ),
  ).toBe(503);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-741 actual local handler excludes retired editions even when old bytes remain in an explicitly synthetic test bundle @EIA-BENCHMARKS-001 @TEST-SIMULATION', async () => {
  const xml = await oilWorkbook();
  const first = OilBenchmarkEditionSchema.parse({
    edition: 1,
    parserVersion: OIL_BENCHMARK_PARSER,
    sourceId: OIL_BENCHMARK_SOURCE,
    sourceUrl: OIL_BENCHMARK_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    reportedUpdatedOn: '2000-03-02',
    sourceHash: 'a'.repeat(64),
    unit: 'USD-per-barrel',
    region: 'global-benchmarks',
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    precision: 1,
    transformation: 'workbook-display-half-away-from-zero',
    observations: parseOilBenchmarks(xml).observations,
  });
  const second = OilBenchmarkEditionSchema.parse({
    ...first,
    edition: 2,
    sourceHash: 'b'.repeat(64),
  });
  const publicValue = OilBenchmarkPublicSchema.parse({
    status: 'published',
    edition: second,
    checkedAt: second.retrievedAt,
    reviewedAt: second.retrievedAt,
    evaluatedAt: second.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'UTC',
  });
  const bundle: OfflineBundle = {
    generatedAt: second.retrievedAt,
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
    oilBenchmarks: publicValue,
    oilBenchmarkHistory: [second, first],
    oilBenchmarkAdmittedEditions: [2],
  };
  const state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    before = JSON.stringify(state);
  const call = (path: string) =>
    handleOilBenchmarks(
      {
        method: 'GET',
        path,
        query: new URLSearchParams(),
        body: null,
        headers: new Headers(),
      },
      state,
      bundle,
    );
  expect(
    OilBenchmarkHistorySchema.parse(
      (await call('/api/v1/oil-benchmarks/history'))?.body,
    ).editions,
  ).toEqual([second]);
  for (const path of ['editions/1', 'evidence/1'])
    expect(() => call(`/api/v1/oil-benchmarks/${path}`)).toThrow('unavailable');
  bundle.oilBenchmarks = { ...publicValue, status: 'withdrawn', edition: null };
  for (const path of ['history', 'editions/2', 'evidence/2'])
    expect(() => call(`/api/v1/oil-benchmarks/${path}`)).toThrow('unavailable');
  expect(JSON.stringify(state)).toBe(before);
});
