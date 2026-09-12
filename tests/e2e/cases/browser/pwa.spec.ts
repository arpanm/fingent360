import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'allow' });
test('E2E-WEB-100 neutral offline fallback never caches account or API responses @PWA-001', async ({
  page,
  context,
}) => {
  await page.goto('/#brief');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const onlineHealth = await page.evaluate(
    async () => (await fetch('/api/v1/health')).status,
  );
  expect(onlineHealth).toBe(200);
  const cachedPaths = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) =>
      name.startsWith('fingent360-offline-'),
    );
    const paths: string[] = [];
    for (const name of names)
      for (const key of await (await caches.open(name)).keys())
        paths.push(new URL(key.url).pathname);
    return paths.sort();
  });
  expect(cachedPaths).toEqual(['/icon.svg', '/offline.html']);
  await context.setOffline(true);
  try {
    const offlineApi = await page.evaluate(async () => {
      try {
        await fetch('/api/v1/health');
        return 'unexpected cached response';
      } catch {
        return 'network unavailable';
      }
    });
    expect(offlineApi).toBe('network unavailable');
    await page.goto('/?offline-acceptance=1#account');
    await expect(
      page.getByRole('heading', { name: 'You are offline' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'No saved account or market data is displayed on this offline page.',
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
  await page.getByRole('link', { name: 'Try connecting again' }).click();
  await expect(
    page.getByRole('heading', { name: 'You are offline' }),
  ).toHaveCount(0);
});
