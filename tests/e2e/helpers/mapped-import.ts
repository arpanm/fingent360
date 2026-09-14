import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { mappedCsv } from '../fixtures/mapped-holdings';
export async function mappingAccount(page: Page, offline = false) {
  await page.goto('/');
  if (offline) await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(
    async (username) => {
      const response = await fetch('/api/v1/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: 'Synthetic-mapping-2026',
          consent: true,
        }),
      });
      if (response.status !== 201)
        throw Error(`Synthetic registration failed: ${response.status}`);
    },
    `mapping_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#holdings');
  await expect(
    page.getByRole('button', { name: 'Map CSV columns', exact: true }),
  ).toBeEnabled();
}
export async function prepareMapping(page: Page, duplicates = true) {
  const open = page.getByRole('button', {
    name: 'Map CSV columns',
    exact: true,
  });
  await open.focus();
  await open.press('Enter');
  const region = page.getByRole('region', {
    name: 'Map CSV columns',
    exact: true,
  });
  await region.getByLabel('Upload CSV to map', { exact: true }).setInputFiles({
    name: 'SYNTHETIC-user-mapping.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(mappedCsv),
  });
  await region.getByLabel('ISIN column', { exact: true }).selectOption('1');
  await region.getByLabel('Quantity column', { exact: true }).selectOption('2');
  await region
    .getByLabel('Total acquisition cost column', { exact: true })
    .selectOption('3');
  await region
    .getByLabel('Source cost unit', { exact: true })
    .selectOption('INR-rupees');
  await region
    .getByLabel('Declared source row count', { exact: true })
    .fill('2');
  await region
    .getByLabel('Declared source acquisition-cost total', { exact: true })
    .fill('100.01');
  if (duplicates)
    await region.getByRole('checkbox', { name: /^Combine duplicate/ }).check();
  const prepare = region.getByRole('button', {
    name: 'Prepare mapped draft',
    exact: true,
  });
  await prepare.focus();
  await prepare.press('Enter');
  return region;
}
export async function previewMapping(page: Page) {
  await page
    .getByRole('checkbox', { name: /^I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings preview', exact: true }),
  ).toContainText('User-mapped CSV totals reconciled');
}
