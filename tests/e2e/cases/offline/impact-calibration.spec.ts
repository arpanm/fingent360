import { test, expect } from '@playwright/test';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test('E2E-OFFLINE-1331 installed source diagnostics persist locally with no forecast or network calls @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
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
    .getByRole('button', { name: 'Calculate and save diagnostic', exact: true })
    .click();
  await expect(panel).toContainText(
    'No portfolio loss, goal change, expected return or trade is generated.',
  );
  await page.reload();
  await expect(
    panel.getByRole('button', { name: /Delete calibration / }),
  ).toBeVisible();
  expect(network).toEqual([]);
});
