import { test, expect } from '../../helpers/app-fixture';
import type { Page } from '@playwright/test';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
import { openAuthDatabase } from '../../helpers/auth-wait';
import { CurrentAccountSchema } from '../../../../packages/contracts/src/index';
import {
  browserComparisonCall,
  changeComparisonRecords,
  comparisonRoute,
  escapedComparisonLabel,
  issueComparisonReport,
  holdComparisonResponse,
  waitComparisonHeld,
  releaseComparisonResponse,
} from '../../helpers/report-comparison';
async function setup(page: Page) {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const call = browserComparisonCall(page),
    a = await issueComparisonReport(call);
  await changeComparisonRecords(call);
  const b = await issueComparisonReport(call, escapedComparisonLabel);
  return { a, b, call };
}
async function choose(page: Page, a: string, b: string) {
  await page.getByLabel('First report', { exact: true }).selectOption(a);
  await page.getByLabel('Second report', { exact: true }).selectOption(b);
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
}
const result = (page: Page) =>
  page.getByRole('region', { name: 'Issued report comparison', exact: true });

test('E2E-WEB-420 keyboard selection date review reverse order exact values original Back reload and mobile layout @REPORT-COMPARE-001', async ({
  page,
}) => {
  const { a, b } = await setup(page);
  await page.goto('/#reports');
  const entry = page.getByRole('link', {
    name: 'Compare issued reports',
    exact: true,
  });
  await entry.focus();
  await page.keyboard.press('Enter');
  await choose(page, b.id, a.id);
  const review = page.getByRole('region', {
    name: 'Review selected reports',
    exact: true,
  });
  await expect(review).toContainText(a.snapshot.capturedAt);
  await expect(review).toContainText(b.snapshot.capturedAt);
  await review
    .getByRole('button', { name: 'Cancel comparison', exact: true })
    .click();
  await expect(review).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Compare captured records', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(result(page)).toContainText('INR −0.01');
  await expect(result(page)).toContainText('+0.000001');
  await expect(result(page)).toContainText('INR +2.46');
  await expect(result(page)).toContainText(escapedComparisonLabel);
  await expect(result(page).locator('img')).toHaveCount(0);
  await expect(
    result(page).getByRole('heading', {
      name: 'Changes between captured records',
    }),
  ).toBeFocused();
  const earlier = result(page).getByRole('link', {
    name: 'Open earlier original',
    exact: true,
  });
  await expect(earlier).toHaveAttribute('href', `#reports?selected=${a.id}`);
  await earlier.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toContainText(a.label);
  await page.keyboard.press('Escape');
  await page.goBack();
  await expect(result(page)).toContainText(escapedComparisonLabel);
  await page.reload();
  await expect(result(page)).toContainText('INR −0.01');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Second report', { exact: true }).focus();
  await expect(page.getByLabel('Second report', { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('issued-report-comparison.png'),
    fullPage: true,
  });
});

test('E2E-WEB-421 empty one-report unavailable first load and unreadable comparison recover through explicit retry @REPORT-COMPARE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const call = browserComparisonCall(page);
  await page.goto('/#report-compare');
  await expect(
    page
      .getByRole('region', { name: 'Compare issued reports', exact: true })
      .getByRole('status'),
  ).toContainText('No issued reports yet');
  const a = await issueComparisonReport(call);
  await page
    .getByRole('button', { name: 'Refresh comparison', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Compare issued reports', exact: true })
      .getByRole('status'),
  ).toContainText('One issued report');
  const b = await issueComparisonReport(call, 'Second original');
  let failOptions = true,
    failCompare = true;
  await page.route('**/api/v1/account/report-comparison/options', (route) =>
    failOptions
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic choices outage.' }),
        })
      : route.fallback(),
  );
  await page.route('**/api/v1/account/report-comparison?*', (route) =>
    failCompare
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ unreadable: true }),
        })
      : route.fallback(),
  );
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(
    page.getByRole('alert').filter({ hasText: 'Synthetic choices outage' }),
  ).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  failOptions = false;
  failCompare = false;
  await page
    .getByRole('button', { name: 'Retry report choices', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Retry comparison', exact: true })
    .click();
  await expect(result(page)).toContainText('Second original');
  await page.getByLabel('Second report', { exact: true }).selectOption(a.id);
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Choose two different');
  await expect(
    page.getByRole('button', { name: 'Review comparison', exact: true }),
  ).toBeDisabled();
});

