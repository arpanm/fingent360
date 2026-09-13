import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('E2E-OFFLINE-262 populated goal, holding and allocation report keeps exact separate cost @REPORTS-001', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(
    async (username) => {
      const send = async (path: string, body: unknown, method = 'POST') => {
        const r = await fetch(`/api/v1/account/${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error(`Synthetic setup ${path}: ${r.status}`);
        return r.json();
      };
      await send('register', {
        username,
        password: 'Synthetic-report-2026',
        consent: true,
      });
      const goal = await send('goals', {
        name: 'Synthetic populated goal',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '10001',
        monthlyMinor: '25002',
        horizonMonths: 3,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
      const p = await send('holdings/preview', {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
        expectedVersion: 0,
        storageConsent: true,
      });
      await send('holdings/confirm', {
        previewId: p.previewId,
        expectedVersion: 0,
      });
      await send(
        'allocations',
        {
          expectedVersion: 0,
          expectedHoldingsVersion: 1,
          storageConsent: true,
          rows: [
            {
              goalId: goal.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1',
            },
          ],
        },
        'PUT',
      );
    },
    `report_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#reports');
  await page
    .getByLabel('Report label', { exact: true })
    .fill('Synthetic complete review');
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Create record report', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .click({ timeout: 15000 });
  const reader = page.getByRole('dialog', { name: 'Issued record report' });
  await expect(reader).toContainText('850.07');
  await expect(reader).toContainText('149.93');
  await expect(reader).toContainText('33.33');
  await expect(reader).toContainText('not added');
  await page.screenshot({
    path: test.info().outputPath('issued-device-report.png'),
    fullPage: false,
  });
  const actual = await page.evaluate(async () => {
    const data = await (await fetch('/api/v1/account/reports')).json();
    return data.jobs[0].report;
  });
  expect(actual.goalReviews[0].projectedMinor).toBe('85007');
  expect(actual.snapshot.allocations.rows[0].recordedCostMinor).toBe('3333');
  expect(actual.recordedHoldingsCostMinor).toBe('10000');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Open report', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Issued record report' }),
  ).toContainText('850.07');
  const exported = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/privacy/export');
    if (!r.ok) throw Error('Export failed');
    return r.json();
  });
  expect(exported.reports.jobs[0].report).toEqual(actual);
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Synthetic-report-2026' }),
    });
    if (!r.ok) throw Error('Cleanup failed');
  });
});
