import { test, expect } from '@playwright/test';

test.describe('Foundation browser @SETUP-001 @SDLC-001 @smoke', () => {
  test('E2E-WEB-001 web connects to the real API', async ({ page }) => {
    await test.step('Load the starter and observe its real API result', async () => {
      await page.goto('/#brief');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Understand the market.',
      );
      await expect(
        page.getByRole('contentinfo').getByRole('status'),
      ).toHaveText('Connected');
    });
    await test.step('Show the honest synthetic workspace scope', async () => {
      await expect(
        page.getByText('no live market data or investment recommendations.', {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('region', { name: 'Learning journey' })
          .getByRole('article'),
      ).toHaveCount(3);
    });
  });

  test('E2E-WEB-002 API failure is visible @simulated', async ({ page }) => {
    await test.step('Simulate an unavailable health response without stopping real services', async () => {
      await page.route('**/api/v1/health', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"status":"unavailable"}',
        }),
      );
      await page.goto('/#brief');
      await expect(
        page.getByRole('contentinfo').getByRole('status'),
      ).toHaveText('Connection unavailable');
    });
  });

  test('E2E-WEB-003 malformed API data cannot appear connected @simulated', async ({
    page,
  }) => {
    await page.route('**/api/v1/health', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"status":"ok","service":"fingent360-api","timestamp":"invalid"}',
      }),
    );
    await page.goto('/#brief');
    await expect(page.getByRole('contentinfo').getByRole('status')).toHaveText(
      'Connection unavailable',
    );
  });

  test('E2E-WEB-004 layout fits and brand works by keyboard', async ({
    page,
  }) => {
    await page.goto('/#brief');
    await test.step('No horizontal page overflow at the selected project viewport', async () => {
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    });
    await test.step('Keyboard users can reach and activate the home link', async () => {
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('link', { name: 'Skip to content', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
      await page
        .getByRole('link', { name: 'fingent360', exact: true })
        .filter({ visible: true })
        .focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#today$/);
    });
  });
});
