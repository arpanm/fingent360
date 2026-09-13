import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('E2E-OFFLINE-260 request, open and download durable offline private saved-record report @REPORTS-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(
    async (username) => {
      const r = await fetch('/api/v1/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: 'Synthetic-report-2026',
          consent: true,
        }),
      });
      if (!r.ok) throw Error(`Registration failed ${r.status}`);
    },
    `report_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#reports');
  await page
    .getByLabel('Report label', { exact: true })
    .fill('Synthetic browser report');
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Create record report', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .click({ timeout: 15000 });
  await expect(
    page.getByRole('region', { name: 'Issued record report' }),
  ).toContainText('not current market value');
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download this report', exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toMatch(
    /^saved-record-review-.*\.json$/,
  );
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Report history' }),
  ).toContainText('Synthetic browser report');
});
test('E2E-OFFLINE-261 queued snapshot survives reload and later source changes @REPORTS-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const id = await page.evaluate(async () => {
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Fixture ${r.status}`);
      return r.json();
    };
    await post('register', {
      username: `report_${crypto.randomUUID().slice(0, 12)}`,
      password: 'Synthetic-report-2026',
      consent: true,
    });
    const id = crypto.randomUUID();
    await post('reports', {
      requestId: id,
      label: 'Before new goal',
      consent: true,
    });
    await post('goals', {
      name: 'Later synthetic goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '0',
      monthlyMinor: '100',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    return id;
  });
  await page.reload();
  const job = await page.evaluate(
    async (id) => (await fetch(`/api/v1/account/reports/${id}`)).json(),
    id,
  );
  expect(job.status).toBe('succeeded');
  expect(job.report.snapshot.goals).toEqual([]);
  expect(job.report.goalReviews).toEqual([]);
});
