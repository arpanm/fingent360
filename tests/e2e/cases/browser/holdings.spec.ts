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
      .getByLabel('Holdings CSV', { exact: true })
      .fill('isin,quantity,total_cost_paise\nINE002A01018,1.000001,100001');
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
      .getByLabel('Holdings CSV', { exact: true })
      .fill('isin,quantity,total_cost_paise');
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
