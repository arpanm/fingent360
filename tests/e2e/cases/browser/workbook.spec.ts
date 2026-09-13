import { parseHoldingsWorkbook } from '../../../../packages/contracts/src/index';
import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { brokenWorkbook } from '../../fixtures/workbooks';
import { readFileSync } from 'node:fs';
test('E2E-WEB-240 upload error preserves draft then reconciled XLSX saves and reloads @XLSX-001', async ({
  page,
}, testInfo) => {
  await page.goto('/');
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
  await page
    .getByRole('region', { name: 'Holdings preview' })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('workbook-review.png'),
    fullPage: false,
  });
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
});
