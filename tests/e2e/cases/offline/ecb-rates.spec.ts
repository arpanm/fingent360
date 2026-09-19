import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  EcbRateEditionSchema,
  EcbRatePublicSchema,
  EcbRateHistorySchema,
  parseEcbRates,
  ECB_RATE_SOURCE,
  ECB_RATE_URL,
  ECB_RATE_PARSER,
} from '../../../../packages/contracts/src/index';
import { handleEcbRates } from '../../../../apps/web/src/offline/ecb-rates';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-OFFLINE-680 actual packaged rate snapshot or honest unavailable state and connected Operations notice use zero API requests @ECB-RATES-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(new URL(request.url()).pathname);
  });
  await page.goto('/#policy-rates');
  await expect(
    page.getByRole('complementary', { name: 'On-device mode', exact: true }),
  ).toBeVisible();
  const current = EcbRatePublicSchema.parse(
    await page.evaluate(async () =>
      (await fetch('/api/v1/policy-rates')).json(),
    ),
  );
  const region = page.getByRole('region', {
    name: 'ECB policy rates',
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
        name: 'Back to previous policy-rate view',
        exact: true,
      })
      .click();
  } else
    await expect(region).toContainText(
      current.status === 'withdrawn'
        ? 'source was withdrawn'
        : 'No reviewed ECB numerical edition',
    );
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/ECB policy-rate refresh, retained raw evidence/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/ops/policy-rates')).status,
    ),
  ).toBe(503);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-681 actual local handler excludes retired editions even when old bytes remain in an explicitly synthetic test bundle @ECB-RATES-001 @TEST-SIMULATION', async () => {
  const xml = await readFile(
    new URL(
      '../../../../packages/contracts/test/fixtures/ecb-policy-rates.xml',
      import.meta.url,
    ),
    'utf8',
  );
  const first = EcbRateEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_RATE_PARSER,
    sourceId: ECB_RATE_SOURCE,
    sourceUrl: ECB_RATE_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    responsePreparedAt: '2026-09-14T00:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    unit: 'percent-per-annum',
    region: 'euro-area',
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    observations: parseEcbRates(xml).observations,
  });
  const second = EcbRateEditionSchema.parse({
    ...first,
    edition: 2,
    sourceHash: 'b'.repeat(64),
  });
  const publicValue = EcbRatePublicSchema.parse({
    status: 'published',
    edition: second,
    checkedAt: second.retrievedAt,
    reviewedAt: second.retrievedAt,
    evaluatedAt: second.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'Europe/Berlin',
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
    policyRates: publicValue,
    policyRateHistory: [second, first],
    policyRateAdmittedEditions: [2],
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
    handleEcbRates(
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
    EcbRateHistorySchema.parse(
      (await call('/api/v1/policy-rates/history'))?.body,
    ).editions,
  ).toEqual([second]);
  for (const path of ['editions/1', 'evidence/1'])
    expect(() => call(`/api/v1/policy-rates/${path}`)).toThrow('unavailable');
  bundle.policyRates = { ...publicValue, status: 'withdrawn', edition: null };
  for (const path of ['history', 'editions/2', 'evidence/2'])
    expect(() => call(`/api/v1/policy-rates/${path}`)).toThrow('unavailable');
  expect(JSON.stringify(state)).toBe(before);
});
