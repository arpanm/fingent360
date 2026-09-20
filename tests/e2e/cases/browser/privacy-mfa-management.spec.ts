import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authPassword,
  recoveredPassword,
} from '../../helpers/auth-wait';
import {
  privacyType,
  privacyActivate,
  authenticator,
} from '../../helpers/privacy-management';
import { captureObservationLayout } from '../../helpers/observation-inbox-accessibility';
import {
  MfaEnrollmentSchema,
  MfaStatusSchema,
} from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-1403 keyboard authenticator management recovers status errors rejects replay and disables with a fresh code at narrow width @DEV-017 @TEST-SIMULATION', async ({
  request,
  page,
}, testInfo) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 360, height: 780 });
  let failStatus = true;
  await page.route('**/api/v1/account/mfa', (route) =>
    failStatus ? route.abort('failed') : route.fallback(),
  );
  try {
    await page.goto('/#privacy');
    const security = page.getByRole('region', {
      name: 'Authenticator security',
      exact: true,
    });
    await expect(security.getByRole('alert')).toBeVisible();
    failStatus = false;
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Reload authenticator settings',
        exact: true,
      }),
    );
    await expect(security).toContainText('Authenticator is not enabled.');
    await expect(security.getByRole('alert')).toHaveCount(0);
    await privacyType(
      page,
      security.getByLabel('Current password', { exact: true }),
      authPassword,
    );
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Set up authenticator',
        exact: true,
      }),
    );
    const setupKey = security.getByLabel('Authenticator setup key', {
      exact: true,
    });
    await expect(setupKey).toBeVisible();
    const secret = await setupKey.inputValue();
    const used = await authenticator(secret);
    await privacyType(
      page,
      security.getByLabel('Authenticator code', { exact: true }),
      used,
    );
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Confirm authenticator',
        exact: true,
      }),
    );
    await expect(security).toContainText('Authenticator is enabled.');
    await expect(setupKey).toHaveCount(0);
    await privacyType(
      page,
      security.getByLabel('Current password', { exact: true }),
      authPassword,
    );
    await privacyType(
      page,
      security.getByLabel('Authenticator code', { exact: true }),
      used,
    );
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Disable authenticator',
        exact: true,
      }),
    );
    await expect(security.getByRole('alert')).toBeVisible();
    expect(
      MfaStatusSchema.parse(
        await (await request.get('/api/v1/account/mfa')).json(),
      ).enabled,
    ).toBe(true);
    expect(
      (await security
        .getByLabel('Current password', { exact: true })
        .inputValue()) === '',
    ).toBe(true);
    expect(
      (await security
        .getByLabel('Authenticator code', { exact: true })
        .inputValue()) === '',
    ).toBe(true);
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Reload authenticator settings',
        exact: true,
      }),
    );
    await expect(security.getByRole('alert')).toHaveCount(0);
    await privacyType(
      page,
      security.getByLabel('Current password', { exact: true }),
      authPassword,
    );
    await privacyType(
      page,
      security.getByLabel('Authenticator code', { exact: true }),
      await authenticator(secret, 1),
    );
    await privacyActivate(
      page,
      security.getByRole('button', {
        name: 'Disable authenticator',
        exact: true,
      }),
      'Space',
    );
    await expect(security).toContainText('Authenticator is not enabled.');
    await expect(security).toContainText('Other sessions were signed out.');
    await page.reload();
    await expect(security).toContainText('Authenticator is not enabled.');
    await captureObservationLayout(
      page,
      security,
      testInfo,
      'synthetic-authenticator-disabled.png',
    );
  } finally {
    await page.unroute('**/api/v1/account/mfa');
  }
});

