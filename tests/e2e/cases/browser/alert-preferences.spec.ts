import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
// Capture options are worker-scoped and must be declared at file scope.
// Keep credentials out of trace, video and screenshot artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('Observation inbox browser @ALERT-002 @external', () => {
  test('E2E-WEB-080 mute and restore an observation after reload', async ({
    page,
    playwright,
  }) => {
    test.setTimeout(90000);
    const api = await playwright.request.newContext({
      baseURL: process.env.E2E_API_URL ?? 'http://127.0.0.1:4100',
    });
    try {
      const refreshed = await api.post('/api/v1/macro/refresh', {
        headers: { Authorization: `Bearer ${await operatorKey()}` },
        data: { indicator: 'NY.GDP.MKTP.KD.ZG' },
        timeout: 45000,
      });
      expect(
        refreshed.status(),
        refreshed.status() === 200 ? '' : await refreshed.text(),
      ).toBe(200);
    } finally {
      await api.dispose();
    }
    const password = 'E2E-only-private-passphrase-2026';
    await page.goto('/#account');
    await page
      .getByRole('button', { name: 'Create a new account', exact: true })
      .click();
    await page
      .getByLabel('Username', { exact: true })
      .fill(`e2e_${randomUUID().slice(0, 16)}`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('checkbox', { name: /I agree to store/ }).check();
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    try {
      await page
        .getByRole('checkbox', { name: 'India GDP growth', exact: true })
        .check();
      await page
        .getByRole('button', { name: 'Save watchlist', exact: true })
        .click();
      const inbox = page.getByRole('region', { name: 'Observation inbox' });
      await expect(inbox).toContainText('Unread');
      const preferences = page.getByRole('region', {
        name: 'Inbox preferences',
      });
      await preferences
        .getByRole('button', { name: 'Mute GDP growth', exact: true })
        .click();
      await expect(inbox).not.toContainText('Unread');
      await page.reload();
      await expect(
        preferences.getByRole('button', {
          name: 'Unmute GDP growth',
          exact: true,
        }),
      ).toBeVisible();
      await preferences
        .getByRole('button', { name: 'Unmute GDP growth', exact: true })
        .click();
      await expect(inbox).toContainText('Unread');
      await inbox
        .getByRole('button', { name: 'Acknowledge observation', exact: true })
        .click();
      await expect(inbox).toContainText('Acknowledged');
      await preferences
        .getByRole('button', { name: 'Mute GDP growth', exact: true })
        .click();
      await expect(inbox).not.toContainText('Acknowledged');
      await preferences
        .getByRole('button', { name: 'Unmute GDP growth', exact: true })
        .click();
      await page.reload();
      await expect(inbox).toContainText('Acknowledged');
      await expect(
        inbox.getByRole('button', {
          name: 'Acknowledge observation',
          exact: true,
        }),
      ).toBeDisabled();
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
    }
  });
});
