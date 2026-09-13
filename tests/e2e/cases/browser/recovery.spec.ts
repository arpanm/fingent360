import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import { expectRecoveryCaptureMask } from '../../helpers/recovery-capture';

// Browser fetch goes through the owned API route and retains this browser's
// account cookie. page.request would bypass routing and reach the shared app.
async function account(
  page: Page,
  path: string,
  body?: unknown,
  method = 'POST',
) {
  return page.evaluate(
    async (args) => {
      const response = await fetch(`/api/v1/account${args.path}`, {
        method: args.method,
        headers: { 'Content-Type': 'application/json' },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return response.status;
    },
    { path, method, body },
  );
}
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-210 private recovery code one-time display and forgot-password flow @RECOVERY-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  const username = `recovery_${randomUUID().slice(0, 12)}`;
  const password = 'Recovery-browser-password-2026';
  const next = 'Recovery-changed-password-2026';
  await page.goto('/#account');
  expect(
    await account(page, '/register', { username, password, consent: true }),
  ).toBe(201);
  try {
    await page.goto('/#privacy');
    const settings = page.getByRole('region', { name: 'Recovery code' });
    await settings.getByText('Create a recovery code', { exact: true }).click();
    await settings
      .getByLabel('Current password for recovery', { exact: true })
      .fill(password);
    await settings
      .getByLabel(
        'I will save this code privately. Any earlier recovery code will stop working.',
        { exact: true },
      )
      .check();
    await settings
      .getByRole('button', { name: 'Generate recovery code', exact: true })
      .click();
    const output = settings.getByLabel('Your new recovery code', {
      exact: true,
    });
    await expect(output).toBeVisible();
    const code = (await output.textContent())!;
    expect(
      /^[a-f0-9]{64}$/.test(code),
      'A valid private recovery code must be displayed.',
    ).toBe(true);
    await expectRecoveryCaptureMask(page, output);
    await settings
      .getByRole('button', { name: 'I saved my recovery code', exact: true })
      .click();
    await page.reload();
    await expect(page.getByLabel('Your new recovery code')).toHaveCount(0);
    expect(await account(page, '/logout')).toBe(200);
    await page.goto('/#account');
    await page
      .getByRole('link', { name: 'Forgot your password?', exact: true })
      .click();
    await page.getByLabel('Account username', { exact: true }).fill(username);
    await page.getByLabel('Saved recovery code', { exact: true }).fill(code);
    await page.getByLabel('New password', { exact: true }).fill(next);
    await page.getByLabel('Confirm new password', { exact: true }).fill(next);
    await page
      .getByRole('button', { name: 'Reset password', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Password reset', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Sign in with new password', exact: true })
      .click();
    expect(await account(page, '/login', { username, password: next })).toBe(
      200,
    );
  } finally {
    const removed = await account(page, '', { password: next }, 'DELETE');
    if (removed !== 200) await account(page, '', { password }, 'DELETE');
  }
});
