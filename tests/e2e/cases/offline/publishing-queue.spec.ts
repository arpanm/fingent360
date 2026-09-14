import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-550 publishing queue remains connected-only with no API traffic or local record change @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const before = await page.evaluate(async () => {
    const headers = { 'Content-Type': 'application/json' };
    const account = await fetch('/api/v1/account/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: `queue_local_${Date.now()}`,
        password: 'Synthetic-local-queue-password',
        consent: true,
      }),
    });
    if (account.status !== 201)
      throw Error('Owned local account setup failed.');
    const goal = await fetch('/api/v1/account/goals', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Synthetic queue preservation goal',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '10001',
        monthlyMinor: '25002',
        horizonMonths: 3,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      }),
    });
    if (goal.status !== 201) throw Error('Owned local goal setup failed.');
    return (await fetch('/api/v1/account/goals')).json();
  });
  await page.goto('/#ops');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Publishing queue', exact: true }),
  ).toHaveCount(0);
  for (const method of ['GET', 'POST']) {
    const result = await page.evaluate(async (method) => {
      const response = await fetch('/api/v1/ops/discovery/queue?status=draft', {
        method,
      });
      return { status: response.status, body: await response.json() };
    }, method);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).toContain('connected server');
  }
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await fetch('/api/v1/account/goals')).json(),
    ),
  ).toEqual(before);
  await page
    .getByRole('link', { name: 'Back to reading', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#today$/);
  expect(network).toEqual([]);
});
