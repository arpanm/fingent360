import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
// Capture options are worker-scoped and must be declared at file scope.
// Keep credentials out of trace, video and screenshot artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('Account browser @ACCOUNT-001', () => {
  test('E2E-WEB-030 create account and persist real-data watchlist across sessions', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const username = `e2e_${randomUUID().slice(0, 16)}`;
    const password = 'E2E-only-private-passphrase-2026';
    await page.goto('/#account');
    await page
      .getByRole('button', { name: 'Create a new account', exact: true })
      .click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('checkbox', { name: /I agree to store/ }).check();
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: `Signed in as ${username}` }),
    ).toBeVisible();
    try {
      await page
        .getByRole('checkbox', { name: 'India GDP growth', exact: true })
        .check();
      await page
        .getByRole('button', { name: 'Save watchlist', exact: true })
        .click();
      await expect(
        page.getByText('Watchlist saved.', { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('checkbox', { name: 'India GDP growth', exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole('region', { name: 'Saved watchlist' }),
      ).toContainText('India GDP growth');
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByLabel('Username', { exact: true }).fill(username);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(
        page.getByRole('checkbox', { name: 'India GDP growth', exact: true }),
      ).toBeChecked();
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    } finally {
      await page.getByText('Delete your account', { exact: true }).click();
      await page
        .getByLabel('Confirm current password', { exact: true })
        .fill(password);
      await page
        .getByRole('button', {
          name: 'Permanently delete account',
          exact: true,
        })
        .click();
      await expect(
        page.getByText('Account and private watchlist deleted.', {
          exact: true,
        }),
      ).toBeVisible();
    }
  });
});

test('E2E-WEB-033 sign-in returns to a known destination and rejects external redirects @ACCOUNT-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  const username = `e2e_${randomUUID().slice(0, 16)}`;
  const password = 'E2E-only-private-passphrase-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  await page.goto('/#account?next=privacy');
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  try {
    await expect(page).toHaveURL(/#privacy$/);
    await expect(
      page.getByRole('heading', { name: 'This session', exact: true }),
    ).toBeVisible();
    await page.goto('/#account');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.goto('/#account?next=https%3A%2F%2Fevil.example');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: `Signed in as ${username}` }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#account\?next=/);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
