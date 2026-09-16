import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { workerDatabase } from '../../helpers/worker-health';
import { operatorKey } from '../../helpers/operator';
test.use({ manualWorkers: true });
test('E2E-WEB-1270 deployment incident acknowledgment reload recovery and unavailable retry @DEV-021 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const db = await workerDatabase(feedbackSandbox);
  try {
    await db.query(
      "INSERT INTO deployment_monitor_processes(id,heartbeat_at) VALUES($1,clock_timestamp()-interval '4 minutes')",
      [randomUUID()],
    );
  } finally {
    await db.end();
  }
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Data quality', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'Deployment monitoring',
    exact: true,
  });
  await expect(region).toContainText('Missing API heartbeat');
  await region
    .getByRole('button', { name: 'Acknowledge missing heartbeat', exact: true })
    .click();
  await expect(region).toContainText('Acknowledged');
  await region
    .getByRole('button', { name: 'Refresh deployment monitoring', exact: true })
    .click();
  await expect(region).toContainText('Acknowledged');
  const retire = region.getByRole('button', {
    name: 'Retire decommissioned processes',
    exact: true,
  });
  await expect(retire).toBeDisabled();
  await region
    .getByRole('checkbox', {
      name: 'I confirm all missing processes have been decommissioned',
    })
    .check();
  await retire.click();
  await expect(region).toContainText('Resolved');
  await page.route(
    '**/api/v1/ops/monitoring',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic unavailable storage' }),
      }),
    { times: 1 },
  );
  await region
    .getByRole('button', { name: 'Refresh deployment monitoring', exact: true })
    .click();
  await expect(region.getByRole('alert')).toContainText(
    'Deployment monitoring unavailable',
  );
  await expect(region).not.toContainText('Resolved');
  await region
    .getByRole('button', { name: 'Retry deployment monitoring', exact: true })
    .click();
  await expect(region).toContainText('Resolved');
});