test('E2E-WEB-422 deleting an actual original clears comparison on refresh and remembered links never select another report @REPORT-COMPARE-001', async ({
  page,
}) => {
  const { a, b, call } = await setup(page);
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(result(page)).toBeVisible();
  expect(
    (
      await call(`/api/v1/account/reports/${b.id}`, 'DELETE', {
        expectedVersion: b.version,
        confirm: true,
      })
    ).status,
  ).toBe(200);
  await page
    .getByRole('button', { name: 'Refresh comparison', exact: true })
    .click();
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await page.reload();
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await page.goto(`/#reports?selected=${b.id}`);
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Record reports', exact: true }),
  ).toContainText('The linked report is unavailable');
});

test('E2E-WEB-423 changed selection and route reject a held older successful comparison @REPORT-COMPARE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const { a, b, call } = await setup(page);
  const c = await issueComparisonReport(call, 'Third selected original');
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(result(page)).toBeVisible();
  // Pause an active explicit read after the route's development effects settle.
  await holdComparisonResponse(page);
  try {
    await page
      .getByRole('button', { name: 'Refresh comparison', exact: true })
      .click();
    await waitComparisonHeld(page);
    await expect(page.getByText('Reading both owned originals…')).toBeVisible();
    await choose(page, a.id, c.id);
    await page
      .getByRole('button', { name: 'Compare captured records', exact: true })
      .click();
    await expect(result(page)).toContainText('Third selected original');
    await releaseComparisonResponse(page);
    await expect(result(page)).toContainText('Third selected original');
    await expect(result(page)).not.toContainText(escapedComparisonLabel);
  } finally {
    await releaseComparisonResponse(page);
  }
});

test('E2E-WEB-424 actual401 immediately clears private result and choices despite earlier held success @REPORT-COMPARE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const { a, b, call } = await setup(page),
    owner = CurrentAccountSchema.parse(
      (await call('/api/v1/account')).body,
    ).user!,
    db = await openAuthDatabase(feedbackSandbox);
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(result(page)).toBeVisible();
  await holdComparisonResponse(page);
  try {
    await page
      .getByRole('button', { name: 'Refresh comparison', exact: true })
      .click();
    await waitComparisonHeld(page);
    await db.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [owner.id],
    );
    await page
      .getByRole('button', { name: 'Refresh comparison', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Sign in to compare issued reports',
        exact: true,
      }),
    ).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    await expect(
      page.getByText(escapedComparisonLabel, { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByLabel('First report', { exact: true })).toHaveCount(
      0,
    );
    await releaseComparisonResponse(page);
    await expect(result(page)).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: 'Sign in to compare issued reports',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await releaseComparisonResponse(page);
    await db.close();
  }
});

test('E2E-WEB-425 foreign comparison and original deep link clear an existing selection without fallback @REPORT-COMPARE-001', async ({
  page,
  request,
}) => {
  const { a, b } = await setup(page);
  // The request fixture has its own cookie jar on this same isolated API.
  const { prepareConnectionAccount } =
    await import('../../helpers/research-connection-fixture');
  const { apiComparisonCall } = await import('../../helpers/report-comparison');
  await prepareConnectionAccount(request);
  const foreign = await issueComparisonReport(
    apiComparisonCall(request),
    'Foreign synthetic original',
  );
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(result(page)).toBeVisible();
  await page.evaluate((route) => {
    window.location.hash = route;
  }, `report-compare?first=${a.id}&second=${foreign.id}`);
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await expect(
    page.getByText('Foreign synthetic original', { exact: false }),
  ).toHaveCount(0);
  await page.goto(`/#reports?selected=${a.id}`);
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toHaveCount(0);
  await page.evaluate((id) => {
    window.location.hash = `reports?selected=${id}`;
  }, foreign.id);
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Record reports', exact: true }),
  ).toContainText('The linked report is unavailable');
  await expect(
    page.getByText('Foreign synthetic original', { exact: false }),
  ).toHaveCount(0);
});
