import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export async function prepareFeasibility(page: Page) {
  await page.evaluate(
    async (username) => {
      const send = async (path: string, data: unknown) => {
        const r = await fetch('/api/v1/account/' + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
        return r.json();
      };
      await send('register', {
        username,
        password: 'Synthetic-capacity-2026',
        consent: true,
      });
      await send('goals', {
        name: 'Synthetic downside goal',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '20000',
        monthlyMinor: '10000',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
    },
    `capacity_${randomUUID().slice(0, 8)}`,
  );
}
export async function saveFeasibility(page: Page) {
  await page.goto('/#my-goals');
  const panel = page.getByRole('region', {
    name: 'Goal downside capacity',
    exact: true,
  });
  await panel
    .getByRole('button', { name: 'Assess downside capacity', exact: true })
    .click();
  await panel
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic downside goal · revision 1' });
  await panel
    .getByLabel('Affordable monthly ceiling (INR)', { exact: true })
    .fill('80');
  await panel
    .getByLabel('Months without contributions', { exact: true })
    .fill('3');
  await panel
    .getByLabel('Protected part of entered savings (INR)', { exact: true })
    .fill('100');
  await panel
    .getByRole('button', { name: 'Review downside assumptions', exact: true })
    .press('Enter');
  await expect(panel).toContainText('INR 820.00');
  await panel
    .getByRole('button', { name: 'Back to assumptions', exact: true })
    .click();
  await expect(
    panel.getByLabel('Affordable monthly ceiling (INR)', { exact: true }),
  ).toHaveValue('80');
  await panel
    .getByRole('button', { name: 'Review downside assumptions', exact: true })
    .click();
  await panel
    .getByRole('checkbox', {
      name: 'Store these assumptions and this dated assessment in my account',
      exact: true,
    })
    .check();
  await panel
    .getByRole('button', { name: 'Save assessment', exact: true })
    .click();
  await expect(
    panel.getByRole('status').filter({ hasText: 'Assessment saved.' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    panel.getByRole('heading', {
      name: 'Synthetic downside goal · downside assessment',
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByText('View saved assumptions and result', { exact: true })
    .click();
  await expect(panel).toContainText('INR 180.00');
  return panel;
}
