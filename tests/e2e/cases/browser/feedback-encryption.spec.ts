import { test, expect } from '../../helpers/feedback-fixture';
import { operatorKey } from '../../helpers/operator';
test('E2E-WEB-1256 support encryption maintenance requires confirmation and reports bounded results @DEV-017', async ({
  page,
  request,
}) => {
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Feedback inbox', exact: true })
    .click();
  const maintenance = page.getByRole('region', {
    name: 'Feedback encryption maintenance',
    exact: true,
  });
  const submit = maintenance.getByRole('button', {
    name: 'Upgrade next feedback batch',
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await maintenance.getByRole('checkbox').check();
  await submit.click();
  await expect(maintenance).toContainText('0 reports upgraded. 0 remain.');
  await expect(submit).toBeDisabled();
});
