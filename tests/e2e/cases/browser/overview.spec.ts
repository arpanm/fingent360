import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('E2E-WEB-112 unavailable overview offers recovery without inventing an empty account @UX-001 @simulated', async ({
  page,
}) => {
  await page.route('**/api/v1/account/overview', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic temporary failure' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    'Your workspace could not be loaded',
  );
  await expect(
    page.getByRole('link', { name: 'Create your workspace', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Recorded acquisition cost', { exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/account/overview');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Create your workspace', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-110 create a workspace and see real saved goals and holdings on overview @UX-001', async ({
  page,
}) => {
  test.setTimeout(90000);
  const username = `overview_${randomUUID().slice(0, 12)}`;
  const password = 'Synthetic-overview-test-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A little context. A clearer plan.',
    }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Create your workspace', exact: true })
    .click();
  await expect(page).toHaveURL(/#account\?next=overview&mode=create$/);
  await expect(
    page.getByRole('button', { name: 'Create a new account', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  try {
    await expect(page).toHaveURL(/#overview$/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `Your overview, ${username}.`,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Workspace setup' }),
    ).toContainText('1 / 4');
    await page
      .getByRole('link', { name: 'Set your first goal', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic overview education');
    await page
      .getByLabel('Target amount (INR)', { exact: true })
      .fill('12000.01');
    await page
      .getByLabel('Already saved (INR)', { exact: true })
      .fill('2000.01');
    await page
      .getByLabel('Monthly contribution (INR)', { exact: true })
      .fill('500.00');
    await page.getByLabel('Months from this plan', { exact: true }).fill('20');
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Add saved goal', exact: true })
      .click();
    await expect(
      page.getByRole('article', { name: 'Goal Synthetic overview education' }),
    ).toBeVisible();
    await page.goto('/#overview');
    await expect(
      page.getByRole('region', { name: 'Your saved goals', exact: true }),
    ).toContainText('Synthetic overview education');
    await expect(
      page.getByRole('region', { name: 'Workspace setup' }),
    ).toContainText('2 / 4');
    await page
      .getByRole('region', { name: 'Workspace setup' })
      .getByRole('link', { name: 'Add the holdings you own', exact: true })
      .last()
      .click();
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE002A01018');
    await page.getByLabel('Quantity', { exact: true }).fill('2.000001');
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('12345.67');
    await page
      .getByRole('button', { name: 'Add to draft', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Draft holdings' }),
    ).toContainText('INE002A01018');
    await expect(
      page.getByRole('region', { name: 'Draft holdings' }),
    ).toContainText('12345.67');
    await page
      .getByRole('checkbox', { name: /I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Saved holdings' }),
    ).toContainText('12345.67');
    await page.goto('/#overview');
    const cost = page
      .getByRole('link')
      .filter({ hasText: 'Recorded acquisition cost' });
    await expect(cost).toContainText('₹12,345.67');
    await expect(cost).toContainText('1 holdings');
    await expect(
      page.getByRole('region', { name: 'Workspace setup' }),
    ).toContainText('3 / 4');
    await page.reload();
    await expect(cost).toContainText('₹12,345.67');
    await expect(
      page.getByRole('region', { name: 'Your saved goals', exact: true }),
    ).toContainText('Synthetic overview education');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-111 keyboard navigation, mobile menu and route recovery @UX-001', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Product areas' });
  const menu = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  if (isMobile) {
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(
      page.getByRole('button', { name: 'Close navigation', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
  }
  await expect(
    navigation.getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await navigation
    .getByRole('link', { name: 'Market context', exact: true })
    .click();
  await expect(page).toHaveURL(/#macro$/);
  await expect(page.getByRole('main')).toBeFocused();
  const heading = await page
    .getByRole('heading', { name: 'India macro dashboard', exact: true })
    .boundingBox();
  const bar = await page.locator('.topbar').boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  if (isMobile) await menu.click();
  await expect(
    navigation.getByRole('link', { name: 'Market context', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  if (isMobile) await page.keyboard.press('Escape');
  await page.goto('/');
  // A hash-only navigation focuses main; reload to test the initial tab order.
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  await page.goto('/#not-a-real-area');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'We couldn’t find that page.',
    }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Back to overview', exact: true })
    .click();
  await expect(page).toHaveURL(/#overview$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A little context. A clearer plan.',
    }),
  ).toBeVisible();
});
