import { test, expect } from '../../helpers/app-fixture';
import { gdpOriginalFixture } from '../../helpers/bea-gdp-original';
test('E2E-WEB-1480 actual reviewed GDP vintages expose original and captured times with keyboard detail and retry @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  await gdpOriginalFixture(request, feedbackSandbox);
  await page.route('**/api/v1/discovery/gdp-vintages*', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#research-calendar');
  const region = page.getByRole('region', {
    name: 'Original GDP vintages',
    exact: true,
  });
  await expect(region).toContainText('2025-Q2 · third estimate · 3.8%');
  const summary = region
    .locator('summary')
    .filter({ hasText: '2025-Q2 · second estimate' });
  await summary.focus();
  await summary.press('Enter');
  const detail = summary.locator('..');
  await expect(detail).toContainText('Original publication');
  await expect(detail).toContainText('Retrieved by this app');
  await expect(
    detail.getByRole('link', { name: 'Read original BEA release' }),
  ).toHaveAttribute(
    'href',
    /\/news\/2025\/gross-domestic-product-2nd-quarter-2025-second-estimate/,
  );
  // Keep the fault active for every mount request until the visible error is
  // asserted; an aborted development StrictMode request must not consume it.
  const failVintages = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic vintage storage failure' }),
    });
  await page.route('**/api/v1/discovery/gdp-vintages*', failVintages);
  await page.reload();
  await expect(region.getByRole('alert')).toContainText(
    'Synthetic vintage storage failure',
  );
  await page.unroute('**/api/v1/discovery/gdp-vintages*', failVintages);
  await region.getByRole('button', { name: 'Retry GDP vintages' }).click();
  await expect(region).toContainText('2026-Q2 · second estimate · 1.5%');
});
