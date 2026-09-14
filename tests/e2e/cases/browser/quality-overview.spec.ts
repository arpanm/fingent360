import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';
test('E2E-WEB-630 current quality empty error retry and publishing navigation @QUALITY-OVERVIEW-001', async ({
  page,
}) => {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Data quality', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'Data quality',
    exact: true,
  });
  await expect(region).toContainText('No stored publications yet.');
  await page.route(
    '**/api/v1/ops/quality',
    async (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic storage fault' }),
      }),
    { times: 1 },
  );
  await region
    .getByRole('button', { name: 'Refresh quality overview' })
    .click();
  await expect(region.getByRole('alert')).toContainText(
    'Quality overview unavailable',
  );
  await expect(region).not.toContainText('No stored publications yet.');
  await region.getByRole('button', { name: 'Retry quality overview' }).click();
  await expect(region).toContainText('No stored publications yet.');
  await region.getByRole('button', { name: 'Open publishing review' }).click();
  await expect(
    page.getByRole('button', { name: 'Publishing', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
