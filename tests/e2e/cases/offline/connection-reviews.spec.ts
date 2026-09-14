import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  actualBundledConnectionSource,
  prepareConnectionBrowser,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
test('E2E-OFFLINE-340 dated local review notices acknowledge persist and export without API network @CONNECTION-REVIEWS-001', async ({
  page,
}) => {
  const source = await actualBundledConnectionSource(),
    id = randomUUID();
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  await page.evaluate(
    async ({ source, id }) => {
      const call = async (path: string, body: unknown, method = 'POST') => {
        const r = await fetch(`/api/v1/account/${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
        return r.json();
      };
      await call(
        `research-connections/${id}`,
        {
          action: 'create',
          requestId: crypto.randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: { kind: 'holding', id: 'INE002A01018', version: 1 },
          note: 'Synthetic local review question.',
          storageConsent: true,
        },
        'PUT',
      );
      const preview = await call('holdings/preview', {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,10000',
        expectedVersion: 1,
        storageConsent: true,
      });
      await call('holdings/confirm', {
        previewId: preview.previewId,
        expectedVersion: 1,
      });
    },
    { source, id },
  );
  await page.goto('/#connection-reviews');
  await page
    .getByRole('button', { name: 'Check for updates', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Review notices' }),
  ).toContainText('changed');
  await page
    .getByRole('button', {
      name: 'Acknowledge notice for INE002A01018',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Show notices', { exact: true })
    .selectOption('acknowledged');
  await expect(
    page.getByRole('region', { name: 'Review notices' }),
  ).toContainText('acknowledged');
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByLabel('Show notices', { exact: true })
    .selectOption('acknowledged');
  await expect(
    page.getByRole('region', { name: 'Review notices' }),
  ).toContainText('acknowledged');
  const exported = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/privacy/export');
    if (!r.ok) throw Error('Export failed');
    return r.json();
  });
  expect(exported.connectionReviews.notices).toHaveLength(1);
  expect(exported.connectionReviews.bundleGeneratedAt).toBeTruthy();
  expect(network).toEqual([]);
  await page.evaluate(async (password) => {
    const r = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) throw Error('Delete failed');
  }, connectionPassword);
});

// Helpers are invoked only by selected cases. They start no browser, storage or
// provider operation during test discovery. Financial inputs below are synthetic.
async function localReviewFixture() {
  const { readFile } = await import('node:fs/promises');
  const { handleFinance } =
    await import('../../../../apps/web/src/offline/finance');
  const { handleResearchConnections } =
    await import('../../../../apps/web/src/offline/research-connections');
  const { handleConnectionReviews, exportLocalConnectionReviews } =
    await import('../../../../apps/web/src/offline/connection-reviews');
  const {
    ResearchConnectionRevisionSchema,
    ConnectionReviewInboxSchema,
    ConnectionReviewReceiptSchema,
  } = await import('../../../../packages/contracts/src/index');
  const { connectionGoal } =
    await import('../../helpers/research-connection-fixture');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as import('../../../../apps/web/src/offline/types').OfflineBundle;
  const source = await actualBundledConnectionSource();
  const user = {
    id: randomUUID(),
    username: 'synthetic_review_adapter',
    createdAt: new Date().toISOString(),
    consentedAt: new Date().toISOString(),
    passwordHash: 'synthetic-unused',
    passwordSalt: 'synthetic-unused',
  };
  const state: import('../../../../apps/web/src/offline/types').LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: { [user.id]: user },
    sessionUserId: user.id,
    data: {},
  };
  const req = (path: string, method: string, body?: unknown) => ({
    path,
    method,
    body,
    headers: new Headers(),
    query: new URLSearchParams(),
  });
  const goal = (await handleFinance(
    req('/api/v1/account/goals', 'POST', connectionGoal),
    state,
    bundle,
  ))!.body as { id: string; version: number };
  const original = ResearchConnectionRevisionSchema.parse(
    (await handleResearchConnections(
      req(`/api/v1/account/research-connections/${randomUUID()}`, 'PUT', {
        action: 'create',
        requestId: randomUUID(),
        expectedVersion: 0,
        source: {
          itemId: source.id,
          version: source.version,
          sourceHash: source.sourceHash,
        },
        target: { kind: 'goal', id: goal.id, version: 1 },
        note: 'Synthetic local turnover question.',
        storageConsent: true,
      }),
      state,
      bundle,
    ))!.body,
  );
  const base = '/api/v1/account/connection-reviews';
  const check = async (requestId: string = randomUUID()) =>
    ConnectionReviewReceiptSchema.parse(
      (await handleConnectionReviews(
        req(`${base}/check`, 'POST', { requestId }),
        state,
        bundle,
      ))!.body,
    );
  const inbox = async () =>
    ConnectionReviewInboxSchema.parse(
      (await handleConnectionReviews(req(base, 'GET'), state, bundle))!.body,
    );
  return {
    state,
    user,
    bundle,
    source,
    goal,
    original,
    req,
    check,
    inbox,
    handleFinance,
    handleConnectionReviews,
    exportLocalConnectionReviews,
    ResearchConnectionRevisionSchema,
    connectionGoal,
    base,
  };
}

test('E2E-OFFLINE-341 actual local evaluator permits600-head turnover while retaining bounded notices and exact histories @CONNECTION-REVIEWS-001 @TEST-SIMULATION', async () => {
  const f = await localReviewFixture();
  type Revision = typeof f.original;
  let history: Revision[] = [];
  const group = (version: number) =>
    Array.from({ length: 200 }, () =>
      f.ResearchConnectionRevisionSchema.parse({
        ...f.original,
        id: randomUUID(),
        savedAt: new Date().toISOString(),
        consentedAt: new Date().toISOString(),
        target: {
          ...f.original.target,
          binding: { ...f.original.target.binding, version },
        },
      }),
    );
  const store = () => {
    f.state.data.localResearchConnections = {
      [f.user.id]: { revisions: history, requests: {} },
    };
  };
  const remove = (rows: Revision[]) =>
    rows.map((r) =>
      f.ResearchConnectionRevisionSchema.parse({
        ...r,
        version: 2,
        action: 'remove',
        removed: true,
        savedAt: new Date().toISOString(),
      }),
    );
  const updateGoal = async (expectedVersion: number) => {
    const result = await f.handleFinance(
      f.req(`/api/v1/account/goals/${f.goal.id}`, 'PUT', {
        expectedVersion,
        goal: {
          ...f.connectionGoal,
          monthlyMinor: String(100 + expectedVersion),
        },
      }),
      f.state,
      f.bundle,
    );
    expect(result?.status ?? 200).toBe(200);
  };
  // Synthetic large receipt histories use the actual validated owned goal/source
  // shape. Every check and goal update executes the real local domain handlers.
  const b = group(1);
  history = [...b];
  store();
  await updateGoal(1);
  await f.check();
  expect(
    (await f.inbox()).notices.filter((n) => n.status === 'open'),
  ).toHaveLength(200);
  history.push(...remove(b));
  store();
  await f.check();
  expect(
    (await f.inbox()).notices.filter((n) => n.status === 'resolved'),
  ).toHaveLength(200);
  const a = group(2);
  history.push(...a);
  store();
  await updateGoal(2);
  await f.check();
  const previous = await f.inbox();
  expect(previous.notices).toHaveLength(400);
  expect(previous.notices.filter((n) => n.status === 'open')).toHaveLength(200);
  history.push(...remove(a), ...group(3));
  store();
  const beforeHistory = JSON.stringify(f.state.data.localResearchConnections),
    beforeGoals = JSON.stringify(f.state.data.localGoals);
  const receipt = await f.check(),
    after = await f.inbox();
  expect(receipt.evaluation!.changedCount).toBe(200);
  expect(after.notices).toHaveLength(200);
  expect(after.notices.every((n) => n.status === 'resolved')).toBe(true);
  expect(JSON.stringify(f.state.data.localResearchConnections)).toBe(
    beforeHistory,
  );
  expect(JSON.stringify(f.state.data.localGoals)).toBe(beforeGoals);
  expect(await f.check(receipt.requestId)).toEqual(receipt);
  expect(await f.inbox()).toEqual(after);
  const recheck = await f.check();
  expect(recheck.evaluation!.changedCount).toBe(0);
  const exported = f.exportLocalConnectionReviews(f.state, f.user.id);
  expect(exported.notices).toHaveLength(200);
  expect(exported.receipts).toHaveLength(5);
  expect(exported.bundleGeneratedAt).toBe(f.bundle.generatedAt);
  expect(JSON.stringify(f.state.data.localResearchConnections)).toBe(
    beforeHistory,
  );
});

test('E2E-OFFLINE-342 exact old check and ack replay never hide later changed removed or persisted states @CONNECTION-REVIEWS-001', async ({
  page,
}) => {
  const source = await actualBundledConnectionSource(),
    id = randomUUID(),
    base = '/api/v1/account/connection-reviews',
    network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/')) network.push(r.url());
  });
  const call = async (path: string, method = 'GET', body?: unknown) =>
    page.evaluate(
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
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  const goals = (await call('/api/v1/account/goals')).body.goals,
    goal = goals[0];
  expect(
    (
      await call(`/api/v1/account/research-connections/${id}`, 'PUT', {
        action: 'create',
        requestId: randomUUID(),
        expectedVersion: 0,
        source: {
          itemId: source.id,
          version: source.version,
          sourceHash: source.sourceHash,
        },
        target: { kind: 'goal', id: goal.id, version: 1 },
        note: 'Synthetic durable inbox question.',
        storageConsent: true,
      })
    ).status,
  ).toBe(200);
  const cleanRequest = { requestId: randomUUID() },
    clean = (await call(`${base}/check`, 'POST', cleanRequest)).body;
  expect((await call(base)).body.notices).toEqual([]);
  const update = async (expectedVersion: number, monthlyMinor: string) => {
    const { connectionGoal } =
      await import('../../helpers/research-connection-fixture');
    expect(
      (
        await call(`/api/v1/account/goals/${goal.id}`, 'PUT', {
          expectedVersion,
          goal: { ...connectionGoal, monthlyMinor },
        })
      ).status,
    ).toBe(200);
  };
  await update(1, '150');
  expect((await call(`${base}/check`, 'POST', cleanRequest)).body).toEqual(
    clean,
  );
  expect((await call(base)).body.notices).toEqual([]);
  const changed = (
    await call(`${base}/check`, 'POST', { requestId: randomUUID() })
  ).body;
  const first = (await call(base)).body.notices[0];
  expect(first.status).toBe('open');
  const ackRequest = {
      requestId: randomUUID(),
      expectedVersion: first.version,
    },
    ack = (await call(`${base}/${id}/acknowledge`, 'POST', ackRequest)).body;
  await call(`${base}/check`, 'POST', { requestId: randomUUID() });
  expect((await call(base)).body.notices[0].status).toBe('acknowledged');
  await update(2, '175');
  await call(`${base}/check`, 'POST', { requestId: randomUUID() });
  const reopened = (await call(base)).body.notices[0];
  expect(reopened.status).toBe('open');
  expect(reopened.version).toBeGreaterThan(first.version);
  expect(
    (await call(`${base}/${id}/acknowledge`, 'POST', ackRequest)).body,
  ).toEqual(ack);
  expect((await call(base)).body.notices[0]).toEqual(reopened);
  expect(
    (
      await call(`${base}/${id}/acknowledge`, 'POST', {
        ...ackRequest,
        expectedVersion: reopened.version,
      })
    ).status,
  ).toBe(409);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await call(base)).body.notices[0]).toEqual(reopened);
  const before = (await call('/api/v1/account/privacy/export')).body;
  expect(
    (
      await call(`/api/v1/account/research-connections/${id}`, 'PUT', {
        action: 'remove',
        requestId: randomUUID(),
        expectedVersion: 1,
      })
    ).status,
  ).toBe(200);
  await call(`${base}/check`, 'POST', { requestId: randomUUID() });
  const resolved = (await call(base)).body.notices[0];
  expect(resolved.status).toBe('resolved');
  expect(
    (await call(`${base}/check`, 'POST', { requestId: changed.requestId }))
      .body,
  ).toEqual(changed);
  expect((await call(base)).body.notices[0]).toEqual(resolved);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const after = (await call('/api/v1/account/privacy/export')).body;
  expect(after.connectionReviews.notices[0]).toEqual(resolved);
  expect(
    after.connectionReviews.receipts.some(
      (r: { requestId: string }) => r.requestId === ack.requestId,
    ),
  ).toBe(true);
  expect(after.connectionReviews.bundleGeneratedAt).toBeTruthy();
  expect(after.goals).toEqual(before.goals);
  expect(after.holdings).toEqual(before.holdings);
  expect(after.allocations).toEqual(before.allocations);
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-343 actual local request capacity preserves recent replay and expires only dated operation receipts @CONNECTION-REVIEWS-001 @TEST-SIMULATION', async () => {
  test.setTimeout(60000);
  const f = await localReviewFixture();
  const first = await f.check();
  for (let i = 1; i < 1000; i++) await f.check();
  const before = await f.inbox(),
    beforeConnections = JSON.stringify(f.state.data.localResearchConnections),
    beforeGoals = JSON.stringify(f.state.data.localGoals);
  expect(before.evaluations).toHaveLength(100);
  expect(
    f.exportLocalConnectionReviews(f.state, f.user.id).receipts,
  ).toHaveLength(1000);
  expect(await f.check(first.requestId)).toEqual(first);
  expect(await f.inbox()).toEqual(before);
  await expect(f.check()).rejects.toMatchObject({ status: 400 });
  expect(await f.inbox()).toEqual(before);
  await expect(
    Promise.resolve().then(() =>
      f.handleConnectionReviews(
        f.req(`${f.base}/${f.original.id}/acknowledge`, 'POST', {
          requestId: first.requestId,
          expectedVersion: 1,
        }),
        f.state,
        f.bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 409 });
  type Entry = {
    fingerprint: string;
    receipt: import('../../../../packages/contracts/src/index').ConnectionReviewReceipt;
  };
  const saved = (
    f.state.data.localConnectionReviews as Record<
      string,
      {
        inbox: import('../../../../packages/contracts/src/index').ConnectionReviewInbox;
        requests: Record<string, Entry>;
      }
    >
  )[f.user.id]!;
  const agedId = Object.keys(saved.requests)[500]!,
    aged = saved.requests[agedId]!;
  // Explicitly aged test metadata represents time passing without changing the
  // process clock or the existing public/source/financial history.
  const oldDate = new Date(Date.now() - 31 * 86400000).toISOString();
  aged.receipt = {
    ...aged.receipt,
    recordedAt: oldDate,
    evaluation: aged.receipt.evaluation
      ? { ...aged.receipt.evaluation, checkedAt: oldDate }
      : null,
  };
  expect(
    f.exportLocalConnectionReviews(f.state, f.user.id).receipts,
  ).toHaveLength(999);
  const fresh = await f.check(agedId);
  expect(fresh.requestId).toBe(agedId);
  expect(fresh.recordedAt).not.toBe(oldDate);
  expect(fresh.evaluation!.changedCount).toBe(0);
  expect(
    f.exportLocalConnectionReviews(f.state, f.user.id).receipts,
  ).toHaveLength(1000);
  expect((await f.inbox()).evaluations).toHaveLength(100);
  expect(await f.check(first.requestId)).toEqual(first);
  expect(JSON.stringify(f.state.data.localResearchConnections)).toBe(
    beforeConnections,
  );
  expect(JSON.stringify(f.state.data.localGoals)).toBe(beforeGoals);
});
