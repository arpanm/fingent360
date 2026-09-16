import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('E2E-OFFLINE-034 private account and watchlist persist on device and unchanged save is disabled @ACCOUNT-001', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      requests.push(request.url());
  });
  await page.goto('/#account');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  const username = `local_${randomUUID().slice(0, 12)}`;
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Synthetic-device-account-2026');
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: `Signed in as ${username}` }),
  ).toBeVisible();
  const indicator = page.getByRole('checkbox', {
    name: 'India GDP growth',
    exact: true,
  });
  const save = page.getByRole('button', {
    name: 'Save watchlist',
    exact: true,
  });
  await expect(indicator).toBeEnabled();
  await expect(save).toBeDisabled();
  await indicator.check();
  await save.click();
  await expect(
    page.getByText('Watchlist saved.', { exact: true }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(indicator).toBeChecked();
  await expect(indicator).toBeEnabled();
  await expect(save).toBeDisabled();
  expect(requests).toEqual([]);
});
