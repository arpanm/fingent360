import { expectUnobscuredControl } from '../../helpers/focus-visibility';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../helpers/event-fixture';
import { eventHeaders } from '../../helpers/event-fixture';
import { prepareLineage, saveLineage } from '../../helpers/event-lineage';

// Traverse the real tab order. Do not focus the target programmatically: that
// would hide an unreachable or trapped control from this keyboard regression.
async function keyboardActivate(
  page: Page,
  target: Locator,
  key: 'Enter' | 'Space' = 'Enter',
) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let step = 0; step < 120; step++) {
    if (await target.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  await expectUnobscuredControl(target);
  await page.keyboard.press(key);
}

async function captureReviewedLayout(
  page: Page,
  region: Locator,
  testInfo: TestInfo,
  name: string,
) {
  await expect(region).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const bounds = await region.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  // This test owns disposable synthetic identities and data. Capture only the
  // named workflow region, with every form value masked; never capture login.
  await testInfo.attach(name, {
    body: await region.screenshot({
      animations: 'disabled',
      mask: [region.locator('input, textarea')],
    }),
    contentType: 'image/png',
  });
}

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-830 guided merge review Back real application and replacement navigation @EVENT-LINEAGE-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}, testInfo) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const cookies = (await request.storageState()).cookies;
  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.goto('/#ops');
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Merge/split events', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Load current published event choices',
      exact: true,
    }),
  );
  await keyboardActivate(
    page,
    page.getByLabel('Synthetic original 0 · revision 2', { exact: true }),
    'Space',
  );
  await expect(
    page.getByLabel('Synthetic original 0 · revision 2', { exact: true }),
  ).toBeChecked();
  await keyboardActivate(
    page,
    page.getByLabel('Synthetic original 1 · revision 2', { exact: true }),
    'Space',
  );
  await expect(
    page.getByLabel('Synthetic original 1 · revision 2', { exact: true }),
  ).toBeChecked();
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Author replacement outputs',
      exact: true,
    }),
  );
  await page
    .getByLabel('Output 1 title', { exact: true })
    .fill('Synthetic UI consolidated context');
  await captureReviewedLayout(
    page,
    page.getByRole('region', {
      name: 'Merge or split reviewed events',
      exact: true,
    }),
    testInfo,
    'synthetic-lineage-output-editor',
  );
  await page
    .getByLabel('Public restructuring reason', { exact: true })
    .fill('Synthetic duplicate explanation reviewed through the UI.');
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Review lineage plan', exact: true }),
  );
  await expect(
    page.getByRole('button', {
      name: 'Save immutable lineage plan',
      exact: true,
    }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Back to output editing', exact: true }),
  );
  // Back restores focus directly, without the test repairing focus.
  await expect(
    page.getByLabel('Output 1 title', { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel('Output 1 title', { exact: true })).toHaveValue(
    'Synthetic UI consolidated context',
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Review lineage plan', exact: true }),
  );
  await expect(
    page.getByRole('button', {
      name: 'Save immutable lineage plan',
      exact: true,
    }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Save immutable lineage plan',
      exact: true,
    }),
  );
  await expect(
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Stored replacements', exact: true }),
  ).toContainText('Synthetic UI consolidated context');
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Load saved lineage plans', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: /^Open plan / }),
  );
  await expect(
    page.getByRole('region', { name: 'Stored originals', exact: true }),
  ).toContainText(fixture.source.title);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Apply reviewed lineage in bootstrap mode',
      exact: true,
    }),
  );
  await expect(page.getByText(/Applied merge at/)).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await captureReviewedLayout(
    page,
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
    testInfo,
    'synthetic-lineage-applied-narrow',
  );
  await page.goto('/#events/' + fixture.input.inputs[0]!.id);
  await keyboardActivate(
    page,
    page.getByRole('link', {
      name: 'Synthetic UI consolidated context',
      exact: true,
    }),
  );
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic UI consolidated context',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Reviewed original context',
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', {
      name: 'This event has reviewed replacements',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('E2E-WEB-831 actual revoked operator clears saved lineage inspection on the next protected read @EVENT-LINEAGE-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}, testInfo) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const plan = await saveLineage(request, fixture.input);
  const cookies = (await request.storageState()).cookies;
  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.goto('/#ops');
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Merge/split events', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Load saved lineage plans', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Open plan ' + plan.id, exact: true }),
  );
  await expect(
    page.getByRole('region', { name: 'Stored replacements', exact: true }),
  ).toContainText('Synthetic merged context');
  expect(
    (
      await request.delete('/api/v1/ops/session', { headers: eventHeaders })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  await captureReviewedLayout(
    page,
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
    testInfo,
    'synthetic-lineage-before-revocation-narrow',
  );
  const denial = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/ops/event-lineage/' + plan.id && response.status() === 401,
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Read application receipt', exact: true }),
  );
  await denial;
  await expect(page.getByLabel('Operator key', { exact: true })).toBeVisible();
  const credential = page.getByLabel('Operator key', { exact: true });
  for (let step = 0; step < 120; step++) {
    if (
      await credential.evaluate((element) => element === document.activeElement)
    )
      break;
    await page.keyboard.press('Tab');
  }
  await expect(credential).toBeFocused();
  await expect(
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Synthetic merged context', { exact: true }),
  ).toHaveCount(0);
});
