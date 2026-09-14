import { test, expect } from '@playwright/test';
import { PrivacyExportSchema } from '../../../../packages/contracts/src/index';
import {
  mappingAccount,
  prepareMapping,
  previewMapping,
} from '../../helpers/mapped-import';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-OFFLINE-610 mapped import reconciles saves exports and deletes on device without network @MAPPED-IMPORT-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(new URL(request.url()).pathname);
  });
  await mappingAccount(page, true);
  await prepareMapping(page);
  await previewMapping(page);
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('1.000001');
  const exported = PrivacyExportSchema.parse(
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/account/privacy/export');
      if (response.status !== 200) throw Error('Local export failed');
      return response.json();
    }),
  );
  expect(exported.holdings.revisions[0]?.import).toMatchObject({
    parserVersion: 'user-mapped-holdings-csv-v1',
    declaredRowCount: 2,
    consolidatedRowCount: 1,
  });
  expect(JSON.stringify(exported)).not.toContain('Private note');
  expect(JSON.stringify(exported)).not.toContain('Synthetic, never retain');
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/api/v1/account', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'Synthetic-mapping-2026' }),
          })
        ).status,
    ),
  ).toBe(200);
  expect(network).toEqual([]);
});
test('E2E-OFFLINE-611 mapped total correction and cancel preserve actual local holdings @MAPPED-IMPORT-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(new URL(request.url()).pathname);
  });
  await mappingAccount(page, true);
  await page
    .getByText('Broker export help and supported imports', { exact: true })
    .click();
  await expect(
    page.getByText(/Automatic broker formats are not enabled/),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'Zerodha official export help (opens a new tab)',
      exact: true,
    }),
  ).toBeVisible();
  const region = await prepareMapping(page);
  await region
    .getByLabel('Declared source row count', { exact: true })
    .fill('1');
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(region.getByRole('alert')).toContainText(
    'row count does not match',
  );
  await region
    .getByLabel('Declared source row count', { exact: true })
    .fill('2');
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(region.getByRole('status')).toContainText(
    'Source totals reconciled',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await region
    .getByRole('button', {
      name: 'Cancel mapping and restore draft',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('No holdings saved');
  const bounded = await page.evaluate(async () => {
    const response = await fetch('/api/v1/account/holdings/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'mapped-csv',
        csv:
          'Ignored,Security,Units,Cost\n' +
          Array.from(
            { length: 100 },
            () => `${'界'.repeat(330)},INE002A01018,1,1`,
          ).join('\n'),
        mapping: {
          isinColumn: 1,
          quantityColumn: 2,
          costColumn: 3,
          costUnit: 'INR-rupees',
          duplicates: 'combine',
        },
        declaredRowCount: 100,
        declaredTotal: '100',
        expectedVersion: 0,
        storageConsent: true,
      }),
    });
    return { status: response.status, body: await response.text() };
  });
  expect(bounded.status).toBe(400);
  expect(bounded.body).toContain('100,000 encoded bytes');
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('No holdings saved');
  expect(network).toEqual([]);
});
