import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  MaterialViewSchema,
  MaterialReceiptSchema,
  MaterialExportSchema,
  CompletePrivacyExportSchema,
  MacroDashboardSchema,
  MacroObservationSchema,
} from '../../../../packages/contracts/src/index';
import {
  materialPath,
  materialBrowserCall as call,
  prepareMaterialBrowser,
  saveMaterialSettings,
  gdp,
} from '../../helpers/material-alert-fixture';
import { connectionPassword } from '../../helpers/research-connection-fixture';
import type {
  LocalState,
  OfflineBundle,
  OfflineRequest,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-660 actual dated bundle material settings serialize replay reload privacy deletion and zeroAPI @MATERIAL-ALERTS-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      traffic.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  const view = MaterialViewSchema.parse((await call(page, materialPath)).body);
  expect(view.bundleGeneratedAt).toBeTruthy();
  await expect(
    page.getByRole('region', { name: 'Material changes', exact: true }),
  ).toContainText('On-device evidence bundle:');
  const input = {
    action: 'check',
    requestId: randomUUID(),
    expectedVersion: view.state.version,
  };
  const responses = await page.evaluate(
    async ({ path, input }) =>
      Promise.all(
        [0, 1].map(async () => {
          const r = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          return { status: r.status, body: await r.json() };
        }),
      ),
    { path: materialPath, input },
  );
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(responses[0]!.body).toEqual(responses[1]!.body);
  const receipt = MaterialReceiptSchema.parse(responses[0]!.body);
  expect(receipt.state.notices).toEqual([]);
  expect(receipt.outcomes[0]?.after).toEqual(
    view.sources.find((source) => source.indicator === gdp)?.latest,
  );
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    MaterialViewSchema.parse((await call(page, materialPath)).body).state,
  ).toEqual(receipt.state);
  const exported = (await call(page, '/api/v1/account/privacy/export')).body;
  expect(exported.materialAlerts.events).toHaveLength(2);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  expect((await call(page, materialPath)).status).toBe(401);
  expect(
    (
      await call(page, '/api/v1/account/register', 'POST', {
        username: `empty_${randomUUID().slice(0, 12)}`,
        password: connectionPassword,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    MaterialExportSchema.parse(
      (await call(page, materialPath + '/history')).body,
    ).events,
  ).toEqual([]);
  expect(traffic).toEqual([]);
});
test('E2E-OFFLINE-661 actual local handler highest dated edition transitions mute revisions coalescing replay and expiry @MATERIAL-ALERTS-001 @TEST-SIMULATION', async () => {
  const { handleMaterialAlerts } =
    await import('../../../../apps/web/src/offline/material-alerts');
  const { handleAccounts } =
    await import('../../../../apps/web/src/offline/accounts');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const macro = MacroDashboardSchema.parse(bundle.macro),
    at = new Date().toISOString(),
    id = randomUUID();
  const source = macro.sources.find((s) => s.indicator === gdp)!;
  expect(source).toBeTruthy();
  source.observations = [];
  source.lastSuccessAt = at;
  bundle.macro = macro;
  bundle.macroHistory = {};
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: id,
    users: {
      [id]: {
        id,
        username: 'synthetic-material',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic-handler-fixture',
        passwordSalt: 'synthetic-handler-fixture',
      },
    },
    data: {
      localAccounts: {
        [id]: {
          watchlist: [gdp],
          acknowledgments: {},
          alertPreferences: {},
          session: {
            id: randomUUID(),
            createdAt: at,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            current: true,
          },
        },
      },
    },
  };
  const observation = (year: number, value: string | null, revision = 1) =>
    MacroObservationSchema.parse({
      id: randomUUID(),
      indicator: gdp,
      year,
      value,
      revision,
      unit: 'annual_percent',
      country: 'IND',
      providerUpdatedAt: at.slice(0, 10),
      retrievedAt: at,
      sourceHash: 'c'.repeat(64),
      sourceUrl: 'https://example.com/synthetic-local-material',
      supersedesId: null,
    });
  const dispatch = async (
    path = materialPath,
    method = 'GET',
    body: unknown = {},
  ) => {
    const url = new URL(path, 'https://offline.invalid');
    const req: OfflineRequest = {
      path: url.pathname,
      method,
      body,
      query: url.searchParams,
      headers: new Headers(),
    };
    return ((await handleAccounts(req, state, bundle)) ??
      (await handleMaterialAlerts(req, state, bundle)))!;
  };
  const write = async (extra: Record<string, unknown>) => {
    const view = MaterialViewSchema.parse((await dispatch()).body);
    const input = {
      requestId: randomUUID(),
      expectedVersion: view.state.version,
      ...extra,
    };
    return {
      input,
      receipt: MaterialReceiptSchema.parse(
        (await dispatch(materialPath, 'POST', input)).body,
      ),
    };
  };
  let network = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    network++;
    throw Error('Local material handler must not request network data.');
  };
  try {
    const first = observation(2020, '1');
    source.observations = [first];
    await write({
      action: 'configure',
      policies: [{ indicator: gdp, thresholdPoints: '1' }],
      storageConsent: true,
    });
    const second = observation(2021, '1.5');
    bundle.macroHistory[`${gdp}/2021`] = [second];
    let result = await write({ action: 'check' });
    expect(result.receipt.outcomes[0]?.outcome).toBe('below-threshold');
    const corrected = { ...observation(2021, '9', 2), supersedesId: second.id };
    bundle.macroHistory[`${gdp}/2021`] = [second, corrected];
    result = await write({ action: 'check' });
    expect(result.receipt.outcomes[0]?.outcome).toBe('revision');
    expect(result.receipt.state.notices).toEqual([]);
    bundle.macroHistory[`${gdp}/2022`] = [observation(2022, '12')];
    const material = await write({ action: 'check' });
    expect(material.receipt.state.notices[0]?.before.id).toBe(corrected.id);
    for (const read of [true, false])
      expect(
        (
          await write({
            action: 'acknowledge',
            indicator: gdp,
            noticeVersion: 1,
            read,
          })
        ).receipt.state.notices[0]?.read,
      ).toBe(read);
    bundle.macroHistory[`${gdp}/2023`] = [observation(2023, '15')];
    result = await write({ action: 'check' });
    expect(result.receipt.state.notices[0]?.version).toBe(2);
    expect((await dispatch(materialPath, 'POST', material.input)).body).toEqual(
      material.receipt,
    );
    await expect(
      dispatch(materialPath, 'POST', { ...material.input, expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(
      (
        await dispatch('/api/v1/account/alert-preferences', 'PUT', {
          indicator: gdp,
          muted: true,
        })
      ).body,
    ).toEqual({ ok: true });
    bundle.macroHistory[`${gdp}/2024`] = [observation(2024, '20')];
    expect(
      (await write({ action: 'check' })).receipt.outcomes[0]?.outcome,
    ).toBe('muted');
    await dispatch('/api/v1/account/alert-preferences', 'PUT', {
      indicator: gdp,
      muted: false,
    });
    let view = MaterialViewSchema.parse((await dispatch()).body);
    expect(view.state.notices).toEqual([]);
    expect(view.state.baselines[0]?.observation?.year).toBe(2024);
    bundle.macroHistory[`${gdp}/2025`] = [observation(2025, null)];
    expect(
      (await write({ action: 'check' })).receipt.outcomes[0]?.outcome,
    ).toBe('missing');
    view = MaterialViewSchema.parse((await dispatch()).body);
    expect(view.state.baselines[0]?.observation?.year).toBe(2024);
    const persisted = structuredClone(state);
    expect(JSON.parse(JSON.stringify(persisted))).toEqual(persisted);
    await dispatch('/api/v1/account/watchlist', 'PUT', { indicators: [] });
    expect(
      MaterialViewSchema.parse((await dispatch()).body).state.policies,
    ).toEqual([]);
    expect(
      MaterialExportSchema.parse(
        (await dispatch(materialPath + '/history')).body,
      ).events.some((e) => e.receipt.requestId === material.input.requestId),
    ).toBe(true);
    const local = state.data.localAccounts as Record<
      string,
      { session: { expiresAt: string } }
    >;
    local[id]!.session.expiresAt = new Date(Date.now() - 1000).toISOString();
    await expect(dispatch()).rejects.toMatchObject({ status: 401 });
    expect(network).toBe(0);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
test('E2E-OFFLINE-662 persisted complete material Privacy download follows every local history page without API traffic @MATERIAL-ALERTS-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) traffic.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  await page.evaluate(async (path) => {
    let version = (await (await fetch(path)).json()).state.version;
    for (let i = 0; i < 101; i++) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          requestId: crypto.randomUUID(),
          expectedVersion: version,
        }),
      });
      if (!response.ok)
        throw Error('Actual serialized local history write failed.');
      version = (await response.json()).state.version;
    }
  }, materialPath);
  await page.goto('/#privacy');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download account JSON', exact: true })
    .click();
  const file = await download,
    path = await file.path();
  expect(path).toBeTruthy();
  const exported = CompletePrivacyExportSchema.parse(
    JSON.parse(await readFile(path!, 'utf8')),
  );
  expect(exported.materialAlerts.events).toHaveLength(102);
  expect(exported.materialAlerts.complete).toBe(true);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    MaterialExportSchema.parse(
      (await call(page, materialPath + '/history')).body,
    ).next,
  ).not.toBeNull();
  expect(traffic).toEqual([]);
});
