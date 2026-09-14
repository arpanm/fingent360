import { test, expect } from '../../helpers/app-fixture';
import {
  mappingAccount,
  prepareMapping,
  previewMapping,
} from '../../helpers/mapped-import';
import { mappedCsv } from '../../fixtures/mapped-holdings';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-WEB-610 keyboard mapped import explicit duplicate review saved history and reload @MAPPED-IMPORT-001', async ({
  page,
}, testInfo) => {
  await mappingAccount(page);
  const region = await prepareMapping(page, false);
  await expect(region.getByRole('alert')).toContainText('duplicate ISIN');
  await expect(
    page.getByRole('button', { name: 'Preview holdings', exact: true }),
  ).toBeDisabled();
  await region.getByRole('checkbox', { name: /^Combine duplicate/ }).check();
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(
    page.getByLabel('Normalized mapped holdings', { exact: true }),
  ).toHaveValue('isin,quantity,total_cost_paise\nINE002A01018,1.000001,10001');
  await expect(region.getByRole('status')).toContainText(
    '2 source rows → 1 holdings',
  );
  await previewMapping(page);
  await page
    .getByRole('region', { name: 'Holdings preview', exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('synthetic-mapped-review.png'),
  });
  const confirm = page.getByRole('button', {
    name: 'Confirm replacement',
    exact: true,
  });
  await confirm.focus();
  await confirm.press('Enter');
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('1.000001');
  await page
    .getByRole('button', { name: 'View holdings history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings history', exact: true }),
  ).toContainText('Revision 1');
});
test('E2E-WEB-613 cancelling a pending real file read cannot restore the abandoned mapping @MAPPED-IMPORT-001 @simulated', async ({
  page,
}) => {
  await mappingAccount(page);
  await page
    .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
    .click();
  const original = 'isin,quantity,total_cost_paise\nINE002A01018,3,12345';
  await page.getByLabel('Holdings CSV', { exact: true }).fill(original);
  await page.evaluate(() => {
    const native = File.prototype.arrayBuffer;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = {
      release,
      restore: () => {
        File.prototype.arrayBuffer = native;
      },
      active: 0,
    };
    Object.assign(window, { mappedReadTest: state });
    File.prototype.arrayBuffer = async function () {
      if (this.name !== 'SYNTHETIC-pending.csv') return native.call(this);
      state.active++;
      try {
        const bytes = await native.call(this);
        await gate;
        return bytes;
      } finally {
        state.active--;
      }
    };
  });
  try {
    await page
      .getByRole('button', { name: 'Map CSV columns', exact: true })
      .click();
    const region = page.getByRole('region', {
      name: 'Map CSV columns',
      exact: true,
    });
    await region
      .getByLabel('Upload CSV to map', { exact: true })
      .setInputFiles({
        name: 'SYNTHETIC-pending.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(mappedCsv),
      });
    await expect(region.getByRole('status')).toHaveText('Reading CSV columns…');
    await expect(
      region.getByLabel('Upload CSV to map', { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Preview holdings', exact: true }),
    ).toBeDisabled();
    await region
      .getByRole('button', {
        name: 'Cancel mapping and restore draft',
        exact: true,
      })
      .click();
    await page.evaluate(() =>
      (
        window as unknown as { mappedReadTest: { release: () => void } }
      ).mappedReadTest.release(),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { mappedReadTest: { active: number } })
              .mappedReadTest.active,
        ),
      )
      .toBe(0);
    await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
      original,
    );
    await expect(
      page.getByRole('region', { name: 'Map CSV columns', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Saved holdings', exact: true }),
    ).toContainText('No holdings saved');
  } finally {
    await page.evaluate(() => {
      const state = (
        window as unknown as {
          mappedReadTest: { release: () => void; restore: () => void };
        }
      ).mappedReadTest;
      state.release();
      state.restore();
    });
  }
});
test('E2E-WEB-614 failed mapped preview retains reconciled draft and retries against the real API @MAPPED-IMPORT-001 @simulated', async ({
  page,
}) => {
  await mappingAccount(page);
  await prepareMapping(page);
  const endpoint = '**/api/v1/account/holdings/preview';
  await page.route(
    endpoint,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic temporary preview failure.',
        }),
      }),
    { times: 1 },
  );
  try {
    await page
      .getByRole('checkbox', { name: /^I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Synthetic temporary preview failure',
    );
    await expect(
      page.getByLabel('Normalized mapped holdings', { exact: true }),
    ).toHaveValue(/1\.000001,10001/);
    await expect(
      page.getByRole('region', { name: 'Saved holdings', exact: true }),
    ).toContainText('No holdings saved');
    await previewMapping(page);
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page.getByText('Holdings saved.', { exact: true }),
    ).toBeVisible();
  } finally {
    await page.unroute(endpoint);
  }
});
test('E2E-WEB-615 broker help distinguishes researched exports from automatic parser support @MAPPED-IMPORT-001', async ({
  page,
}) => {
  await mappingAccount(page);
  const summary = page.getByText('Broker export help and supported imports', {
    exact: true,
  });
  await summary.focus();
  await summary.press('Enter');
  await expect(
    page.getByText(/Automatic broker formats are not enabled/),
  ).toBeVisible();
  for (const name of [
    'Zerodha',
    'Groww',
    'Upstox',
    'Angel One',
    'ICICI Direct',
  ]) {
    const link = page.getByRole('link', {
      name: `${name} official export help (opens a new tab)`,
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\//);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('E2E-WEB-611 mapping errors preserve draft and cancel restores the previous editable CSV @MAPPED-IMPORT-001', async ({
  page,
}) => {
  await mappingAccount(page);
  await page
    .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
    .click();
  const original = 'isin,quantity,total_cost_paise\nINE002A01018,3,12345';
  await page.getByLabel('Holdings CSV', { exact: true }).fill(original);
  const region = await prepareMapping(page);
  await region
    .getByLabel('Declared source acquisition-cost total', { exact: true })
    .fill('100.02');
  await expect(
    page.getByRole('button', { name: 'Preview holdings', exact: true }),
  ).toBeDisabled();
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(region.getByRole('alert')).toContainText('does not match');
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('No holdings saved');
  page.once('dialog', (dialog) => dialog.accept());
  await region
    .getByRole('button', {
      name: 'Cancel mapping and restore draft',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    original,
  );
});
test('E2E-WEB-612 editing prepared mapping discards provenance explicitly and actual signout clears private input @MAPPED-IMPORT-001', async ({
  page,
}) => {
  await mappingAccount(page);
  await prepareMapping(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', {
      name: 'Edit normalized rows as standard CSV',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    /1\.000001,10001/,
  );
  expect(
    await page.evaluate(
      async () =>
        (await fetch('/api/v1/account/logout', { method: 'POST' })).status,
    ),
  ).toBe(200);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Reload saved holdings', exact: true })
    .click();
  await expect(
    page.getByText('Keep a private record of your holdings', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Map CSV columns', exact: true }),
  ).toHaveCount(0);
});
