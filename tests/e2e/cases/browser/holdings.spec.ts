import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-090 review, save, reload, export and clear entered holdings @PORTFOLIO-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  const password = 'Synthetic-holdings-test-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  await page.goto('/#account');
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`hold_${randomUUID().slice(0, 16)}`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
  try {
    await page.goto('/#holdings');
    await expect(
      page.getByText('No holdings saved.', { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE002A01018');
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click();
    await page.getByLabel('Quantity', { exact: true }).fill('1.000001');
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('1000.01');
    await page
      .getByRole('button', { name: 'Review this holding', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Add to draft', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Draft holdings' }),
    ).toContainText('1000.01');
    await page
      .getByRole('button', { name: 'Edit INE002A01018', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click();
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('99.00');
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Cancel holding edit', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Draft holdings' }),
    ).toContainText('1000.01');
    await page
      .getByRole('checkbox', { name: /I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Holdings preview' }),
    ).toContainText('1000.01');
    await expect(
      page.getByText('No holdings saved.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'My entered holdings', exact: true })
        .getByRole('status'),
    ).toHaveText('Holdings saved.');
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Saved holdings' }),
    ).toContainText('1.000001');
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Download saved CSV', exact: true })
      .click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      'fingent360-holdings.csv',
    );
    await page
      .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
      .click();
    await page
      .getByLabel('Upload standard CSV or XLSX', { exact: true })
      .setInputFiles({
        name: 'empty.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('isin,quantity,total_cost_paise'),
      });
    await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
      'isin,quantity,total_cost_paise',
    );
    await page
      .getByRole('checkbox', { name: /I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Holdings preview' }),
    ).toContainText('0 rows');
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page.getByText('No holdings saved.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'View holdings history', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Holdings history' }),
    ).toContainText('Revision 1');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-092 holdings auth gates distinguish outages and preserve unsaved entries @PORTFOLIO-001 @UX-001', async ({
  page,
}) => {
  // Explicit outage fixtures only; persisted records use the real API.
  await page.route('**/api/v1/account/holdings', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: '<html>Temporary outage</html>',
    }),
  );
  await page.goto('/#holdings');
  await expect(page.getByRole('alert')).toContainText('unreadable response');
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/account/holdings');
  await page.reload();
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toHaveAttribute('href', '#account?next=holdings');
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  const password = 'Synthetic-holdings-test-2026';
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`hold_${randomUUID().slice(0, 16)}`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  try {
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE002A01018');
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click();
    await page.getByLabel('Quantity', { exact: true }).fill('2');
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('300.01');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('button', { name: 'Reload saved holdings', exact: true })
      .click();
    await expect(
      page.getByLabel('Total purchase cost (INR)', { exact: true }),
    ).toHaveValue('300.01');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
      .click();
    await expect(
      page.getByLabel('Total purchase cost (INR)', { exact: true }),
    ).toHaveValue('300.01');
    await page.route('**/api/v1/account/holdings', (route) =>
      route.fulfill({ status: 401, body: '' }),
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Reload saved holdings', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Security ISIN', { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await page.unroute('**/api/v1/account/holdings');
    await page.request.delete('/api/v1/account', {
      headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
      data: { password },
    });
  }
});
