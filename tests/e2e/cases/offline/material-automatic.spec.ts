import { test, expect } from '@playwright/test';
import {
  prepareMaterialBrowser,
  saveMaterialSettings,
  materialBrowserCall,
  materialPath,
} from '../../helpers/material-alert-fixture';
import { MaterialViewSchema } from '../../../../packages/contracts/src/index';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  emptyMaterial,
  applyMaterial,
  MacroDashboardSchema,
} from '../../../../packages/contracts/src/index';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-790 automatic settings persist on device without network or premature check @MATERIAL-AUTO-001', async ({
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
  const region = page.getByRole('region', {
    name: 'Automatic material checks',
    exact: true,
  });
  await region
    .getByRole('button', { name: 'Set up automatic checks', exact: true })
    .click();
  await region.getByRole('checkbox').check();
  await region
    .getByRole('button', { name: 'Enable automatic checks', exact: true })
    .click();
  await expect(region).toContainText('Enabled: once every 24 hours.');
  const saved = MaterialViewSchema.parse(
    (await materialBrowserCall(page, materialPath)).body,
  );
  expect(saved.state.automatic.lastCheckAt).toBeNull();
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const loaded = MaterialViewSchema.parse(
    (await materialBrowserCall(page, materialPath)).body,
  );
  expect(loaded.state.automatic).toEqual(saved.state.automatic);
  await expect(region).toContainText('only while the app is open');
  expect(traffic).toEqual([]);
});

test('E2E-OFFLINE-791 due local handler commits once and revocation pauses without source access @MATERIAL-AUTO-001 @TEST-SIMULATION', async () => {
  const { materializeLocalMaterial, exportLocalMaterial } =
    await import('../../../../apps/web/src/offline/material-alerts');
  const { recordLocalConsentOptIn } =
    await import('../../../../apps/web/src/offline/consents');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const id = randomUUID(),
    at = new Date().toISOString(),
    indicator = 'NY.GDP.MKTP.KD.ZG' as const;
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: id,
    users: {
      [id]: {
        id,
        username: 'synthetic-auto',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic',
        passwordSalt: 'synthetic',
      },
    },
    data: {
      localAccounts: {
        [id]: {
          watchlist: [indicator],
          alertPreferences: {},
          session: { expiresAt: new Date(Date.now() + 86400000).toISOString() },
        },
      },
    },
  };
  const configured = applyMaterial(
    { ...emptyMaterial(), followed: [indicator] },
    {
      action: 'configure',
      requestId: randomUUID(),
      expectedVersion: 0,
      policies: [{ indicator, thresholdPoints: '1' }],
      storageConsent: true,
    },
    [],
    at,
  );
  const enabled = applyMaterial(
    configured.state,
    {
      action: 'automatic-settings',
      requestId: randomUUID(),
      expectedVersion: configured.state.version,
      enabled: true,
      backgroundConsent: true,
    },
    [],
    at,
    1,
  );
  enabled.state.automatic.nextCheckAt = new Date(
    Date.now() - 1000,
  ).toISOString();
  state.data.localMaterialAlerts = {
    [id]: { state: enabled.state, events: [] },
  };
  enabled.state.automatic.consentVersion = recordLocalConsentOptIn(
    state,
    id,
    'automatic-material-checks',
    { kind: 'review', recordedAt: at },
  ).version;
  let network = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    network++;
    throw Error('Unexpected network');
  };
  try {
    materializeLocalMaterial(state, bundle);
    materializeLocalMaterial(state, bundle);
    const history = exportLocalMaterial(state, id);
    expect(history.events).toHaveLength(1);
    expect(history.events[0]?.receipt.action).toBe('automatic-check');
    expect(
      history.events[0]?.receipt.sources.map((source) => source.indicator),
    ).toEqual(
      MacroDashboardSchema.parse(bundle.macro).sources.map(
        (source) => source.indicator,
      ),
    );
    const saved = state.data.localMaterialAlerts as Record<
      string,
      { state: typeof enabled.state }
    >;
    saved[id]!.state.automatic.nextCheckAt = new Date(
      Date.now() - 1000,
    ).toISOString();
    const consents = state.data.localConsents as Record<
      string,
      { heads: Record<string, { decision: string }> }
    >;
    consents[id]!.heads['automatic-material-checks']!.decision = 'revoked';
    materializeLocalMaterial(state, bundle);
    expect(exportLocalMaterial(state, id).events.at(-1)?.receipt.action).toBe(
      'automatic-paused',
    );
    expect(saved[id]!.state.automatic.enabled).toBe(true); // Prior object is not mutated by the atomic saved replacement.
    expect(
      (state.data.localMaterialAlerts as typeof saved)[id]!.state.automatic
        .enabled,
    ).toBe(false);
    expect(network).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});
