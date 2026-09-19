import {
  activateObservationControl,
  tabToObservationControl,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';
import { beaBrowserCall } from '../../helpers/bea-fixture';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  seedMaterialObservation,
  gdp,
} from '../../helpers/material-alert-fixture';
import {
  connectionDatabase,
  connectionPassword,
} from '../../helpers/research-connection-fixture';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-041 real corrected observation is unread and stale source context remains explicit @ALERT-001 @ALERT-002 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedMaterialObservation(feedbackSandbox, 2025, '1.25');
  await page.route(/\/api\/v1\/macro(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#account');
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`inbox_${randomUUID().slice(0, 12)}`);
  await page.getByLabel('Password', { exact: true }).fill(connectionPassword);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
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
    const inbox = page.getByRole('region', {
      name: 'Observation inbox',
      exact: true,
    });
    const acknowledge = inbox.getByRole('button', {
      name: 'Acknowledge observation',
      exact: true,
    });
    await expect(inbox).toContainText('Reported observation');
    await activateObservationControl(page, acknowledge);
    await expect(inbox).toContainText('Acknowledged');
    const staleAt = new Date(Date.now() - 40 * 86400000).toISOString();
    await seedMaterialObservation(feedbackSandbox, 2025, '1.75', gdp, {
      retrievedAt: staleAt,
    });
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      await pool.query(
        'UPDATE macro_runs SET finished_at=$1 WHERE indicator=$2',
        [staleAt, gdp],
      );
    } finally {
      await pool.end();
    }
    await page.reload();
    await expect(inbox).toContainText('Revised observation');
    await expect(inbox).toContainText('revision 2');
    await expect(inbox).toContainText('Unread');
    await expect(acknowledge).toBeEnabled();
    await expect(inbox).toContainText('Check the source status for freshness.');
    await expect(
      page.getByRole('region', { name: 'Saved watchlist', exact: true }),
    ).toContainText('Refresh due.');
    await expect(
      inbox.getByRole('link', {
        name: 'Review source and revision history',
        exact: true,
      }),
    ).toHaveAttribute('href', '#macro');
    const historyLink = inbox.getByRole('link', {
      name: 'Review source and revision history',
      exact: true,
    });
    await tabToObservationControl(page, historyLink);
    await page.keyboard.press('Tab');
    await expect(acknowledge).toBeFocused();
    await captureObservationLayout(
      page,
      inbox.locator(':scope > article'),
      testInfo,
      'synthetic-correction-unread-360',
    );
    await captureObservationLayout(
      page,
      page
        .getByRole('region', { name: 'Saved watchlist', exact: true })
        .locator(':scope > article'),
      testInfo,
      'synthetic-stale-source-360',
    );
    await page.keyboard.press('Space');
    await expect(inbox).toContainText('Acknowledged');
    await expect(acknowledge).toBeDisabled();
    // Continue with the keyboard after the acknowledged control disables itself.
    await tabToObservationControl(
      page,
      page.getByText('Delete your account', { exact: true }),
    );
    await page.reload();
    await expect(inbox).toContainText('Acknowledged');
    await expect(acknowledge).toBeDisabled();
    const preferences = page.getByRole('region', {
      name: 'Inbox preferences',
      exact: true,
    });
    await activateObservationControl(
      page,
      preferences.getByRole('button', { name: 'Mute GDP growth', exact: true }),
      'Space',
    );
    const unmute = preferences.getByRole('button', {
      name: 'Unmute GDP growth',
      exact: true,
    });
    await expect(unmute).toBeEnabled();
    await expect(acknowledge).toHaveCount(0);
    await tabToObservationControl(page, unmute);
    await captureObservationLayout(
      page,
      preferences,
      testInfo,
      'synthetic-muted-preferences-focus-360',
    );
    await page.keyboard.press('Enter');
    await expect(inbox).toContainText('Acknowledged');
    await seedMaterialObservation(feedbackSandbox, 2025, null);
    await page.reload();
    await expect(inbox).toContainText('revision 3');
    await expect(inbox).toContainText('Value withdrawn / unavailable');
    await tabToObservationControl(page, acknowledge);
    await captureObservationLayout(
      page,
      inbox.locator(':scope > article'),
      testInfo,
      'synthetic-withdrawal-unread-focus-360',
    );
    await expect(inbox).toContainText('Unread');
    await expect(acknowledge).toBeEnabled();
  } finally {
    const deleted = await beaBrowserCall(page, '/api/v1/account', 'DELETE', {
      password: connectionPassword,
    });
    expect(deleted.status).toBe(200);
  }
});
