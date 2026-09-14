import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { bundledBea, beaBrowserCall as call } from '../../helpers/bea-fixture';
import {
  actualBundledConnectionSource,
  prepareConnectionBrowser,
  connectionPassword,
  connectionGoal,
} from '../../helpers/research-connection-fixture';
import {
  ConnectionReviewReceiptSchema,
  ConnectionReviewInboxSchema,
  FeedItemSchema,
  FeedSchema,
  DiscoveryEvidenceSchema,
  LibrarySchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import type {
  LocalState,
  OfflineRequest,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
const req = (path: string, method = 'GET', body?: unknown): OfflineRequest => ({
  path,
  method,
  body,
  query: new URLSearchParams(),
  headers: new Headers(),
});
const empty = (): LocalState => ({
  schemaVersion: 1,
  revision: 0,
  users: {},
  sessionUserId: null,
  data: {},
});
async function sourceBundle() {
  const { bundle } = await bundledBea();
  const source = await actualBundledConnectionSource();
  return { bundle: bundle as OfflineBundle, source };
}

test('E2E-OFFLINE-390 genuine stored reading uses scoped evidence and durable private library with zero API traffic @SOURCE-WITHDRAWAL-001', async ({
  page,
}) => {
  const source = await actualBundledConnectionSource(),
    network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) network.push(r.url());
  });
  await page.goto(`/#read/${source.id}`);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  const evidence = DiscoveryEvidenceSchema.parse(
    (await call(page, `/api/v1/discovery/items/${source.id}/evidence`)).body,
  );
  expect(evidence.scope).toBe('published-edition');
  expect(evidence.hash).toBe(source.sourceHash);
  expect(JSON.parse(evidence.body).itemId).toBe(source.id);
  await prepareConnectionBrowser(page);
  expect(
    (
      await call(
        page,
        `/api/v1/account/library/items/${source.id}/save`,
        'PUT',
        { version: source.version },
      )
    ).status,
  ).toBe(200);
  await page.goto('/#saved');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved reading' }),
  ).toContainText(source.title);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const exported = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(exported.library.data?.saved[0]?.summary).toBe(source.summary);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await call(page, '/api/v1/account/library')).status).toBe(401);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-391 newer withdrawal history overrides stale feed for every public handler without mutating originals @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async () => {
  const { bundle, source } = await sourceBundle(),
    state = empty();
  const withdrawal = FeedItemSchema.parse({
    ...source,
    version: source.version + 1,
    status: 'withdrawn',
    correctionNote: `Synthetic withdrawal containing ${source.title}`,
  });
  const simulated: OfflineBundle = {
    ...bundle,
    histories: { ...bundle.histories, [source.id]: [withdrawal, source] },
  };
  const original = JSON.stringify(simulated);
  const { handleContent } =
    await import('../../../../apps/web/src/offline/content');
  const feed = FeedSchema.parse(
    (await handleContent(req('/api/v1/discovery/feed'), state, simulated))
      ?.body,
  );
  expect(feed.items.some((i) => i.id === source.id)).toBe(false);
  for (const suffix of ['', '/history']) {
    const value = await handleContent(
      req(`/api/v1/discovery/items/${source.id}${suffix}`),
      state,
      simulated,
    );
    expect(JSON.stringify(value)).not.toContain(source.title);
    expect(JSON.stringify(value)).not.toContain(source.body);
  }
  for (const suffix of ['/evidence', '/media', '/context'])
    await expect(
      handleContent(
        req(`/api/v1/discovery/items/${source.id}${suffix}`),
        state,
        simulated,
      ),
    ).rejects.toMatchObject({ status: 404 });
  expect(JSON.stringify(simulated)).toBe(original);
  expect(state).toEqual(empty());
});
test('E2E-OFFLINE-392 actual local handlers retain notes reports and snapshots while projecting withdrawal replay export and deletion @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async () => {
  const { bundle, source } = await sourceBundle();
  let state = empty();
  const [
    { handleAccounts },
    { handleFinance },
    { handleLibrary },
    { handleResearchConnections },
    { reportsHandler },
    { handleConnectionReviews },
  ] = await Promise.all([
    import('../../../../apps/web/src/offline/accounts'),
    import('../../../../apps/web/src/offline/finance'),
    import('../../../../apps/web/src/offline/library'),
    import('../../../../apps/web/src/offline/research-connections'),
    import('../../../../apps/web/src/offline/reports'),
    import('../../../../apps/web/src/offline/connection-reviews'),
  ]);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('Local handler attempted network.');
  };
  try {
    await handleAccounts(
      req('/api/v1/account/register', 'POST', {
        username: `withdraw_${randomUUID().slice(0, 8)}`,
        password: connectionPassword,
        consent: true,
      }),
      state,
      bundle,
    );
    const goal = (await handleFinance(
      req('/api/v1/account/goals', 'POST', connectionGoal),
      state,
      bundle,
    ))!.body as { id: string; version: number };
    await handleLibrary(
      req(`/api/v1/account/library/items/${source.id}/save`, 'PUT', {
        version: source.version,
      }),
      state,
      bundle,
    );
    const input = {
      itemId: source.id,
      dueAt: new Date(Date.now() + 3600000).toISOString(),
      timeZone: 'Asia/Kolkata',
      idempotencyKey: randomUUID(),
    };
    const reminder = (await handleLibrary(
      req('/api/v1/account/library/reminders', 'POST', input),
      state,
      bundle,
    ))!.body as { id: string; version: number };
    const id = randomUUID(),
      created = (await handleResearchConnections(
        req(`/api/v1/account/research-connections/${id}`, 'PUT', {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: { kind: 'goal', id: goal.id, version: goal.version },
          note: 'My own unchanged local note',
          storageConsent: true,
        }),
        state,
        bundle,
      ))!.body;
    const reportRequest = {
      requestId: randomUUID(),
      label: 'Synthetic retained local report',
      consent: true,
      researchConnections: [{ id, version: 1 }],
    };
    await reportsHandler(
      req('/api/v1/account/reports', 'POST', reportRequest),
      state,
      bundle,
    );
    await reportsHandler(req('/api/v1/account/reports'), state, bundle);
    const before = PrivacyExportSchema.parse(
      (await handleAccounts(
        req('/api/v1/account/privacy/export'),
        state,
        bundle,
      ))!.body,
    );
    // Explicit fault fixture: the actual bundle itself is not rewritten or presented as live data.
    const withdrawn = FeedItemSchema.parse({
        ...source,
        version: source.version + 1,
        status: 'withdrawn',
      }),
      simulated = {
        ...bundle,
        histories: { ...bundle.histories, [source.id]: [withdrawn, source] },
      };
    const visible = LibrarySchema.parse(
      (await handleLibrary(req('/api/v1/account/library'), state, simulated))!
        .body,
    );
    expect(visible.saved[0]?.summary).toBe('');
    expect(visible.reminders[0]?.currentStatus).toBe('withdrawn');
    const replay = (await handleLibrary(
      req('/api/v1/account/library/reminders', 'POST', input),
      state,
      simulated,
    ))!.body as { id: string; title: string };
    expect(replay.id).toBe(reminder.id);
    expect(replay.title).toBe('Withdrawn source item');
    const checked = await handleConnectionReviews(
      req('/api/v1/account/connection-reviews/check', 'POST', {
        requestId: randomUUID(),
      }),
      state,
      simulated,
    );
    expect(
      ConnectionReviewReceiptSchema.parse(checked!.body).evaluation
        ?.changedCount,
    ).toBe(1);
    const inbox = ConnectionReviewInboxSchema.parse(
      (await handleConnectionReviews(
        req('/api/v1/account/connection-reviews'),
        state,
        simulated,
      ))!.body,
    );
    const notice = inbox.notices.find((value) => value.connectionId === id);
    expect(notice?.status).toBe('open');
    expect(notice?.reasons.join(' ')).toContain('withdrawn');
    // Round-trip the actual serialized workspace, then exercise export/deletion through handlers again.
    state = JSON.parse(JSON.stringify(state));
    const exported = PrivacyExportSchema.parse(
      (await handleAccounts(
        req('/api/v1/account/privacy/export'),
        state,
        simulated,
      ))!.body,
    );
    expect(exported.researchConnections.revisions).toEqual([created]);
    expect(exported.reports.jobs).toEqual(before.reports.jobs);
    expect(exported.goals).toEqual(before.goals);
    expect(JSON.stringify(exported.library)).not.toContain(source.title);
    const stored = (
      state.data.localLibraries as Record<
        string,
        { saved: Array<{ summary: string }> }
      >
    )[state.sessionUserId!]!;
    expect(stored.saved[0]?.summary).toBe(source.summary);
    await handleLibrary(
      req(`/api/v1/account/library/reminders/${reminder.id}`, 'DELETE', {
        expectedVersion: reminder.version,
      }),
      state,
      simulated,
    );
    await handleAccounts(
      req('/api/v1/account', 'DELETE', { password: connectionPassword }),
      state,
      simulated,
    );
    expect(state.sessionUserId).toBeNull();
    expect(Object.keys(state.users)).toHaveLength(0);
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-393 explicit republication restores saved edition disclosure while withdrawal history stays redacted @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async () => {
  const { bundle, source } = await sourceBundle(),
    state = empty();
  const withdrawn = FeedItemSchema.parse({
      ...source,
      version: source.version + 1,
      status: 'withdrawn',
    }),
    restored = FeedItemSchema.parse({
      ...source,
      version: source.version + 2,
      status: 'published',
    });
  const simulated = {
    ...bundle,
    feed: bundle.feed.filter((v) => v.id !== source.id),
    histories: {
      ...bundle.histories,
      [source.id]: [restored, withdrawn, source],
    },
  };
  const { handleContent } =
    await import('../../../../apps/web/src/offline/content');
  expect(
    FeedItemSchema.parse(
      (await handleContent(
        req(`/api/v1/discovery/items/${source.id}`),
        state,
        simulated,
      ))!.body,
    ),
  ).toEqual(restored);
  const history = FeedItemSchema.array().parse(
    (await handleContent(
      req(`/api/v1/discovery/items/${source.id}/history`),
      state,
      simulated,
    ))!.body,
  );
  expect(history.find((v) => v.status === 'withdrawn')?.summary).toBe('');
  expect(history.find((v) => v.version === source.version)).toEqual(source);
  expect(
    JSON.parse(
      DiscoveryEvidenceSchema.parse(
        (await handleContent(
          req(`/api/v1/discovery/items/${source.id}/evidence`),
          state,
          simulated,
        ))!.body,
      ).body,
    ).version,
  ).toBe(restored.version);
});
