import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
test('E2E-WEB-220 request, open and download actual private saved-record report @REPORTS-001', async ({
  page,
}) => {
  await page.goto('/');
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
test('E2E-WEB-221 mobile report reader keyboard close preserves route and focus @REPORTS-001', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.evaluate(
    async (username) => {
      await fetch('/api/v1/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: 'Synthetic-report-2026',
          consent: true,
        }),
      });
      await fetch('/api/v1/account/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          label: 'Synthetic mobile review',
          consent: true,
        }),
      });
    },
    `report_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#reports');
  const trigger = page.getByRole('button', {
    name: 'Open report',
    exact: true,
  });
  await trigger.click({ timeout: 15000 });
  await expect(
    page.getByRole('dialog', { name: 'Issued record report' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/#reports$/);
});
