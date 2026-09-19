import { expectUnobscuredControl } from '../../helpers/focus-visibility';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareMaterialBrowser,
  saveMaterialSettings,
} from '../../helpers/material-alert-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-790 explicit automatic review Back enable reload disable preserves manual controls @MATERIAL-AUTO-001', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  const region = page.getByRole('region', {
    name: 'Automatic material checks',
    exact: true,
  });
  const setup = region.getByRole('button', {
    name: 'Set up automatic checks',
    exact: true,
  });
  const enable = region.getByRole('button', {
    name: 'Enable automatic checks',
    exact: true,
  });
  const back = region.getByRole('button', {
    name: 'Back without enabling',
    exact: true,
  });
  const consent = region.getByRole('checkbox');
  await expect(region).toContainText('Manual mode');
  await setup.focus();
  await expect(setup).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(enable).toBeDisabled();
  // Tab order must reach consent and skip the disabled confirmation.
  await page.keyboard.press('Tab');
  await expect(consent).toBeFocused();
  await expect(consent).not.toBeChecked();
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  await expectUnobscuredControl(back);
  await page.keyboard.press('Enter');
  await expect(region).toContainText('Manual mode');
  await expect(consent).toHaveCount(0);
  await setup.focus();
  await expect(setup).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(consent).toBeFocused();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(enable).toBeFocused();
  await expectUnobscuredControl(enable);
  await expect(enable).toBeEnabled();
  await expect
    .poll(() =>
      region.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          element.scrollWidth <= element.clientWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1
        );
      }),
    )
    .toBe(true);
  await testInfo.attach('automatic-material-keyboard-review', {
    body: await region.screenshot(),
    contentType: 'image/png',
  });
  await page.keyboard.press('Enter');
  await expect(region).toContainText('Enabled: once every 24 hours.');
  await page.reload();
  await expect(region).toContainText('Next eligible check:');
  const disable = region.getByRole('button', {
    name: 'Disable automatic checks',
    exact: true,
  });
  await disable.focus();
  await expect(disable).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(region).toContainText('Manual mode');
  await expect(
    page.getByRole('button', {
      name: 'Check stored observations',
      exact: true,
    }),
  ).toBeEnabled();
});
