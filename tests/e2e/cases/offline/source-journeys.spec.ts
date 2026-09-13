import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-220 source coverage and filtered reading remain available without API network @SOURCES-002', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) network.push(r.url());
  });
  await page.goto('/#sources');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Our sources', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /Read published items/ })
    .first()
    .click();
  await expect(page).toHaveURL(/source=/);
  await expect(
    page.getByLabel('Research source', { exact: true }),
  ).not.toHaveValue('');
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page
    .getByRole('region', { name: 'Reading story' })
    .getByRole('link', { name: 'Read the story' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading context' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/source=.*mode=stories/);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Stories', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(network).toEqual([]);
});