test('E2E-WEB-1404 keyboard recovery rotation requires MFA then saved-code reset clears authenticator and old sessions @DEV-017 @RECOVERY-001 @TEST-SIMULATION', async ({
  request,
  page,
}, testInfo) => {
  const owner = await registerRecoverable(request);
  const enrollment = MfaEnrollmentSchema.parse(
    await (
      await request.post('/api/v1/account/mfa/setup', {
        headers: authHeaders,
        data: { password: authPassword },
      })
    ).json(),
  );
  expect(
    (
      await request.post('/api/v1/account/mfa/confirm', {
        headers: authHeaders,
        data: {
          password: authPassword,
          code: await authenticator(enrollment.secret),
        },
      })
    ).status(),
  ).toBe(201);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/#privacy');
  const recovery = page.getByRole('region', {
    name: 'Recovery code',
    exact: true,
  });
  await expect(recovery).toContainText('A recovery code is configured.');
  await privacyActivate(page, recovery.locator('summary'));
  await privacyType(
    page,
    recovery.getByLabel('Current password for recovery', { exact: true }),
    authPassword,
  );
  const savedConfirmation = recovery.getByRole('checkbox');
  await privacyActivate(page, savedConfirmation, 'Space');
  await privacyActivate(
    page,
    recovery.getByRole('button', {
      name: 'Generate recovery code',
      exact: true,
    }),
  );
  await expect(recovery.getByRole('alert')).toBeVisible();
  await expect(recovery.getByLabel('Your new recovery code')).toHaveCount(0);
  await privacyType(
    page,
    recovery.getByLabel('Authenticator code for recovery (if enabled)', {
      exact: true,
    }),
    await authenticator(enrollment.secret, 1),
  );
  await privacyActivate(
    page,
    recovery.getByRole('button', {
      name: 'Generate recovery code',
      exact: true,
    }),
  );
  const output = recovery.getByLabel('Your new recovery code', { exact: true });
  await expect(output).toBeVisible();
  const code = (await output.textContent())!;
  expect(
    /^[a-f0-9]{64}$/.test(code),
    'Synthetic recovery code has expected format',
  ).toBe(true);
  expect(code !== owner.code, 'Rotation issues a new private code').toBe(true);
  await privacyActivate(
    page,
    recovery.getByRole('button', {
      name: 'I saved my recovery code',
      exact: true,
    }),
  );
  await expect(output).toHaveCount(0);
  await captureObservationLayout(
    page,
    recovery,
    testInfo,
    'synthetic-recovery-hidden.png',
  );
  await page.goto('/#recovery');
  await privacyType(
    page,
    page.getByLabel('Account username', { exact: true }),
    owner.username,
  );
  await privacyType(
    page,
    page.getByLabel('Saved recovery code', { exact: true }),
    code,
  );
  await privacyType(
    page,
    page.getByLabel('New password', { exact: true }),
    recoveredPassword,
  );
  await privacyType(
    page,
    page.getByLabel('Confirm new password', { exact: true }),
    authPassword,
  );
  await privacyActivate(
    page,
    page.getByRole('button', { name: 'Reset password', exact: true }),
  );
  await expect(page.getByRole('alert')).toContainText(
    'New passwords do not match',
  );
  await privacyType(
    page,
    page.getByLabel('Confirm new password', { exact: true }),
    recoveredPassword,
  );
  await privacyActivate(
    page,
    page.getByRole('button', { name: 'Reset password', exact: true }),
  );
  await expect(
    page.getByRole('heading', { name: 'Password reset', exact: true }),
  ).toBeVisible();
  expect((await request.get('/api/v1/account/mfa')).status()).toBe(401);
  await privacyActivate(
    page,
    page.getByRole('link', { name: 'Sign in with new password', exact: true }),
  );
  await privacyType(
    page,
    page.getByLabel('Username', { exact: true }),
    owner.username,
  );
  await privacyType(
    page,
    page.getByLabel('Password', { exact: true }),
    recoveredPassword,
  );
  await privacyActivate(
    page,
    page.getByRole('button', { name: 'Sign in', exact: true }),
  );
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
  await page.goto('/#privacy');
  await expect(
    page.getByRole('region', { name: 'Authenticator security' }),
  ).toContainText('Authenticator is not enabled.');
  await expect(
    page.getByRole('region', { name: 'Recovery code', exact: true }),
  ).toContainText('No active recovery code.');
});
