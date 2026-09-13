import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-020 real macro ingestion, contextual evidence and Back restoration @DATA-001 @external @UX-002', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Macro ingestion', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Refresh India GDP growth', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'India GDP growth: succeeded' }),
  ).toBeVisible({ timeout: 65000 });
  await page.goto('/#macro');
  await expect(page.getByLabel('Operator key', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Refresh India/ })).toHaveCount(
    0,
  );
  const card = page.getByRole('article', {
    name: 'India GDP growth',
    exact: true,
  });
  await card.getByText(/Annual observations and provenance/).click();
  const row = card.locator('.observation-row').nth(1);
  const historyLink = row.getByRole('link', { name: /History / });
  const title = await historyLink.innerText();
  await historyLink.scrollIntoViewIfNeeded();
  const originalScroll = await page.evaluate(() => window.scrollY);
  await historyLink.click();
  await expect(
    page.getByRole('region', { name: 'Observation history' }),
  ).toContainText('Provider dataset updated');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    `India GDP growth · ${title.match(/\d{4}/)![0]}`,
  );
  const bounds = await page.getByRole('heading', { level: 1 }).boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeLessThan(400);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#macro$/);
  await expect(card.locator('details')).toHaveAttribute('open', '');
  await expect(historyLink).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(originalScroll, 0);
  const sourceLink = row.getByRole('link', { name: /Source \d/ });
  await sourceLink.click();
  await expect(
    page.getByRole('region', { name: 'Original source record' }),
  ).toContainText('World Bank Open Data');
  await page.getByText('Advanced evidence', { exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Original source record' }),
  ).toContainText('SHA-256');
  await page.goBack();
  await expect(page).toHaveURL(/#macro$/);
  await expect(card.locator('details')).toHaveAttribute('open', '');
  await expect(sourceLink).toBeFocused();
  await sourceLink.click();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Source evidence' }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});
