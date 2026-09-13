import { parseHoldingsWorkbook } from '../../../../packages/contracts/src/index';
import { test, expect } from '@playwright/test';
import { PrivacyExportSchema } from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
import { brokenWorkbook } from '../../fixtures/workbooks';
import { readFileSync } from 'node:fs';
test('E2E-OFFLINE-290 upload error preserves draft then reconciled XLSX saves and reloads @XLSX-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/')) network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(
    async (username) => {
      const r = await fetch('/api/v1/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: 'Synthetic-workbook-2026',
          consent: true,
        }),
      });
      if (!r.ok) throw Error(`Fixture registration ${r.status}`);
    },
    `xlsx_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#holdings');
  await page
    .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Download blank XLSX template',
      exact: true,
    }),
  ).toBeVisible();
  for (const synthetic of [false, true]) {
    const pendingDownload = page.waitForEvent('download');
    const button = page.getByRole('button', {
      name: synthetic
        ? 'Download synthetic XLSX sample'
        : 'Download blank XLSX template',
      exact: true,
    });
    await button.focus();
    await button.press('Enter');
    const downloaded = await pendingDownload;
    expect(downloaded.suggestedFilename()).toBe(
      synthetic
        ? 'SYNTHETIC-fingent360-holdings-sample.xlsx'
        : 'fingent360-holdings-template.xlsx',
    );
    const localPath = await downloaded.path();
    expect(localPath).not.toBeNull();
    const contents = parseHoldingsWorkbook(
      new Uint8Array(readFileSync(localPath!)),
    );
    expect(contents.declaredRowCount).toBe(synthetic ? 1 : 0);
    expect(contents.declaredTotalMinor).toBe(synthetic ? '10001' : '0');
  }
  const upload = page.getByLabel('Upload standard CSV or XLSX', {
    exact: true,
  });
  await upload.setInputFiles({
    name: 'SYNTHETIC-bad.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(brokenWorkbook('total')),
  });
  await expect(page.getByRole('alert')).toContainText('does not match');
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    'isin,quantity,total_cost_paise',
  );
  await upload.setInputFiles({
    name: 'SYNTHETIC-valid.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: readFileSync(
      new URL(
        '../../../../packages/contracts/test/fixtures/SYNTHETIC-openpyxl-holdings.xlsx',
        import.meta.url,
      ),
    ),
  });
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    /1\.000001,9999999999999999/,
  );
  await page
    .getByRole('checkbox', { name: /I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings preview' }),
  ).toContainText('Workbook totals reconciled');
  const pending = PrivacyExportSchema.parse(
    await page.evaluate(async () => {
      const r = await fetch('/api/v1/account/privacy/export');
      if (!r.ok) throw Error('Pending export failed');
      return r.json();
    }),
  );
  expect(pending.holdings.previews[0]?.import?.parserVersion).toBe(
    'standard-holdings-xlsx-v1',
  );
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
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('1.000001');
  expect(network).toEqual([]);
  const exported = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/privacy/export');
    if (!r.ok) throw Error('Export failed');
    return r.json();
  });
  expect(
    PrivacyExportSchema.parse(exported).holdings.previews[0]?.confirmedVersion,
  ).toBe(1);
  expect(JSON.stringify(exported)).toContain('standard-holdings-xlsx-v1');
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Synthetic-workbook-2026' }),
    });
    if (!r.ok) throw Error('Delete failed');
  });
});
