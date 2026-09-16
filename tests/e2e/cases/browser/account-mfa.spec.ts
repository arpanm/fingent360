import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authPassword } from '../../helpers/auth-wait';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-1400 privacy authenticator enrollment and confirmation @DEV-017 @TEST-SIMULATION', async ({
  request,
  page,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#privacy');
  const security = page.getByRole('region', { name: 'Authenticator security' });
  await expect(security).toContainText('Authenticator is not enabled.');
  await security
    .getByLabel('Current password', { exact: true })
    .fill(authPassword);
  await security
    .getByRole('button', { name: 'Set up authenticator', exact: true })
    .click();
  const secret = await security
    .getByLabel('Authenticator setup key')
    .inputValue();
  const moduleUrl = new URL(
    '../../../../apps/api/dist/account-mfa-crypto.js',
    import.meta.url,
  ).href;
  const { authenticatorCode } = await import(moduleUrl);
  await security
    .getByLabel('Authenticator code', { exact: true })
    .fill(authenticatorCode(secret, Math.floor(Date.now() / 30000)));
  await security
    .getByRole('button', { name: 'Confirm authenticator', exact: true })
    .click();
  await expect(security).toContainText('Authenticator is enabled.');
  await expect(security.getByLabel('Authenticator setup key')).toHaveCount(0);
  await page.reload();
  await expect(security).toContainText('Authenticator is enabled.');
});
