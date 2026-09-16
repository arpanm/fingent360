import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1360 downloaded classifications admit actual source snapshots and refuse offline review @SRC-006', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const statuses = await page.evaluate(async () => {
    const r = await fetch('/api/v1/classifications/INE002A01018'),
      o = await fetch('/api/v1/ops/classification-crosswalks');
    return { status: r.status, data: await r.json(), ops: o.status };
  });
  expect(statuses.status).toBe(200);
  expect(Array.isArray(statuses.data.mappings)).toBe(true);
  expect(statuses.ops).toBe(503);
  expect(network).toEqual([]);
});
