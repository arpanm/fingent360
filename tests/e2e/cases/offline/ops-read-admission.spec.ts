import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-530 protected server reads remain unavailable without network @OPS-READ-ADMISSION-001', async ({
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
    page.getByRole('button', { name: 'Source registry', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Publishing', exact: true }),
  ).toHaveCount(0);
  expect(calls).toEqual([]);
});
