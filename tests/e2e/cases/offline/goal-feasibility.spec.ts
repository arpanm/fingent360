import { test, expect } from '@playwright/test';
import {
  prepareFeasibility,
  saveFeasibility,
} from '../../helpers/goal-feasibility-browser';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-600 real local downside save reload export and account deletion no network @GOAL-FEASIBILITY-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareFeasibility(page);
  await saveFeasibility(page);
  const result = await page.evaluate(async () => {
    const exported = await (
      await fetch('/api/v1/account/privacy/export')
    ).json();
    const r = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Synthetic-capacity-2026' }),
    });
    return { exported, status: r.status };
  });
  expect(result.exported.goalFeasibility.assessments).toHaveLength(1);
  expect(result.status).toBe(200);
  await page.reload();
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Goal downside capacity', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/account/goal-feasibility')).status,
    ),
  ).toBe(401);
  expect(network).toEqual([]);
});
