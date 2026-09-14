import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  ConsentListSchema,
  ConsentExportSchema,
  ConsentReceiptSchema,
  CompletePrivacyExportSchema,
  ReportSchedulesSchema,
  type ConsentState,
} from '../../../../packages/contracts/src/index';
import {
  consentPath,
  externalPurpose,
  readingPurpose,
  schedulePurpose,
  consentInput,
  consentCall as call,
  consentCard,
  saveConsentUI,
  scheduleConfig,
} from '../../helpers/consent-fixture';
import {
  connectionPassword,
  prepareConnectionBrowser,
} from '../../helpers/research-connection-fixture';
import type {
  LocalState,
  OfflineBundle,
  OfflineRequest,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-760 actual persisted consent review replay revoke reload own-query help export deletion and zeroAPI @CONSENT-LIFECYCLE-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) traffic.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  await page.goto('/#privacy');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(consentCard(page, externalPurpose)).toContainText('not granted');
  await saveConsentUI(page, externalPurpose);
  const input = consentInput('revoke', 1),
    responses = await page.evaluate(
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
      { path: `${consentPath}/${externalPurpose}`, input },
    );
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  expect(responses[0]!.body).toEqual(responses[1]!.body);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(consentCard(page, externalPurpose)).toContainText('revoked');
  const answer = await call(page, '/api/v1/account/assistance', 'POST', {
    query: 'Synthetic research goal',
    scope: 'goals',
    provider: 'query',
    useHistory: true,
  });
  expect(answer.status).toBe(200);
  expect(answer.body.usedHistory).toBe(true);
  expect(
    (await call(page, '/api/v1/account/assistance/options')).body.providers,
  ).toEqual([]);
  const exported = (await call(page, '/api/v1/account/privacy/export')).body;
  expect(exported.consents.history.events).toHaveLength(2);
  expect(exported.goals.revisions.length).toBeGreaterThan(0);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  expect((await call(page, consentPath)).status).toBe(401);
  expect(
    (
      await call(page, '/api/v1/account/register', 'POST', {
        username: `empty_consent_${randomUUID().slice(0, 8)}`,
        password: connectionPassword,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    ConsentExportSchema.parse((await call(page, consentPath + '/history')).body)
      .events,
  ).toEqual([]);
  expect(traffic).toEqual([]);
});
test('E2E-OFFLINE-761 real local schedule admission expiry renewal without catchup and reading denial retain owned records @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async () => {
  const { handleConsents, readLocalConsent } =
    await import('../../../../apps/web/src/offline/consents');
  const { handleLibrary } =
    await import('../../../../apps/web/src/offline/library');
  const { reportSchedulesHandler, materializeLocalSchedules } =
    await import('../../../../apps/web/src/offline/report-schedules');
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
    at = new Date().toISOString();
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: id,
    users: {
      [id]: {
        id,
        username: 'synthetic-consent',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic-handler-fixture',
        passwordSalt: 'synthetic-handler-fixture',
      },
    },
    data: {
      localAccounts: {
        [id]: {
          watchlist: [],
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
  const dispatch = async (path: string, method = 'GET', body: unknown = {}) => {
    const url = new URL(path, 'https://offline.invalid'),
      req: OfflineRequest = {
        path: url.pathname,
        query: url.searchParams,
        headers: new Headers(),
        method,
        body,
      };
    return ((await handleConsents(req, state, bundle)) ??
      (await handleLibrary(req, state, bundle)) ??
      (await reportSchedulesHandler(req, state, bundle)))!;
  };
  let traffic = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    traffic++;
    throw Error('Local consent never requests network data.');
  };
  try {
    expect(
      ConsentListSchema.parse(
        (await dispatch(consentPath)).body,
      ).purposes.every((p) => p.status === 'not-granted'),
    ).toBe(true);
    const prefs = { topics: [], mutedTopics: [], mode: 'for_you' };
    await dispatch('/api/v1/account/library/preferences', 'PUT', prefs);
    expect(readLocalConsent(state, id, readingPurpose).version).toBe(1);
    await dispatch(
      `${consentPath}/${readingPurpose}`,
      'POST',
      consentInput('revoke', 1),
    );
    await expect(
      dispatch('/api/v1/account/library/preferences', 'PUT', prefs),
    ).rejects.toMatchObject({ status: 409 });
    const feed = (await dispatch('/api/v1/account/library/feed')).body as {
      whyShown: Record<string, string>;
    };
    expect(Object.values(feed.whyShown).join(' ')).toContain('Privacy');
    const scheduleId = randomUUID(),
      original = (
        await dispatch(
          `/api/v1/account/report-schedules/${scheduleId}`,
          'POST',
          {
            requestId: randomUUID(),
            expectedVersion: 0,
            action: 'save',
            config: scheduleConfig,
            consent: true,
          },
        )
      ).body;
    const ledger = state.data.localConsents as Record<
      string,
      { heads: Record<string, ConsentState>; events: unknown[] }
    >;
    const head = ledger[id]!.heads[schedulePurpose]!,
      grantedAt = new Date(Date.now() - 7200000).toISOString(),
      expiresAt = new Date(Date.now() - 3600000).toISOString();
    ledger[id]!.heads[schedulePurpose] = {
      ...head,
      grantedAt,
      changedAt: grantedAt,
      expiresAt,
      basis: { kind: 'review', recordedAt: grantedAt },
    };
    const schedules = state.data.localReportSchedules as Record<
      string,
      {
        schedules: { id: string; nextDueAt: string | null }[];
        editions: unknown[];
        occurrences: unknown[];
      }
    >;
    schedules[id]!.schedules[0]!.nextDueAt = new Date(
      Date.now() - 86400000,
    ).toISOString();
    const originalEditions = structuredClone(schedules[id]!.editions);
    await materializeLocalSchedules(state, bundle);
    expect(schedules[id]!.occurrences).toEqual([]);
    const renewed = ConsentReceiptSchema.parse(
      (
        await dispatch(
          `${consentPath}/${schedulePurpose}`,
          'POST',
          consentInput('renew', head.version),
        )
      ).body,
    );
    expect(renewed.scheduleEffects).toHaveLength(1);
    expect(Date.parse(renewed.scheduleEffects[0]!.nextDueAt)).toBeGreaterThan(
      Date.now(),
    );
    await materializeLocalSchedules(state, bundle);
    expect(schedules[id]!.occurrences).toEqual([]);
    expect(schedules[id]!.editions).toEqual(originalEditions);
    expect(
      (
        await dispatch(
          `${consentPath}/${schedulePurpose}`,
          'POST',
          consentInput('revoke', renewed.state.version),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await dispatch(
          `/api/v1/account/report-schedules/${scheduleId}`,
          'POST',
          {
            requestId: randomUUID(),
            expectedVersion: 1,
            action: 'pause',
            consent: true,
          },
        )
      ).status,
    ).toBe(201);
    await expect(
      dispatch(`/api/v1/account/report-schedules/${scheduleId}`, 'POST', {
        requestId: randomUUID(),
        expectedVersion: 2,
        action: 'resume',
        consent: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const view = ReportSchedulesSchema.parse(
      (await dispatch('/api/v1/account/report-schedules')).body,
    );
    expect(view.consent?.status).toBe('revoked');
    expect(original).toBeTruthy();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(traffic).toBe(0);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
test('E2E-OFFLINE-762 persisted complete consent export follows every page with no network @CONSENT-LIFECYCLE-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) traffic.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  await page.evaluate(
    async ({ path, purpose }) => {
      for (let version = 0; version <= 101; version++) {
        const response = await fetch(`${path}/${purpose}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: version ? 'renew' : 'grant',
            requestId: crypto.randomUUID(),
            expectedVersion: version,
            policyVersion: 'purpose-consent-v1',
            reviewed: true,
            expiresAt: null,
          }),
        });
        if (response.status !== 201)
          throw Error('Actual local consent history write failed.');
      }
    },
    { path: consentPath, purpose: externalPurpose },
  );
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
  expect(exported.consents.history.events).toHaveLength(102);
  expect(exported.consents.history.complete).toBe(true);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    ConsentExportSchema.parse((await call(page, consentPath + '/history')).body)
      .next,
  ).not.toBeNull();
  expect(traffic).toEqual([]);
});
