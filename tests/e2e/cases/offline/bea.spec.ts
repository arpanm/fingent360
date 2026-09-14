import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  bundledBea,
  beaBrowserCall as call,
  beaConnectionInput,
} from '../../helpers/bea-fixture';
import {
  prepareConnectionBrowser,
  connectionGoal,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import {
  ConnectionReviewReceiptSchema,
  DiscoveryEvidenceSchema,
  FeedItemSchema,
  FeedSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import type {
  LocalState,
  OfflineBundle,
  OfflineRequest,
} from '../../../../apps/web/src/offline/types';

test('E2E-OFFLINE-350 genuine BEA snapshot source Scan Stories reader metadata history and Back use zero API network @BEA-001', async ({
  page,
}) => {
  const { item, bundle } = await bundledBea();
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) network.push(r.url());
  });
  await page.goto('/#explore?source=bea&region=global');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(page.getByLabel('Research source', { exact: true })).toHaveValue(
    'bea',
  );
  expect(
    FeedSchema.parse(
      (await call(page, '/api/v1/discovery/feed?source=bea&view=explore')).body,
    ).items.every((i) => i.id.startsWith('bea-')),
  ).toBe(true);
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Reading story' }),
  ).toBeVisible();
  await page.goto(`/#read/${item.id}`);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/BEA headline only\. Open the original release/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Stored evidence', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Stored source evidence' });
  await expect(
    dialog.getByText(/Selected release metadata only/),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  const evidence = DiscoveryEvidenceSchema.parse(
    (await call(page, `/api/v1/discovery/items/${item.id}/evidence`)).body,
  );
  expect(evidence.hash).toBe(item.sourceHash);
  expect(evidence.scope).toBe('release-metadata');
  expect(evidence.body).not.toMatch(/description|percentChange|<data>|<pdf>/);
  const feed = FeedSchema.parse(
    (await call(page, '/api/v1/discovery/feed?source=bea')).body,
  );
  expect(feed.evaluatedAt).toBe(bundle.generatedAt);
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Version history' }),
  ).toContainText(item.title);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-351 BEA owned receipts reports and review notices persist replay export and deletion with no API requests @BEA-001', async ({
  page,
}) => {
  const { item, bundle } = await bundledBea(),
    network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  const goals = (await call(page, '/api/v1/account/goals')).body.goals,
    goal = goals[0],
    id = randomUUID(),
    base = '/api/v1/account/research-connections',
    inbox = '/api/v1/account/connection-reviews';
  const input = beaConnectionInput(item, goal.id),
    saved = await call(page, `${base}/${id}`, 'PUT', input);
  expect(saved.status).toBe(200);
  expect(saved.body.source.itemId).toBe(item.id);
  expect(saved.body.source).not.toHaveProperty('title');
  expect(
    (
      await call(page, `/api/v1/account/goals/${goal.id}`, 'PUT', {
        expectedVersion: goal.version,
        goal: { ...connectionGoal, monthlyMinor: '200' },
      })
    ).status,
  ).toBe(200);
  const before = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  const check = { requestId: randomUUID() },
    checked = await call(page, `${inbox}/check`, 'POST', check);
  expect(checked.status).toBe(200);
  expect(ConnectionReviewReceiptSchema.parse(checked.body).requestId).toBe(
    check.requestId,
  );
  const notice = (await call(page, inbox)).body.notices[0];
  expect(notice.reasons.join(' ')).toMatch(/records changed/);
  expect(notice.bundleGeneratedAt).toBe(bundle.generatedAt);
  expect(
    (
      await call(page, `${inbox}/${id}/acknowledge`, 'POST', {
        requestId: randomUUID(),
        expectedVersion: notice.version,
      })
    ).status,
  ).toBe(200);
  const reportId = randomUUID();
  expect(
    (
      await call(page, '/api/v1/account/reports', 'POST', {
        requestId: reportId,
        label: 'My dated BEA connection',
        consent: true,
        researchConnections: [{ id, version: 1 }],
      })
    ).status,
  ).toBe(201);
  const job = (await call(page, `/api/v1/account/reports/${reportId}`)).body;
  expect(job.status).toBe('succeeded');
  expect(job.report.policy).toBe('saved-record-review-v2');
  expect(job.report.snapshot.researchConnections.receipts[0].revision).toEqual(
    saved.body,
  );
  expect(JSON.stringify(job.report)).not.toContain(item.title);
  expect(
    (
      await call(page, `${base}/${id}`, 'PUT', {
        action: 'remove',
        requestId: randomUUID(),
        expectedVersion: 1,
      })
    ).status,
  ).toBe(200);
  await call(page, `${inbox}/check`, 'POST', { requestId: randomUUID() });
  expect((await call(page, inbox)).body.notices[0].status).toBe('resolved');
  expect((await call(page, `${inbox}/check`, 'POST', check)).body).toEqual(
    checked.body,
  );
  expect((await call(page, `${base}/${id}`, 'PUT', input)).body).toEqual(
    saved.body,
  );
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await call(page, inbox)).body.notices[0].status).toBe('resolved');
  const after = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(after.goals).toEqual(before.goals);
  expect(after.holdings).toEqual(before.holdings);
  expect(after.researchConnections.revisions).toHaveLength(2);
  expect(JSON.stringify(after)).toContain('saved-record-review-v2');
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  expect((await call(page, '/api/v1/account/privacy/export')).status).toBe(401);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await call(page, inbox)).status).toBe(401);
  expect(network).toEqual([]);
});

