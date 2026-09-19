import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Download, Locator, Page } from '@playwright/test';
import { test, expect, eventHeaders } from '../../helpers/event-fixture';
import {
  withdrawalFixture,
  withdrawReview,
} from '../../helpers/withdrawal-fixture';
import { reviseConnectionSourceFixture } from '../../helpers/research-connection-fixture';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  EvalDetailSchema,
  EvalListSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function keyboardActivate(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  // Repeated programmatic focus would bypass the tab-order acceptance claim.
  for (let step = 0; step < 180; step++) {
    if (await target.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
}
async function downloadedJson(download: Download): Promise<unknown> {
  const path = await download.path();
  if (!path) throw Error('Expected a saved browser download.');
  return JSON.parse(await readFile(path, 'utf8'));
}
async function contained(region: Locator) {
  await expect
    .poll(() =>
      region.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          element.scrollWidth <= element.clientWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1
        );
      }),
    )
    .toBe(true);
}

test('E2E-WEB-1118 actual evaluation inspector filters retries exports retained evidence and withholds withdrawn content with keyboard navigation @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(60000);
  const fixture = await withdrawalFixture(request, feedbackSandbox);
  const response = await request.get(
    '/api/v1/discovery/items/' + fixture.first.id,
  );
  expect(response.status()).toBe(200);
  const item = FeedItemSchema.parse(await response.json());
  const sibling = await request.get(
    '/api/v1/discovery/items/' + fixture.sibling.id,
  );
  expect(sibling.status()).toBe(200);
  const feedbackId = randomUUID();
  const feedbackText =
    'TEST-SIMULATION evaluation inspector feedback; no actual user data.';
  const feedback = await request.post('/api/v1/feedback', {
    headers: eventHeaders,
    data: {
      id: feedbackId,
      receiptToken: 'a'.repeat(64),
      text: feedbackText,
      consent: true,
      image: null,
      audio: null,
      context: {
        screen: 'read/' + item.id,
        runtime: 'offline',
        appVersion: 'synthetic-test',
        viewport: { width: 360, height: 720 },
        capturedAt: new Date().toISOString(),
        publicView: {
          kind: 'reader',
          capturedAt: new Date().toISOString(),
          item,
        },
      },
    },
  });
  expect(feedback.status()).toBe(201);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Research evaluation');
  const region = page.getByRole('region', {
    name: 'Research evaluation',
    exact: true,
  });
  const filter = region.getByLabel('Source item ID', { exact: true });
  const find = region.getByRole('button', {
    name: 'Find evaluation records',
    exact: true,
  });
  const inspect = region.getByRole('button', {
    name: 'Open source trace',
    exact: true,
  });
  await filter.fill(item.id + '-absent');
  // Filling is setup; the next control must be reached through native Tab.
  await expect(filter).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(find).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(region).toContainText('No captured public views yet.');
  await filter.fill(item.id);
  await keyboardActivate(page, find);
  const row = region.getByRole('button', {
    name: item.id + ' · edition ' + item.version,
    exact: true,
  });
  await expect(row).toBeVisible();
  await expect(region.getByRole('listitem')).toHaveCount(1);
  await expect(region).not.toContainText(fixture.sibling.id);
  // Only transport failure is simulated; recovery always uses the real isolated API.
  await page.route(
    '**/api/v1/ops/evaluations/' + item.id,
    (route) => route.abort('failed'),
    { times: 1 },
  );
  await keyboardActivate(page, row);
  await expect(region.getByRole('alert')).toBeVisible();
  await expect(
    region.getByRole('heading', {
      name: 'Exact public view payloads',
      exact: true,
    }),
  ).toHaveCount(0);
  await keyboardActivate(page, inspect);
  await expect(region.getByRole('alert')).toHaveCount(0);
  const view = region.locator('details').filter({ hasText: item.title });
  await expect(view).toHaveCount(1);
  await keyboardActivate(page, view.locator('summary'));
  await expect(view).toHaveAttribute('open', '');
  await expect(view.locator('pre')).toContainText(item.title);
  const linked = region.locator('details').filter({ hasText: feedbackId });
  await keyboardActivate(page, linked.locator('summary'));
  await expect(linked).toHaveAttribute('open', '');
  await expect(linked).toContainText(feedbackText);
  await expect(region).toContainText(
    'client-supplied observations, not proof of rendering',
  );
  await contained(region);
  await testInfo.attach('evaluation-inspector-synthetic-keyboard', {
    body: await region.screenshot(),
    contentType: 'image/png',
  });
  const exportButton = region.getByRole('button', {
    name: 'Download current evaluation JSON',
    exact: true,
  });
  const exportEvent = page.waitForEvent('download');
  await keyboardActivate(page, exportButton);
  const download = await exportEvent;
  expect(download.suggestedFilename()).toBe('research-evaluation.json');
  const exported = EvalDetailSchema.parse(await downloadedJson(download));
  expect(exported.sourceId).toBe(item.id);
  expect(exported.current).toBe(true);
  expect(exported.views.map((v) => v.payload)).toContainEqual(item);
  expect(
    exported.feedback.some(
      (v) => v.id === feedbackId && v.text === feedbackText,
    ),
  ).toBe(true);
  expect(exported).not.toHaveProperty('privateAiHistory');
  const evidenceEvent = page.waitForEvent('download');
  await keyboardActivate(
    page,
    region.getByRole('button', {
      name: 'Download retained source evidence',
      exact: true,
    }),
  );
  const evidenceDownload = await evidenceEvent;
  expect(evidenceDownload.suggestedFilename()).toBe('source-evidence.json');
  expect(await downloadedJson(evidenceDownload)).toMatchObject({
    available: true,
    records: [{ hash: fixture.hash, body: fixture.body }],
  });
  await page.route('**/api/v1/discovery/items/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await keyboardActivate(
    page,
    region.getByRole('link', { name: 'Open source reading', exact: true }),
  );
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Research evaluation');
  await filter.fill(item.id);
  await keyboardActivate(page, inspect);
  await expect(exportButton).toBeVisible();
  await withdrawReview(request, fixture.first, 'withdrawn');
  // Export re-reads current admission instead of leaking the already displayed view.
  const withdrawnEvent = page.waitForEvent('download');
  await keyboardActivate(page, exportButton);
  const withdrawn = EvalDetailSchema.parse(
    await downloadedJson(await withdrawnEvent),
  );
  expect(withdrawn.current).toBe(false);
  expect(withdrawn.views).toEqual([]);
  expect(withdrawn.feedback).toEqual([]);
  await expect(region).toContainText('Retained content is withheld.');
  await expect(region).not.toContainText(item.title);
  await expect(region).not.toContainText(feedbackText);
  const unavailableEvent = page.waitForEvent('download');
  await keyboardActivate(
    page,
    region.getByRole('button', {
      name: 'Download retained source evidence',
      exact: true,
    }),
  );
  expect(await downloadedJson(await unavailableEvent)).toEqual({
    available: false,
    records: [],
  });
});

