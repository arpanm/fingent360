import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-380 worker health explains connected requirement with keyboard Back and zero API traffic @WORKER-HEALTH-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.method());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const before = await page.evaluate(async () => {
    const registered = await fetch('/api/v1/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `localworker_${Date.now()}`,
        password: 'Synthetic-worker-local-password',
        consent: true,
      }),
    });
    if (!registered.ok) throw Error('Local worker fixture account failed.');
    const saved = await fetch('/api/v1/account/watchlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indicators: ['NY.GDP.MKTP.KD.ZG'] }),
    });
    if (!saved.ok) throw Error('Local worker fixture watchlist failed.');
    return saved.json();
  });
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Worker health and pause/resume control connected server', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Confirm pause|Confirm resume|Reload worker health/,
    }),
  ).toHaveCount(0);
  for (const [path, method, body] of [
    ['/api/v1/ops/workers', 'GET', undefined],
    ['/api/v1/ops/workers/reports/history', 'GET', undefined],
    [
      '/api/v1/ops/workers/reports/control',
      'POST',
      {
        requestId: crypto.randomUUID(),
        expectedVersion: 1,
        paused: true,
        confirm: true,
      },
    ],
  ] as const) {
    const result = await page.evaluate(
      async ({ path, method, body }) => {
        const response = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
      },
      { path, method, body },
    );
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).toContain(
      'requires a connected server',
    );
  }
  expect(
    await page.evaluate(async () =>
      (await fetch('/api/v1/account/watchlist')).json(),
    ),
  ).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 });
  const settings = page.getByRole('link', {
    name: 'Open App settings',
    exact: true,
  });
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#app-settings$/);
  await page.goto('/#ops');
  await page
    .getByRole('link', { name: 'Back to reading', exact: true })
    .click();
  await expect(page).toHaveURL(/#today$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(network).toEqual([]);
});