const request = (path: string): OfflineRequest => ({
  method: 'GET',
  path,
  query: new URLSearchParams(),
  body: undefined,
  headers: new Headers(),
});
const empty = (): LocalState => ({
  schemaVersion: 1,
  revision: 0,
  users: {},
  sessionUserId: null,
  data: {},
});
test('E2E-OFFLINE-352 synthetic BEA withdrawal bundle redacts old public titles history and evidence without mutating source history @BEA-001 @TEST-SIMULATION', async () => {
  const { bundle, item } = await bundledBea();
  const { handleContent } =
    await import('../../../../apps/web/src/offline/content');
  const current = FeedItemSchema.parse({
    ...item,
    version: item.version + 1,
    status: 'withdrawn',
    correctionNote: 'Synthetic local withdrawal acceptance.',
  });
  const simulated: OfflineBundle = {
    ...bundle,
    feed: [current],
    histories: { [item.id]: [current, item] },
  };
  const original = JSON.stringify(simulated.histories),
    state = empty();
  const shown = FeedItemSchema.parse(
    (
      await handleContent(
        request(`/api/v1/discovery/items/${item.id}`),
        state,
        simulated,
      )
    )?.body,
  );
  expect(shown.title).toBe('Withdrawn BEA release');
  expect(shown.body).toBe('');
  const history = (
    await handleContent(
      request(`/api/v1/discovery/items/${item.id}/history`),
      state,
      simulated,
    )
  )?.body;
  expect(JSON.stringify(history)).not.toContain(item.title);
  await expect(
    handleContent(
      request(`/api/v1/discovery/items/${item.id}/evidence`),
      state,
      simulated,
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    handleContent(
      request(`/api/v1/discovery/items/${item.id}/context`),
      state,
      simulated,
    ),
  ).rejects.toMatchObject({ status: 404 });
  expect(JSON.stringify(simulated.histories)).toBe(original);
  expect(state).toEqual(empty());
});

test('E2E-OFFLINE-353 pre-BEA snapshot remains a truthful empty source collection and cannot invent evidence @BEA-001 @TEST-SIMULATION', async () => {
  const { bundle, item } = await bundledBea();
  const { handleContent } =
    await import('../../../../apps/web/src/offline/content');
  const older: OfflineBundle = {
    ...bundle,
    feed: bundle.feed.filter((i: { id: string }) => !i.id.startsWith('bea-')),
    histories: Object.fromEntries(
      Object.entries(bundle.histories).filter(([id]) => !id.startsWith('bea-')),
    ),
    evidence: Object.fromEntries(
      Object.entries(bundle.evidence).filter(([id]) => !id.startsWith('bea-')),
    ),
    media: Object.fromEntries(
      Object.entries(bundle.media).filter(([id]) => !id.startsWith('bea-')),
    ),
  };
  const req = request('/api/v1/discovery/feed');
  req.query = new URLSearchParams({ source: 'bea', view: 'explore' });
  expect(
    FeedSchema.parse((await handleContent(req, empty(), older))?.body).items,
  ).toEqual([]);
  await expect(
    handleContent(
      request(`/api/v1/discovery/items/${item.id}`),
      empty(),
      older,
    ),
  ).rejects.toMatchObject({ status: 404 });
});
