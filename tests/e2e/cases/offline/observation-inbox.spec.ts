import {
  activateObservationControl,
  tabToObservationControl,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  InboxSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import { beaBrowserCall } from '../../helpers/bea-fixture';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-081 original observation mute, restore and exact receipt survive reload @ALERT-001 @ALERT-002', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      requests.push(request.url());
  });
  const password = 'Synthetic-device-observation-2026';
  await page.goto('/#account');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`inbox_${randomUUID().slice(0, 12)}`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /Signed in as/ }),
  ).toBeVisible();
  try {
    await activateObservationControl(
      page,
      page.getByRole('checkbox', { name: 'India GDP growth', exact: true }),
      'Space',
    );
    await activateObservationControl(
      page,
      page.getByRole('button', { name: 'Save watchlist', exact: true }),
    );
    await expect(
      page.getByText('Watchlist saved.', { exact: true }),
    ).toBeVisible();
    const inbox = page.getByRole('region', {
      name: 'Observation inbox',
      exact: true,
    });
    const preferences = page.getByRole('region', {
      name: 'Inbox preferences',
      exact: true,
    });
    const readInbox = async () => {
      const response = await beaBrowserCall(page, '/api/v1/account/inbox');
      expect(response.status).toBe(200);
      return InboxSchema.parse(response.body).items;
    };
    const original = (await readInbox())[0];
    expect(original).toBeDefined();
    expect(original?.indicator).toBe('NY.GDP.MKTP.KD.ZG');
    expect(original?.read).toBe(false);
    await expect(inbox).toContainText('Unread');
    await activateObservationControl(
      page,
      preferences.getByRole('button', { name: 'Mute GDP growth', exact: true }),
      'Space',
    );
    await expect(
      preferences.getByRole('button', {
        name: 'Unmute GDP growth',
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    expect(await readInbox()).toEqual([]);
    await tabToObservationControl(
      page,
      preferences.getByRole('button', {
        name: 'Unmute GDP growth',
        exact: true,
      }),
    );
    await captureObservationLayout(
      page,
      preferences,
      testInfo,
      'offline-static-muted-preferences-focus-360',
    );
    await expect(
      inbox.getByRole('button', {
        name: 'Acknowledge observation',
        exact: true,
      }),
    ).toHaveCount(0);
    const mutedExport = await beaBrowserCall(
      page,
      '/api/v1/account/privacy/export',
    );
    expect(mutedExport.status).toBe(200);
    expect(
      PrivacyExportSchema.parse(mutedExport.body).alertPreferences.items,
    ).toEqual([
      expect.objectContaining({ indicator: 'NY.GDP.MKTP.KD.ZG', muted: true }),
    ]);
    await activateObservationControl(
      page,
      preferences.getByRole('button', {
        name: 'Unmute GDP growth',
        exact: true,
      }),
      'Enter',
    );
    await expect(inbox).toContainText('Unread');
    expect(await readInbox()).toEqual([original]);
    const acknowledge = inbox.getByRole('button', {
      name: 'Acknowledge observation',
      exact: true,
    });
    await tabToObservationControl(
      page,
      inbox.getByRole('link', {
        name: 'Review source and revision history',
        exact: true,
      }),
    );
    await page.keyboard.press('Tab');
    await expect(acknowledge).toBeFocused();
    const originalCard = inbox.locator(':scope > article');
    // Preserve real installed-bundle execution while masking every observation
    // paragraph, so visual artifacts contain only static labels and controls.
    await captureObservationLayout(
      page,
      originalCard,
      testInfo,
      'offline-original-inbox-focus-masked-360',
      [originalCard.locator('p')],
    );
    await page.keyboard.press('Space');
    await expect(inbox).toContainText('Acknowledged');
    await activateObservationControl(
      page,
      preferences.getByRole('button', { name: 'Mute GDP growth', exact: true }),
      'Space',
    );
    await expect(
      preferences.getByRole('button', {
        name: 'Unmute GDP growth',
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    expect(await readInbox()).toEqual([]);
    await activateObservationControl(
      page,
      preferences.getByRole('button', {
        name: 'Unmute GDP growth',
        exact: true,
      }),
      'Enter',
    );
    await expect(inbox).toContainText('Acknowledged');
    await page.reload();
    expect(await readInbox()).toEqual([{ ...original, read: true }]);
    await expect(
      inbox.getByRole('button', {
        name: 'Acknowledge observation',
        exact: true,
      }),
    ).toBeDisabled();
    const exported = await beaBrowserCall(
      page,
      '/api/v1/account/privacy/export',
    );
    expect(exported.status).toBe(200);
    expect(PrivacyExportSchema.parse(exported.body).acknowledgments).toEqual([
      expect.objectContaining({ observationId: original?.observationId }),
    ]);
  } finally {
    const deleted = await beaBrowserCall(page, '/api/v1/account', 'DELETE', {
      password,
    });
    expect(deleted.status).toBe(200);
  }
  expect(requests).toEqual([]);
});
