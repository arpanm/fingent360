import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-470 source review requires connected Operations without requests @SOURCE-REVIEW-DIFF-001', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) requests.push(r.url());
  });
  await page.goto('/#today');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', { name: 'Operations need a connected server' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Publish reviewed edition' }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});
