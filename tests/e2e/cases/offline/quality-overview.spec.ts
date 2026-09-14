import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-630 quality diagnostics explain connection requirement without API traffic @QUALITY-OVERVIEW-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      traffic.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/ops/quality');
    return { status: response.status, body: await response.json() };
  });
  expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).toContain('require a connected server');
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  expect(traffic).toEqual([]);
});
