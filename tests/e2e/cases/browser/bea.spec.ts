import { test, expect } from '../../helpers/app-fixture';
import { setupBea, reviewBea, beaBrowserCall } from '../../helpers/bea-fixture';
import {
  routeConnectionReading,
  prepareConnectionBrowser,
  connectionGoal,
} from '../../helpers/research-connection-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  FeedItemSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-320 captured BEA release source Scan Stories reader evidence learning context and keyboard Back @BEA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/#explore?source=bea&region=global');
  await expect(page.getByLabel('Research source', { exact: true })).toHaveValue(
    'bea',
  );
  await expect(page.locator('a.headline-link')).toHaveCount(1);
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  const story = page.getByRole('region', { name: 'Reading story' });
  await expect(story.getByRole('heading')).toHaveText(source.title);
  const link = story.getByRole('link', { name: 'Read the story' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/BEA headline only\. Open the original release/),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('bea-reader.png') });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const context = page.getByRole('region', { name: 'Reading context' });
  await expect(context).toBeVisible();
  const learning = context.getByRole('link', { name: /^Try:/ }).first();
  await expect(learning).toBeVisible();
  await learning.click();
  await expect(page).toHaveURL(/#learning\?question=/);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Original source/ }),
  ).toHaveAttribute('href', source.source.url);
  await page
    .getByRole('button', { name: 'Stored evidence', exact: true })
    .click();
  const evidence = page.getByRole('dialog', { name: 'Stored source evidence' });
  await expect(
    evidence.getByText(/Selected release metadata only/),
  ).toBeVisible();
  await evidence
    .getByText('Advanced: permitted metadata excerpt', { exact: true })
    .click();
  await expect(evidence.locator('pre')).toContainText('<title>');
  await expect(evidence.locator('pre')).not.toContainText('<description>');
  await expect(evidence).toContainText(source.sourceHash!);
  await page.keyboard.press('Escape');
  await expect(evidence).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Stored evidence', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Version history' }),
  ).toContainText(source.title);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/source=bea&region=global&mode=stories/);
  await expect(story.getByRole('heading')).toHaveText(source.title);
  await page.reload();
  await expect(page.getByLabel('Research source', { exact: true })).toHaveValue(
    'bea',
  );
});

test('E2E-WEB-321 actual BEA draft review publishes and withdraws through Operations with source status @BEA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox, false);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  const panel = page.getByRole('region', { name: 'Source refresh' });
  const checkbox = panel.getByRole('checkbox', {
    name: 'U.S. Bureau of Economic Analysis',
    exact: true,
  });
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await expect(
    panel.getByRole('button', {
      name: 'Refresh discovery sources',
      exact: true,
    }),
  ).toBeEnabled();
  await expect(panel.getByText(/headlines only/)).toBeVisible();
  await page
    .getByRole('button', { name: `Review ${source.title}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review publication' });
  await dialog
    .getByLabel('Review note')
    .fill('Review of captured first-party BEA headline only.');
  await dialog
    .getByRole('button', { name: 'Publish reviewed edition' })
    .click();
  await expect(dialog.getByRole('status')).toContainText(
    'Saved published edition',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const published = FeedItemSchema.parse(
    (await beaBrowserCall(page, `/api/v1/discovery/items/${source.id}`)).body,
  );
  expect(published.status).toBe('published');
  await page
    .getByRole('button', { name: `Review ${source.title}`, exact: true })
    .click();
  await dialog
    .getByLabel('Review note')
    .fill(
      'Synthetic withdrawal acceptance; retain original evidence internally.',
    );
  await dialog.getByRole('button', { name: 'Withdraw item' }).click();
  await expect(dialog.getByRole('status')).toContainText(
    'Saved withdrawn edition',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.goto(`/#read/${source.id}`);
  await expect(
    page.getByRole('heading', { name: 'Withdrawn BEA release', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Stored evidence', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Connect to my records', exact: true }),
  ).toHaveCount(0);
});

test('E2E-WEB-322 BEA empty filters and simulated failed evidence/feed reads recover to actual owned API data @BEA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  let fail = true;
  await page.route(/\/api\/v1\/discovery\/feed(?:\?|$)/, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic BEA read interruption.' }),
        })
      : route.fallback(),
  );
  await page.goto('/#explore?source=bea');
  await expect(page.getByRole('alert').first()).toBeVisible();
  fail = false;
  await page
    .getByRole('button', { name: 'Refresh reading', exact: true })
    .click();
  await expect(page.locator('a.headline-link')).toHaveCount(1);
  await page
    .getByRole('searchbox', { name: 'Search topics and reading' })
    .fill('no-BEA-release-matches-zzzz');
  await expect(
    page.getByText('No published items match those filters.', { exact: true }),
  ).toBeVisible();
  await page.goto(`/#read/${source.id}`);
  let broken = true;
  await page.route(
    `**/api/v1/discovery/items/${source.id}/evidence`,
    (route) =>
      broken
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Synthetic evidence interruption.',
            }),
          })
        : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Stored evidence', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Stored source evidence' });
  await expect(dialog.getByRole('alert')).toBeVisible();
  broken = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    dialog.getByText(/Selected release metadata only/),
  ).toBeVisible();
});

test('E2E-WEB-323 BEA reader saves actual owned goal connection through reason consent review and reload @BEA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const before = PrivacyExportSchema.parse(
    (await beaBrowserCall(page, '/api/v1/account/privacy/export')).body,
  );
  await page.goto(`/#read/${source.id}`);
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
    .fill('I want to read the BEA source alongside my own goal.');
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
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(connectionGoal.name);
  const after = PrivacyExportSchema.parse(
    (await beaBrowserCall(page, '/api/v1/account/privacy/export')).body,
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.researchConnections.revisions[0]!.source.itemId).toBe(source.id);
});

test('E2E-WEB-324 withdrawn BEA history never reopens old public headlines after reload @BEA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await reviewBea(request, source, 'withdrawn');
  await page.goto(`/#read/${source.id}`);
  await expect(
    page.getByRole('heading', { name: 'Withdrawn BEA release', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  const history = page.getByRole('dialog', { name: 'Version history' });
  await expect(history).toContainText('Withdrawn BEA release');
  await expect(history).not.toContainText(source.title);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('link', { name: /Original source/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('link', { name: 'Connect to my records', exact: true }),
  ).toHaveCount(0);
});
