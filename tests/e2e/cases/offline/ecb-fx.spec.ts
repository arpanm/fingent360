import { test, expect } from '@playwright/test';
import { fxXml } from '../../helpers/ecb-fx';
import {
  EcbFxEditionSchema,
  EcbFxPublicSchema,
  EcbFxHistorySchema,
  parseEcbFx,
  compareEcbFx,
  ECB_FX_SOURCE,
  ECB_FX_URL,
  ECB_FX_PARSER,
} from '../../../../packages/contracts/src/index';
import { handleEcbFx } from '../../../../apps/web/src/offline/ecb-fx';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-OFFLINE-810 actual packaged rate snapshot or honest unavailable state and connected Operations notice use zero API requests @ECB-FX-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(new URL(request.url()).pathname);
  });
  await page.goto('/#reference-fx');
  await expect(
    page.getByRole('complementary', { name: 'On-device mode', exact: true }),
  ).toBeVisible();
  const current = EcbFxPublicSchema.parse(
    await page.evaluate(async () =>
      (await fetch('/api/v1/reference-fx')).json(),
    ),
  );
  const region = page.getByRole('region', {
    name: 'Reference exchange rates',
    exact: true,
  });
  if (current.status === 'published') {
    await expect(region).toContainText(
      'not executable quotes or Indian end-of-day rates',
    );
    await region
      .getByRole('link', { name: 'Inspect numerical evidence', exact: true })
      .click();
    await expect(page.getByRole('table')).toBeVisible();
    await page
      .getByRole('button', {
        name: 'Back to previous exchange-rate view',
        exact: true,
      })
      .click();
  } else
    await expect(region).toContainText(
      current.status === 'withdrawn'
        ? 'source was withdrawn'
        : 'No reviewed reference-rate edition',
    );
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/ECB reference-FX capture, retained XML/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/ops/reference-fx')).status,
    ),
  ).toBe(503);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-811 actual local handler excludes retired editions even when old bytes remain in an explicitly synthetic test bundle @ECB-FX-001 @TEST-SIMULATION', async () => {
  const xml = await fxXml();
  const observations = parseEcbFx(xml).observations;
  const first = EcbFxEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_FX_PARSER,
    sourceId: ECB_FX_SOURCE,
    sourceUrl: ECB_FX_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    sourceWindow: 'rolling-90-day-file',
    windowStart: observations[0]!.date,
    windowEnd: observations[observations.length - 1]!.date,
    observations,
    comparison: compareEcbFx(null, observations),
  });
  const later = observations.slice(1);
  const second = EcbFxEditionSchema.parse({
    ...first,
    edition: 2,
    sourceHash: 'b'.repeat(64),
    observations: later,
    windowStart: later[0]!.date,
    comparison: compareEcbFx(first, later),
  });
  const publicValue = EcbFxPublicSchema.parse({
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
    ecbFx: publicValue,
    ecbFxHistory: [second, first],
    ecbFxAdmittedEditions: [2],
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
    handleEcbFx(
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
    EcbFxHistorySchema.parse((await call('/api/v1/reference-fx/history'))?.body)
      .editions,
  ).toEqual([second]);
  expect(
    EcbFxPublicSchema.parse((await call('/api/v1/reference-fx'))?.body).edition
      ?.comparison.absentDates,
  ).toEqual([observations[0]!.date]);
  for (const path of ['editions/1', 'evidence/1'])
    expect(() => call(`/api/v1/reference-fx/${path}`)).toThrow('unavailable');
  bundle.ecbFx = { ...publicValue, status: 'withdrawn', edition: null };
  for (const path of ['history', 'editions/2', 'evidence/2'])
    expect(() => call(`/api/v1/reference-fx/${path}`)).toThrow('unavailable');
  expect(JSON.stringify(state)).toBe(before);
});
