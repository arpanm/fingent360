import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  MacroDashboardSchema,
  MacroHistorySchema,
  MacroEvidenceSchema,
} from '../../../../packages/contracts/src/index';
import { handleContent } from '../../../../apps/web/src/offline/content';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';

test('E2E-OFFLINE-2310 installed annual macro observations history and evidence use no API network @DATA-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#macro');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const dashboard = MacroDashboardSchema.parse(
    await page.evaluate(async () => (await fetch('/api/v1/macro')).json()),
  );
  const source = dashboard.sources.find((row) =>
    row.observations.some((observation) => observation.value !== null),
  );
  expect(
    source,
    'The installed annual macro acceptance snapshot must contain a captured observation.',
  ).toBeTruthy();
  const observation = source!.observations.find((row) => row.value !== null)!;
  const card = page.getByRole('article', { name: source!.title, exact: true });
  await expect(card).toContainText(`Observation year ${observation.year}`);
  await expect(card).toContainText(
    source!.freshness === 'refresh_due'
      ? 'Source check is due.'
      : 'Source checked recently.',
  );
  await card.getByText(/Annual observations and provenance/).click();
  await card
    .getByRole('link', {
      name: `History ${observation.year} (v${observation.revision})`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Observation history' }),
  ).toContainText('Provider dataset updated');
  const history = MacroHistorySchema.parse(
    await page.evaluate(
      async ({ indicator, year }) =>
        (await fetch(`/api/v1/macro/${indicator}/history/${year}`)).json(),
      { indicator: source!.indicator, year: observation.year },
    ),
  );
  expect(history.some((row) => row.id === observation.id)).toBe(true);
  await page.goBack();
  await card
    .getByRole('link', { name: `Source ${observation.year}`, exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Original source record' }),
  ).toContainText('World Bank Open Data');
  const evidence = MacroEvidenceSchema.parse(
    await page.evaluate(
      async (hash) => (await fetch(`/api/v1/macro/evidence/${hash}`)).json(),
      observation.sourceHash,
    ),
  );
  expect(evidence.hash).toBe(observation.sourceHash);
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-2311 no-cache annual route is explicit and aging snapshots never become fresh silently @DATA-001 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const original = MacroDashboardSchema.parse(bundle.macro);
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const before = JSON.stringify(state);
  const read = () =>
    handleContent(
      {
        method: 'GET',
        path: '/api/v1/macro',
        query: new URLSearchParams(),
        body: null,
        headers: new Headers(),
      },
      state,
      bundle,
    );
  bundle.macro = null;
  await expect(read()).rejects.toMatchObject({
    status: 503,
    message:
      'Annual macro data is not installed on this device. Connect and install an updated app snapshot.',
  });
  bundle.macro = { arbitrary: 'not a snapshot' };
  await expect(read()).rejects.toMatchObject({
    status: 503,
    message:
      'Annual macro snapshot is unreadable. Install an updated app snapshot.',
  });
  const stale = {
    ...original,
    sources: original.sources.map((source) => ({
      ...source,
      lastSuccessAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      freshness: 'recently_checked' as const,
    })),
  };
  bundle.macro = stale;
  const result = MacroDashboardSchema.parse((await read())?.body);
  expect(
    result.sources.every((source) => source.freshness === 'refresh_due'),
  ).toBe(true);
  expect(result.sources.map((source) => source.observations)).toEqual(
    original.sources.map((source) => source.observations),
  );
  expect(bundle.macro).toEqual(stale);
  bundle.macro = {
    ...original,
    sources: original.sources.map((source) => ({
      ...source,
      lastSuccessAt: null,
      freshness: 'never_synced',
      observations: [],
    })),
  };
  expect(
    MacroDashboardSchema.parse((await read())?.body).sources.every(
      (source) =>
        source.freshness === 'never_synced' && source.observations.length === 0,
    ),
  ).toBe(true);
  expect(JSON.stringify(state)).toBe(before);
});
