import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1290 governance mutations require connected independent reviewers without network writes @DEV-015', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  for (const path of [
    '/ops/research-governance',
    '/ops/research-governance/00000000-0000-4000-8000-000000000001/reviews',
  ]) {
    const result = await page.evaluate(async (path) => {
      const response = await fetch('/api/v1' + path, {
        method: path.endsWith('reviews') ? 'POST' : 'GET',
      });
      return { status: response.status, text: await response.text() };
    }, path);
    expect(result.status).toBe(503);
    expect(result.text).toContain('connected');
  }
  expect(network).toEqual([]);
});
