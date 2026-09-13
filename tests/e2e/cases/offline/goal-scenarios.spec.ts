import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('E2E-OFFLINE-320 compare review save reopen adopt offline persistence and deletion @GOAL-SCENARIOS-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(
    async (username) => {
      const post = async (path: string, body: unknown) => {
        const r = await fetch(`/api/v1/account/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
        return r.json();
      };
      await post('register', {
        username,
        password: 'Synthetic-scenario-2026',
        consent: true,
      });
      await post('goals', {
        name: 'Synthetic learning goal',
        type: 'education',
        targetMinor: '10000000',
        savedMinor: '10000',
        monthlyMinor: '10000',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
    },
    `scenario_${randomUUID().slice(0, 10)}`,
  );
  await page.goto('/#my-goals');
  await page.getByRole('link', { name: 'Compare plans', exact: true }).click();
  await page
    .getByRole('button', { name: 'New comparison', exact: true })
    .click();
  await page
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic learning goal' });
  await page
    .getByLabel('Monthly contribution in rupees 1', { exact: true })
    .fill('2000.01');
  await page.getByLabel('Months 1', { exact: true }).fill('24');
  await page
    .getByRole('checkbox', { name: /I agree to store this comparison/ })
    .check();
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Comparison editor' }),
  ).toContainText('Unchanged plan');
  await page
    .getByRole('button', { name: 'Save comparison', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Goal comparisons', exact: true })
      .getByRole('status'),
  ).toContainText('Comparison saved.');
  await page.reload();
  await page
    .getByRole('region', { name: 'Saved comparisons' })
    .getByRole('button')
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved comparison detail' }),
  ).toContainText('2,000.01');
  await page
    .getByRole('button', { name: 'Review adoption 1', exact: true })
    .click();
  await page
    .getByRole('checkbox', {
      name: 'I confirm this change to my saved goal.',
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Adopt alternative', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Adoption history' }),
  ).toContainText('goal edition 2');
  await page.reload();
  const goals = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/goals');
    return r.json();
  });
  expect(goals.goals[0].monthlyMinor).toBe('200001');
  expect(goals.goals[0].version).toBe(2);
  expect(network).toEqual([]);
  const exported = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/privacy/export');
    if (!r.ok) throw Error('Export failed');
    return r.json();
  });
  expect(exported.goalScenarios.comparisons).toHaveLength(1);
  expect(exported.goalScenarios.adoptions).toHaveLength(1);
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Synthetic-scenario-2026' }),
    });
    if (!r.ok) throw Error('Delete failed');
  });
});
