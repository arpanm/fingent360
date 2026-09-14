import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-510 retained response recovery is connected only @BEA-QUARANTINE-001', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) calls.push(r.url());
  });
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', { name: 'Operations need a connected server' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Revalidate stored response' }),
  ).toHaveCount(0);
  expect(calls).toEqual([]);
});
