import { expect, type Page } from '@playwright/test';
import { supplementalCsv } from '../fixtures/supplemental-holdings';
export async function prepareSupplemental(page: Page, attest = true) {
  await page
    .getByRole('button', { name: 'Map CSV columns', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'Map CSV columns',
    exact: true,
  });
  const mode = region.getByRole('radio', {
    name: 'Supply exact costs from my records',
    exact: true,
  });
  await mode.focus();
  await mode.press('Space');
  await region.getByLabel('Upload CSV to map', { exact: true }).setInputFiles({
    name: 'SYNTHETIC-supplemental.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(supplementalCsv),
  });
  await region.getByLabel('ISIN column', { exact: true }).selectOption('0');
  await region.getByLabel('Quantity column', { exact: true }).selectOption('1');
  await region
    .getByLabel('Supplied cost unit', { exact: true })
    .selectOption('INR-rupees');
  await region
    .getByLabel('Records used for supplied costs', { exact: true })
    .selectOption('trade-confirmations');
  await region
    .getByLabel('Declared source row count', { exact: true })
    .fill('2');
  await region
    .getByLabel('Declared reconciled acquisition-cost total', { exact: true })
    .fill('100.01');
  await region
    .getByLabel('Total acquisition cost for source row 2 (rupees)', {
      exact: true,
    })
    .fill('100.00');
  await region
    .getByLabel('Total acquisition cost for source row 3 (rupees)', {
      exact: true,
    })
    .fill('0.01');
  await region.getByRole('checkbox', { name: /^Combine duplicate/ }).check();
  if (attest)
    await region
      .getByRole('checkbox', { name: /^I attest that each supplied cost/ })
      .check();
  const prepare = region.getByRole('button', {
    name: 'Prepare mapped draft',
    exact: true,
  });
  await prepare.focus();
  await prepare.press('Enter');
  return region;
}
export async function previewSupplemental(page: Page) {
  await page
    .getByRole('checkbox', { name: /^I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings preview', exact: true }),
  ).toContainText('Acquisition costs supplied and attested by you');
}
