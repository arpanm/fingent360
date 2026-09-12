import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
test.describe('Real macro browser @DATA-001 @external', () => {
  test.use({ trace: 'off', video: 'off', screenshot: 'off' });
  test('E2E-WEB-020 refresh real data, inspect evidence and reload', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'India macro dashboard' })).toBeVisible();
    await page.getByText('Source refresh controls', { exact: true }).click();
    await page.getByLabel('Operator key', { exact: true }).fill(await operatorKey());
    const card = page.getByRole('article', { name: 'India GDP growth', exact: true });
    await card.getByRole('button', { name: 'Refresh India GDP growth', exact: true }).click();
    await expect(card.getByText(/Latest refresh: succeeded/)).toBeVisible({ timeout: 60000 });
    await card.getByText(/Annual observations and provenance/).click();
    await card.getByRole('button', { name: /^History / }).first().click();
    await expect(page.getByRole('region', { name: 'Observation history' })).toContainText('Provider dataset updated:');
    await card.getByRole('button', { name: /^Source \d/ }).first().click();
    await expect(page.getByRole('region', { name: 'Source evidence' })).toContainText('SHA-256');
    await page.reload();
    await expect(page.getByRole('article', { name: 'India GDP growth', exact: true }).getByText(/Latest refresh: succeeded/)).toBeVisible();
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  });
});
