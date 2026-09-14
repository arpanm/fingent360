import { test, expect } from '../../helpers/app-fixture';
import {
  withdrawalFixture,
  withdrawReview,
  withdrawalMedia,
} from '../../helpers/withdrawal-fixture';
import {
  prepareConnectionBrowser,
  routeConnectionReading,
} from '../../helpers/research-connection-fixture';
import { beaBrowserCall as call } from '../../helpers/bea-fixture';
import { operatorKey } from '../../helpers/operator';
import { learningReferences } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-370 published source refresh becomes a dated tombstone with safe keyboard history @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await withdrawalMedia(request, feedbackSandbox, first);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto(`/#read/${first.id}`);
  await expect(
    page.getByRole('heading', { name: first.title, exact: true }),
  ).toBeVisible();
  expect(await page.locator('h1 script').count()).toBe(0);
  await expect(
    page.getByRole('region', { name: 'Reviewed visual summary' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Stored evidence', exact: true })
    .click();
  const evidence = page.getByRole('dialog', { name: 'Stored source evidence' });
  await expect(evidence).toContainText('Selected published edition only');
  await expect(evidence).toContainText('not these excerpt bytes');
  await page.keyboard.press('Escape');
  await withdrawReview(request, first, 'withdrawn');
  const refresh = page.getByRole('button', {
    name: 'Refresh reading',
    exact: true,
  });
  await refresh.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Withdrawn source item', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Original source/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Stored evidence', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Reviewed visual summary' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Connect to my records' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  const history = page.getByRole('dialog', { name: 'Version history' });
  await expect(history).not.toContainText(first.title);
  await expect(history).not.toContainText(first.summary);
  await expect(history).toContainText('Version');
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('heading', { name: 'Withdrawn source item', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('withdrawn-reader.png'),
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(`#read/${first.id}`));
});
test('E2E-WEB-371 old successful history response cannot restore text after current withdrawal refresh @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto(`/#read/${first.id}`);
  await expect(
    page.getByRole('heading', { name: first.title, exact: true }),
  ).toBeVisible();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    started = new Promise<void>((r) => (entered = r));
  let once = true;
  await page.route(
    `**/api/v1/discovery/items/${first.id}/history`,
    async (route) => {
      if (!once) {
        await route.fallback();
        return;
      }
      once = false;
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}/api/v1/discovery/items/${first.id}/history`,
      });
      const body = await response.body();
      entered();
      await gate;
      await route
        .fulfill({ status: 200, contentType: 'application/json', body })
        .catch(() => {});
    },
  );
  try {
    await page
      .getByRole('button', { name: 'Version history', exact: true })
      .click();
    await started;
    await page.keyboard.press('Escape');
    await withdrawReview(request, first, 'withdrawn');
    await page
      .getByRole('button', { name: 'Refresh reading', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Withdrawn source item' }),
    ).toBeVisible();
    release();
    await page
      .getByRole('button', { name: 'Version history', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Version history' }),
    ).not.toContainText(first.title);
    await expect(page.getByRole('dialog')).toContainText(
      'unavailable for public reading',
    );
  } finally {
    release?.();
  }
});
test('E2E-WEB-372 Saved projects withdrawn source text while keeping remove and cancel controls @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  expect(
    (
      await call(
        page,
        `/api/v1/account/library/items/${first.id}/save`,
        'PUT',
        { version: first.version },
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await call(page, '/api/v1/account/library/reminders', 'POST', {
        itemId: first.id,
        dueAt: new Date(Date.now() + 3600000).toISOString(),
        timeZone: 'Asia/Kolkata',
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
  ).toBe(201);
  await page.goto('/#saved');
  await expect(
    page.getByRole('region', { name: 'Saved reading' }),
  ).toContainText(first.title);
  await withdrawReview(request, first, 'withdrawn');
  await page
    .getByRole('button', { name: 'Refresh library', exact: true })
    .click();
  const saved = page.getByRole('region', { name: 'Saved reading' });
  await expect(saved).not.toContainText(first.title);
  await expect(saved).not.toContainText(first.summary);
  await expect(
    saved.getByRole('link', { name: 'View source status' }),
  ).toBeVisible();
  await expect(
    saved.getByRole('button', { name: 'Remind me', exact: true }),
  ).toBeDisabled();
  await saved.getByRole('button', { name: 'Remove saved item' }).click();
  await expect(saved).toContainText('Something worth returning to?');
  await page.getByRole('button', { name: 'Reminders', exact: true }).click();
  const reminders = page.getByRole('region', { name: 'Reminder settings' });
  await expect(reminders).not.toContainText(first.title);
  await reminders
    .getByRole('button', { name: 'Cancel reminder', exact: true })
    .click();
  await expect(reminders).toContainText('cancelled');
});
test('E2E-WEB-373 protected retained evidence remains inspectable and escaped after public withdrawal @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await withdrawReview(request, first, 'withdrawn');
  await page.goto('/');
  expect(
    (
      await call(page, '/api/v1/ops/session', 'POST', {
        key: await operatorKey(),
      })
    ).status,
  ).toBe(200);
  await page.goto('/#ops');
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: first.title, exact: true }),
  });
  await card
    .getByRole('button', { name: 'Retained history', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Retained publication history' }),
  ).toContainText(first.title);
  await page.keyboard.press('Escape');
  await card
    .getByRole('button', { name: 'Retained evidence', exact: true })
    .click();
  const raw = page.getByRole('dialog', { name: 'Protected original evidence' });
  await expect(raw).toContainText(first.title);
  expect(await raw.locator('script').count()).toBe(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sign out of operations' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: first.title, exact: true }),
  ).toHaveCount(0);
});
test('E2E-WEB-374 learning and related research omit withdrawn items and recover from current read failure @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { first, sibling } = await withdrawalFixture(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto(`/#read/${sibling.id}`);
  await expect(
    page.getByRole('region', { name: 'Reading context' }),
  ).toContainText(first.title);
  await withdrawReview(request, first, 'withdrawn');
  await page
    .getByRole('button', { name: 'Refresh reading', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading context' }),
  ).not.toContainText(first.title);
  const question = Object.entries(learningReferences).find(
    ([, v]) => v.topic === 'Inflation',
  )?.[0];
  expect(question).toBeTruthy();
  await page.goto(`/#learning?question=${question}`);
  await expect(
    page.getByRole('link', { name: sibling.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: first.title, exact: true }),
  ).toHaveCount(0);
  await page.route(`**/api/v1/discovery/items/${sibling.id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Synthetic current reading outage"}',
    }),
  );
  await page.goto(`/#read/${sibling.id}`);
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic current reading outage',
  );
  await page.unroute(`**/api/v1/discovery/items/${sibling.id}`);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: sibling.title, exact: true }),
  ).toBeVisible();
});
