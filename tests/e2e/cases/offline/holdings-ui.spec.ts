import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { HoldingsSnapshotSchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-090 guided manual holdings review save reload and removal use actual device storage @PORTFOLIO-001 @ANDROID-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(request.url());
  });
  await page.goto('/#account');
  await expect(
    page.getByRole('complementary', { name: 'On-device mode' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`local_hold_${randomUUID().slice(0, 8)}`);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Synthetic-local-holdings-2026');
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
  await page.goto('/#holdings');
  await expect(
    page.getByText('No holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Security ISIN', { exact: true }).fill('INE002A01018');
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
  await page.getByRole('button', { name: 'Add to draft', exact: true }).click();
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
    page.getByRole('region', { name: 'Saved holdings' }),
  ).toContainText('1.000001');
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings' }),
  ).toContainText('INE002A01018');
  const read = async () =>
    HoldingsSnapshotSchema.parse(
      await page.evaluate(async () =>
        (await fetch('/api/v1/account/holdings')).json(),
      ),
    );
  const saved = await read();
  expect(saved).toMatchObject({ version: 1, totalCostMinor: '100001' });
  expect(saved.holdings[0]).toMatchObject({
    quantity: '1.000001',
    totalCostMinor: '100001',
  });
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
  await page
    .getByRole('checkbox', { name: /I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  const confirm = page.getByRole('button', {
    name: 'Confirm replacement',
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  expect(await read()).toEqual(saved);
  await page
    .getByRole('checkbox', {
      name: /I acknowledge removing all 1 listed holdings/,
    })
    .check();
  await confirm.click();
  await expect(
    page.getByText('No holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('No holdings saved.', { exact: true }),
  ).toBeVisible();
  expect(await read()).toMatchObject({
    version: 2,
    holdings: [],
    totalCostMinor: '0',
  });
  await page
    .getByRole('button', { name: 'View holdings history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings history' }),
  ).toContainText('Revision 1');
  expect(network).toEqual([]);
});
