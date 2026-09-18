import { test, expect } from '../../helpers/app-fixture';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-WEB-1331 source qualification gaps save reload and delete from sensitivity diagnostics @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/#today');
  await prepareConnectionBrowser(page);
  await page.goto('/#impact-traces');
  const panel = page.getByRole('region', {
    name: 'Historical sensitivity diagnostics',
    exact: true,
  });
  await panel
    .getByLabel('Calibration holding', { exact: true })
    .selectOption('INE002A01018');
  await panel
    .getByLabel('Save this private source-bound diagnostic receipt.', {
      exact: true,
    })
    .check();
  await panel
    .getByLabel('Calibration holding', { exact: true })
    .selectOption('');
  await panel
    .getByLabel('Calibration holding', { exact: true })
    .selectOption('INE002A01018');
  await expect(
    panel.getByLabel('Save this private source-bound diagnostic receipt.', {
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole('button', {
      name: 'Calculate and save diagnostic',
      exact: true,
    }),
  ).toBeDisabled();
  await panel
    .getByLabel('Save this private source-bound diagnostic receipt.', {
      exact: true,
    })
    .check();
  await panel
    .getByRole('button', { name: 'Calculate and save diagnostic', exact: true })
    .click();
  await expect(
    panel.getByRole('heading', { name: /INE002A01018 · insufficient-data/ }),
  ).toBeVisible();
  await expect(panel).toContainText('Need at least 60 paired daily returns');
  await page.reload();
  await expect(
    panel.getByRole('heading', { name: /INE002A01018 · insufficient-data/ }),
  ).toBeVisible();
  await panel.getByRole('button', { name: /Delete calibration / }).click();
  await expect(
    panel.getByText('No saved calibrations.', { exact: true }),
  ).toBeVisible();
});
