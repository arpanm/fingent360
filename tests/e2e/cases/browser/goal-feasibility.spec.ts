import type { Route } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareFeasibility,
  saveFeasibility,
} from '../../helpers/goal-feasibility-browser';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-600 keyboard downside review Back confirmed persistence and deletion @GOAL-FEASIBILITY-001', async ({
  page,
}) => {
  await page.goto('/');
  await prepareFeasibility(page);
  const panel = await saveFeasibility(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  page.once('dialog', (dialog) => dialog.dismiss());
  await panel
    .getByRole('button', { name: 'Remove assessment', exact: true })
    .click();
  await expect(
    panel.getByRole('heading', {
      name: 'Synthetic downside goal · downside assessment',
      exact: true,
    }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await panel
    .getByRole('button', { name: 'Remove assessment', exact: true })
    .click();
  await expect(panel).toContainText('Assessment removed.');
  await page.reload();
  await expect(panel).toContainText('No saved downside assessments.');
});
test('E2E-WEB-601 unknown inputs and failed read retain explicit recovery @GOAL-FEASIBILITY-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/');
  await prepareFeasibility(page);
  const outage = (route: Route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic assessment outage.' }),
    });
  await page.route('**/api/v1/account/goal-feasibility', outage);
  await page.goto('/#my-goals');
  const panel = page.getByRole('region', {
    name: 'Goal downside capacity',
    exact: true,
  });
  await expect(panel.getByRole('alert')).toContainText(
    'Synthetic assessment outage.',
  );
  await page.unroute('**/api/v1/account/goal-feasibility', outage);
  await panel
    .getByRole('button', { name: 'Reload assessments', exact: true })
    .click();
  await expect(panel).toContainText('No saved downside assessments.');
  await panel
    .getByRole('button', { name: 'Assess downside capacity', exact: true })
    .click();
  await panel
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic downside goal · revision 1' });
  await panel
    .getByRole('button', { name: 'Review downside assumptions', exact: true })
    .click();
  await expect(panel).toContainText(
    'Unknown: complete the missing assumptions',
  );
  await panel.getByRole('checkbox').check();
  await panel
    .getByRole('button', { name: 'Save assessment', exact: true })
    .click();
  await expect(panel).toContainText('Assessment saved.');
});