test('E2E-WEB-1119 real response captures paginate exact source editions without duplicate or sibling leakage @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(120000);
  const fixture = await withdrawalFixture(request, feedbackSandbox);
  let current = fixture.first;
  const versions: number[] = [];
  // Explicit synthetic revisions in the owned schema; every evaluation capture
  // is created by an actual public-reader GET, never an inserted evaluation row.
  for (let index = 0; index < 51; index++) {
    if (index)
      current = await reviseConnectionSourceFixture(
        feedbackSandbox,
        current,
        'published',
      );
    const response = await request.get('/api/v1/discovery/items/' + current.id);
    expect(response.status()).toBe(200);
    const returned = FeedItemSchema.parse(await response.json());
    expect(returned.version).toBe(current.version);
    versions.push(returned.version);
  }
  expect(
    (
      await request.get('/api/v1/discovery/items/' + fixture.sibling.id)
    ).status(),
  ).toBe(200);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Research evaluation');
  const region = page.getByRole('region', {
    name: 'Research evaluation',
    exact: true,
  });
  const filter = region.getByLabel('Source item ID', { exact: true });
  const find = region.getByRole('button', {
    name: 'Find evaluation records',
    exact: true,
  });
  await filter.fill(current.id);
  const firstResponse = page.waitForResponse((r) => {
    const u = new URL(r.url());
    return (
      u.pathname === '/api/v1/ops/evaluations' &&
      u.searchParams.get('sourceId') === current.id &&
      !u.searchParams.has('before')
    );
  });
  await keyboardActivate(page, find);
  const firstHttp = await firstResponse;
  expect(firstHttp.status()).toBe(200);
  const first = EvalListSchema.parse(await firstHttp.json());
  expect(first.items).toHaveLength(50);
  expect(first.nextBefore).not.toBeNull();
  await expect(region.getByRole('listitem')).toHaveCount(50);
  const older = region.getByRole('button', {
    name: 'Older captures',
    exact: true,
  });
  const nextResponse = page.waitForResponse((r) => {
    const u = new URL(r.url());
    return (
      u.pathname === '/api/v1/ops/evaluations' &&
      u.searchParams.get('sourceId') === current.id &&
      u.searchParams.get('before') === first.nextBefore
    );
  });
  await keyboardActivate(page, older);
  const nextHttp = await nextResponse;
  expect(nextHttp.status()).toBe(200);
  const next = EvalListSchema.parse(await nextHttp.json());
  expect(next.items).toHaveLength(1);
  expect(next.nextBefore).toBeNull();
  const all = [...first.items, ...next.items];
  expect(all.every((v) => v.sourceId === current.id)).toBe(true);
  expect(all.map((v) => v.sourceVersion).sort((a, b) => a - b)).toEqual(
    versions,
  );
  await expect(region.getByRole('listitem')).toHaveCount(1);
  await expect(older).toHaveCount(0);
  await contained(region);
  await testInfo.attach('evaluation-last-page-synthetic', {
    body: await region.screenshot(),
    contentType: 'image/png',
  });
  await filter.fill(fixture.sibling.id);
  await keyboardActivate(page, find);
  await expect(region.getByRole('listitem')).toHaveCount(1);
  await expect(region.getByRole('listitem')).toContainText(fixture.sibling.id);
  await expect(region.getByRole('listitem')).not.toContainText(current.id);
  await filter.fill(current.id);
  await keyboardActivate(page, find);
  await expect(region.getByRole('listitem')).toHaveCount(50);
  await expect(older).toBeVisible();
});
