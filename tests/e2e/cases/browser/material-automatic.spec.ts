import { test, expect } from '../../helpers/app-fixture';
import {
  prepareMaterialBrowser,
  saveMaterialSettings,
} from '../../helpers/material-alert-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-790 explicit automatic review Back enable reload disable preserves manual controls @MATERIAL-AUTO-001', async ({
  page,
}) => {
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  const region = page.getByRole('region', {
    name: 'Automatic material checks',
    exact: true,
  });
  await expect(region).toContainText('Manual mode');
  await region
    .getByRole('button', { name: 'Set up automatic checks', exact: true })
    .click();
  await expect(
    region.getByRole('button', {
      name: 'Enable automatic checks',
      exact: true,
    }),
  ).toBeDisabled();
  await region
    .getByRole('button', { name: 'Back without enabling', exact: true })
    .click();
  await expect(region).toContainText('Manual mode');
  await region
    .getByRole('button', { name: 'Set up automatic checks', exact: true })
    .click();
  await region.getByRole('checkbox').check();
  await region
    .getByRole('button', { name: 'Enable automatic checks', exact: true })
    .click();
  await expect(region).toContainText('Enabled: once every 24 hours.');
  await page.reload();
  await expect(region).toContainText('Next eligible check:');
  await region
    .getByRole('button', { name: 'Disable automatic checks', exact: true })
    .click();
  await expect(region).toContainText('Manual mode');
  await expect(
    page.getByRole('button', {
      name: 'Check stored observations',
      exact: true,
    }),
  ).toBeEnabled();
});
