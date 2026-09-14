import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-490 audit is connected-only across navigation direct bridge requests reload and private-record preservation @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const before = await page.evaluate(async () => {
    const register = await fetch('/api/v1/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `local_audit_${Date.now()}`,
        password: 'Synthetic-local-audit-password',
        consent: true,
      }),
    });
    if (register.status !== 201)
      throw Error('Owned local account setup failed.');
    const goal = await fetch('/api/v1/account/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Synthetic audit preservation goal',
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
    page.getByText('Audit activity requires a connected server', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Audit activity', exact: true }),
  ).toHaveCount(0);
  for (const method of ['GET', 'POST', 'DELETE']) {
    const result = await page.evaluate(async (method) => {
      const response = await fetch('/api/v1/ops/audit?from=2026-01-02', {
        method,
      });
      return { status: response.status, data: await response.json() };
    }, method);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.data)).toContain(
      'requires a connected server',
    );
  }
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await fetch('/api/v1/account/goals')).json(),
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
