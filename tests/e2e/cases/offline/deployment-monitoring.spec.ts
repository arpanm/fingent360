import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1270 server monitoring stays unavailable on device without network writes @DEV-021', async ({
  page,
}) => {
  const api: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      api.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  for (const [path, method, body] of [
    ['', 'GET', undefined],
    [
      '/acknowledge',
      'POST',
      JSON.stringify({ id: '00000000-0000-4000-8000-000000000000' }),
    ],
    ['/retire-missing', 'POST', JSON.stringify({ confirm: true })],
  ] as const) {
    const response = await page.evaluate(
      async ({ path, method, body }) => {
        const r = await fetch(`/api/v1/ops/monitoring${path}`, {
          method,
          body: body ?? null,
          headers: { 'Content-Type': 'application/json' },
        });
        return { status: r.status, text: await r.text() };
      },
      { path, method, body },
    );
    expect(response.status).toBe(503);
    expect(response.text).toContain('requires a connected server');
  }
  expect(api).toEqual([]);
});
