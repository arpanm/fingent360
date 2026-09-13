import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  connectionGoal,
  connectionPassword,
  prepareConnectionBrowser,
  actualBundledConnectionSource,
} from '../../helpers/research-connection-fixture';
import {
  PrivacyExportSchema,
  ResearchConnectionsSchema,
  connectionSource,
  type FeedItem,
} from '../../../../packages/contracts/src/index';
const base = '/api/v1/account/research-connections';
async function call(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const r = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: r.status, body: await r.json() };
    },
    { path, method, body },
  );
}
async function setup(page: Page) {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/'))
      requests.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  const source = await actualBundledConnectionSource();
  const state = ResearchConnectionsSchema.parse(
    (await call(page, `${base}?itemId=${source.id}`)).body,
  );
  expect(state.selectedSource).toEqual(connectionSource(source));
  return { source, state, requests };
}
function input(
  source: FeedItem,
  target: { kind: 'goal' | 'holding'; id: string; version: number },
) {
  return {
    action: 'create',
    requestId: randomUUID(),
    expectedVersion: 0,
    source: {
      itemId: source.id,
      version: source.version,
      sourceHash: source.sourceHash,
    },
    target,
    note: 'My on-device research question.',
    storageConsent: true,
  };
}

test('E2E-OFFLINE-300 real bundled reader saves owned goal through review and survives durable reload with no network @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, requests } = await setup(page);
  await page.goto(`/#read/${source.id}`);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Connect to my records', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Choose a holding or goal', exact: true })
    .click();
  await page
    .getByLabel('Connect to', { exact: true })
    .selectOption({ label: `Goal: ${connectionGoal.name} · version 1` });
  await page
    .getByLabel('My personal reason', { exact: true })
    .fill('I want to revisit this dated source with my saved goal.');
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save research connection', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Research connections', exact: true })
      .getByRole('status'),
  ).toHaveText('Research connection saved.');
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(connectionGoal.name);
  await expect(page.getByText(/public reading snapshot saved/)).toBeVisible();
  expect((await call(page, base)).body.connections).toHaveLength(1);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-301 holding edit and removal retain receipt history through reload @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    id = randomUUID();
  const holding = state.targets.find((t) => t.binding.kind === 'holding')!;
  const created = await call(
    page,
    `${base}/${id}`,
    'PUT',
    input(source, holding.binding),
  );
  expect(created.status).toBe(200);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        action: 'edit',
        requestId: randomUUID(),
        expectedVersion: 1,
        note: 'Edited offline personal note.',
        storageConsent: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        action: 'remove',
        requestId: randomUUID(),
        expectedVersion: 2,
      })
    ).status,
  ).toBe(200);
  await page.goto('/#connections');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'All connection history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Research connection history' }),
  ).toContainText('revision 3 · remove');
  const history = await call(page, `${base}/${id}/history`);
  expect(
    history.body.revisions.map((r: { action: string }) => r.action),
  ).toEqual(['remove', 'edit', 'create']);
  expect(history.body.revisions[2]).toEqual(created.body);
  expect((await call(page, base)).body.connections).toEqual([]);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-302 local accounts isolate connection heads requests history and owned target choices @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    id = randomUUID();
  const target = state.targets.find((t) => t.binding.kind === 'goal')!;
  const original = input(source, target.binding);
  expect((await call(page, `${base}/${id}`, 'PUT', original)).status).toBe(200);
  expect((await call(page, '/api/v1/account/logout', 'POST', {})).status).toBe(
    200,
  );
  expect((await call(page, base)).status).toBe(401);
  await prepareConnectionBrowser(page);
  expect((await call(page, base)).body.connections).toEqual([]);
  expect((await call(page, `${base}/${id}/history`)).status).toBe(404);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        action: 'edit',
        requestId: randomUUID(),
        expectedVersion: 1,
        note: 'Foreign change',
        storageConsent: true,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await call(page, `${base}/${randomUUID()}`, 'PUT', {
        ...original,
        requestId: randomUUID(),
      })
    ).status,
  ).toBe(400);
  expect(
    (await call(page, '/api/v1/account/privacy/export')).body
      .researchConnections.revisions,
  ).toEqual([]);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-303 duplicate requests replay once and stale edits conflict without replacing history @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    id = randomUUID(),
    body = input(source, state.targets[0]!.binding);
  const first = await call(page, `${base}/${id}`, 'PUT', body),
    replay = await call(page, `${base}/${id}`, 'PUT', body);
  expect(first.status).toBe(200);
  expect(replay.body).toEqual(first.body);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        ...body,
        note: 'Different same request',
      })
    ).status,
  ).toBe(409);
  const edit = {
    action: 'edit',
    requestId: randomUUID(),
    expectedVersion: 1,
    note: 'Updated safely',
    storageConsent: true,
  };
  expect((await call(page, `${base}/${id}`, 'PUT', edit)).status).toBe(200);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        ...edit,
        requestId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    (await call(page, `${base}/${id}/history`)).body.revisions,
  ).toHaveLength(2);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-304 changed goals require explicit reaffirmation and keep original receipts @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    id = randomUUID(),
    target = state.targets.find((t) => t.binding.kind === 'goal')!;
  const original = input(source, target.binding);
  const created = await call(page, `${base}/${id}`, 'PUT', original);
  expect(created.status).toBe(200);
  expect(
    (
      await call(page, `/api/v1/account/goals/${target.binding.id}`, 'PUT', {
        expectedVersion: 1,
        goal: { ...connectionGoal, name: 'Revised local research goal' },
      })
    ).status,
  ).toBe(200);
  await page.goto('/#connections');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Saved research connections' })
      .getByRole('alert'),
  ).toContainText('Review your connection');
  await page
    .getByRole('button', { name: 'Review and reaffirm', exact: true })
    .click();
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save reaffirmed connection', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Saved research connections' })
      .getByRole('alert'),
  ).toHaveCount(0);
  const after = (await call(page, base)).body.connections[0];
  expect(after.revision.target.binding.version).toBe(2);
  expect((await call(page, `${base}/${id}/history`)).body.revisions[1]).toEqual(
    created.body,
  );
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-305 replaced holdings and removed goals stay reviewable without financial mutation @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    holdingId = randomUUID(),
    goalId = randomUUID();
  const holding = state.targets.find((t) => t.binding.kind === 'holding')!,
    goal = state.targets.find((t) => t.binding.kind === 'goal')!;
  expect(
    (
      await call(
        page,
        `${base}/${holdingId}`,
        'PUT',
        input(source, holding.binding),
      )
    ).status,
  ).toBe(200);
  expect(
    (await call(page, `${base}/${goalId}`, 'PUT', input(source, goal.binding)))
      .status,
  ).toBe(200);
  const preview = await call(page, '/api/v1/account/holdings/preview', 'POST', {
    csv: 'isin,quantity,total_cost_paise\nINE009A01021,2,9000',
    expectedVersion: 1,
    storageConsent: true,
  });
  expect(
    (
      await call(page, '/api/v1/account/holdings/confirm', 'POST', {
        previewId: preview.body.previewId,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await call(page, `/api/v1/account/goals/${goal.binding.id}`, 'DELETE', {
        expectedVersion: 1,
      })
    ).status,
  ).toBe(200);
  const before = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  const current = ResearchConnectionsSchema.parse(
    (await call(page, base)).body,
  );
  expect(
    current.connections.every(
      (c) => !c.currentTarget && c.reviewReasons.join(' ').includes('removed'),
    ),
  ).toBe(true);
  expect(
    (
      await call(page, `${base}/${holdingId}`, 'PUT', {
        action: 'remove',
        requestId: randomUUID(),
        expectedVersion: 1,
      })
    ).status,
  ).toBe(200);
  const after = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-306 strict bounds stale hash and missing consent reject writes and keep notes inert @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    original = input(source, state.targets[0]!.binding);
  for (const change of [
    { note: 'x'.repeat(1001) },
    { note: ' ' },
    { storageConsent: false },
    { tool: 'exfiltrate' },
  ])
    expect(
      (
        await call(page, `${base}/${randomUUID()}`, 'PUT', {
          ...original,
          ...change,
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await call(page, `${base}/${randomUUID()}`, 'PUT', {
        ...original,
        source: { ...original.source, sourceHash: '0'.repeat(64) },
      })
    ).status,
  ).toBe(409);
  const note = '<img src=x onerror="window.localConnectionInjection=true">';
  expect(
    (await call(page, `${base}/${randomUUID()}`, 'PUT', { ...original, note }))
      .status,
  ).toBe(200);
  await page.goto('/#connections');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(note);
  expect(await page.evaluate(() => 'localConnectionInjection' in window)).toBe(
    false,
  );
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-307 saved holdings and goals link back to actual dated research receipt @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page);
  expect(
    (
      await call(
        page,
        `${base}/${randomUUID()}`,
        'PUT',
        input(source, state.targets[0]!.binding),
      )
    ).status,
  ).toBe(200);
  await page.goto('/#holdings');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('link', {
      name: 'Research connections to my records',
      exact: true,
    })
    .click();
  await page
    .getByText('Connection details and dated source receipt', { exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(source.sourceHash!);
  await page
    .getByRole('link', { name: 'Read current published source', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await page.goto('/#my-goals');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('link', {
      name: 'Research connections to my records',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(source.source.name);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-308 private export and account deletion remove durable connection requests and history @EVIDENCE-LINKS-001', async ({
  page,
}) => {
  const { source, state, requests } = await setup(page),
    id = randomUUID(),
    original = input(source, state.targets[0]!.binding);
  const before = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  const saved = await call(page, `${base}/${id}`, 'PUT', original);
  const exported = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(exported.researchConnections.revisions).toEqual([saved.body]);
  expect(exported.holdings).toEqual(before.holdings);
  expect(exported.goals).toEqual(before.goals);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await call(page, base)).status).toBe(401);
  await prepareConnectionBrowser(page);
  expect(
    (await call(page, '/api/v1/account/privacy/export')).body
      .researchConnections.revisions,
  ).toEqual([]);
  expect((await call(page, `${base}/${id}/history`)).status).toBe(404);
  // Reuse the formerly deleted ID and request ID: no tombstone/history survives deletion.
  expect((await call(page, `${base}/${id}`, 'PUT', original)).status).toBe(200);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-309 synthetic bundle-upgrade and withdrawal run the actual local handler and retain exact original receipts @EVIDENCE-LINKS-001 @TEST-SIMULATION', async () => {
  // This targeted adapter case simulates a rebuilt bundle. The other packaged cases
  // verify actual fetch interception, durable storage, reload and zero networking.
  const { handleResearchConnections } =
    await import('../../../../apps/web/src/offline/research-connections');
  const { handleFinance } =
    await import('../../../../apps/web/src/offline/finance');
  const { OfflineError } =
    await import('../../../../apps/web/src/offline/types');
  type LocalState = import('../../../../apps/web/src/offline/types').LocalState;
  type OfflineBundle =
    import('../../../../apps/web/src/offline/types').OfflineBundle;
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const source = bundle.feed.find(
    (s) => s.id.startsWith('fed-') && connectionSource(s),
  )!;
  const userId = randomUUID(),
    id = randomUUID(),
    now = new Date().toISOString();
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: userId,
    users: {
      [userId]: {
        id: userId,
        username: 'synthetic_bundle_upgrade',
        createdAt: now,
        consentedAt: now,
        passwordHash: 'synthetic-not-a-login',
        passwordSalt: 'synthetic-not-a-login',
      },
    },
    data: {},
  };
  const req = (path: string, method: string, body?: unknown) => ({
    path,
    method,
    body,
    query: new URLSearchParams(),
    headers: new Headers(),
  });
  const goalResult = (await handleFinance(
    req('/api/v1/account/goals', 'POST', connectionGoal),
    state,
    bundle,
  ))!;
  const goal = goalResult.body as { id: string; version: number };
  const body = input(source, {
    kind: 'goal',
    id: goal.id,
    version: goal.version,
  });
  const created = (await handleResearchConnections(
    req(`${base}/${id}`, 'PUT', body),
    state,
    bundle,
  ))!.body;
  const newer = {
    ...source,
    version: source.version + 1,
    correctionNote: 'Synthetic test-only rebuilt bundle edition.',
  };
  const upgraded: OfflineBundle = {
    ...bundle,
    feed: bundle.feed.map((s) => (s.id === source.id ? newer : s)),
    histories: { ...bundle.histories, [source.id]: [newer, source] },
  };
  const changed = ResearchConnectionsSchema.parse(
    (await handleResearchConnections(req(base, 'GET'), state, upgraded))!.body,
  );
  expect(changed.connections[0]!.reviewReasons.join(' ')).toContain('newer');
  expect(changed.connections[0]!.revision).toEqual(created);
  expect(
    (await handleResearchConnections(
      req(`${base}/${id}`, 'PUT', {
        ...body,
        action: 'reaffirm',
        expectedVersion: 1,
        requestId: randomUUID(),
        source: { ...body.source, version: newer.version },
      }),
      state,
      upgraded,
    ))!.body,
  ).toMatchObject({ version: 2, source: { version: newer.version } });
  const withdrawn = {
    ...newer,
    version: newer.version + 1,
    status: 'withdrawn' as const,
  };
  const removedBundle: OfflineBundle = {
    ...upgraded,
    feed: upgraded.feed.filter((s) => s.id !== source.id),
    histories: {
      ...upgraded.histories,
      [source.id]: [withdrawn, newer, source],
    },
  };
  const removed = ResearchConnectionsSchema.parse(
    (await handleResearchConnections(req(base, 'GET'), state, removedBundle))!
      .body,
  );
  expect(removed.connections[0]!.currentSource).toBeNull();
  expect(removed.connections[0]!.reviewReasons.join(' ')).toContain(
    'withdrawn',
  );
  expect(JSON.stringify(removed)).not.toContain(source.title);
  await expect(
    Promise.resolve().then(() =>
      handleResearchConnections(
        req(`${base}/${id}`, 'PUT', {
          ...body,
          action: 'reaffirm',
          expectedVersion: 2,
          requestId: randomUUID(),
          source: { ...body.source, version: newer.version },
        }),
        state,
        removedBundle,
      ),
    ),
  ).rejects.toBeInstanceOf(OfflineError);
  const history = (await handleResearchConnections(
    req(`${base}/${id}/history`, 'GET'),
    state,
    removedBundle,
  ))!.body as { revisions: unknown[] };
  expect(history.revisions[1]).toEqual(created);
});
