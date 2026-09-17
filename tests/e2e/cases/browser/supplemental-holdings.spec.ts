import { test, expect } from '../../helpers/app-fixture';
import { mappingAccount } from '../../helpers/mapped-import';
import {
  prepareSupplemental,
  previewSupplemental,
} from '../../helpers/supplemental-holdings';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-WEB-720 supplemental keyboard attestation review saved provenance history and normal mobile controls @BROKER-DIALECTS-001', async ({
  page,
}, testInfo) => {
  await mappingAccount(page);
  const region = await prepareSupplemental(page, false);
  await expect(region.getByRole('alert')).toContainText('explicitly attest');
  await expect(
    page.getByRole('button', { name: 'Preview holdings', exact: true }),
  ).toBeDisabled();
  await region
    .getByRole('checkbox', { name: /^I attest that each supplied cost/ })
    .check();
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(region.getByRole('status')).toContainText(
    'Supplied costs reconciled; user-attested',
  );
  await expect(
    page.getByLabel('Normalized mapped holdings', { exact: true }),
  ).toHaveValue('isin,quantity,total_cost_paise\nINE002A01018,3.000001,10001');
  await previewSupplemental(page);
  const preview = page.getByRole('region', {
    name: 'Holdings preview',
    exact: true,
  });
  await preview
    .getByText('View supplied cost receipts', { exact: true })
    .click();
  await expect(preview).toContainText(
    'Source row 2 · INE002A01018 · quantity 3 · supplied acquisition cost INR 100.00',
  );
  await preview.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('synthetic-supplemental-review.png'),
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
  ).toContainText(
    'Acquisition costs supplied and attested by you using trade confirmations',
  );
  await page
    .getByRole('button', { name: 'View holdings history', exact: true })
    .click();
  const history = page.getByRole('region', {
    name: 'Holdings history',
    exact: true,
  });
  await history.getByText(/^Revision 1 ·/).click();
  await expect(history).toContainText('This is not a verified broker import');
});
test('E2E-WEB-721 supplemental correction invalidates attestation units clear amounts and cancel restores prior draft @BROKER-DIALECTS-001', async ({
  page,
}) => {
  await mappingAccount(page);
  await page
    .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
    .click();
  const prior = 'isin,quantity,total_cost_paise\nINE002A01018,2,45678';
  await page.getByLabel('Holdings CSV', { exact: true }).fill(prior);
  const region = await prepareSupplemental(page);
  await region
    .getByLabel('Declared reconciled acquisition-cost total', { exact: true })
    .fill('100.02');
  await expect(
    region.getByRole('checkbox', { name: /^I attest that each supplied cost/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Preview holdings', exact: true }),
  ).toBeDisabled();
  await region
    .getByRole('checkbox', { name: /^I attest that each supplied cost/ })
    .check();
  await region
    .getByRole('button', { name: 'Prepare mapped draft', exact: true })
    .click();
  await expect(region.getByRole('alert')).toContainText(
    'does not match the supplied costs',
  );
  await region
    .getByLabel('Supplied cost unit', { exact: true })
    .selectOption('INR-paise');
  await expect(
    region.getByLabel('Total acquisition cost for source row 2 (paise)', {
      exact: true,
    }),
  ).toHaveValue('');
  await expect(
    region.getByLabel('Declared reconciled acquisition-cost total', {
      exact: true,
    }),
  ).toHaveValue('');
  await expect(
    region.getByRole('checkbox', { name: /^I attest that each supplied cost/ }),
  ).not.toBeChecked();
  page.once('dialog', (dialog) => dialog.accept());
  await region
    .getByRole('button', {
      name: 'Cancel mapping and restore draft',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    prior,
  );
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('No holdings saved');
});
test('E2E-WEB-722 supplemental preview failure keeps attested draft retry saves and normalized edit discards provenance @BROKER-DIALECTS-001 @simulated', async ({
  page,
}) => {
  await mappingAccount(page);
  const region = await prepareSupplemental(page);
  const endpoint = '**/api/v1/account/holdings/preview';
  await page.route(
    endpoint,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic supplemental preview unavailable.',
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
      'Synthetic supplemental preview unavailable',
    );
    await expect(
      region.getByRole('checkbox', {
        name: /^I attest that each supplied cost/,
      }),
    ).toBeChecked();
    await expect(
      page.getByLabel('Normalized mapped holdings', { exact: true }),
    ).toHaveValue(/3\.000001,10001/);
    await previewSupplemental(page);
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page.getByText('Holdings saved.', { exact: true }),
    ).toBeVisible();
    await prepareSupplemental(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', {
        name: 'Edit normalized rows as standard CSV',
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
      /3\.000001,10001/,
    );
    await page
      .getByRole('checkbox', { name: /^I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Holdings preview', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Holdings preview', exact: true })
        .getByRole('region', {
          name: 'Supplemental acquisition-cost receipt',
          exact: true,
        }),
    ).toHaveCount(0);
  } finally {
    await page.unroute(endpoint);
  }
});
test('E2E-WEB-723 actual concurrent holding revision preserves supplemental draft through baseline refresh and fresh review @BROKER-DIALECTS-001', async ({
  page,
}) => {
  await mappingAccount(page);
  const region = await prepareSupplemental(page);
  await previewSupplemental(page);
  expect(
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/account/holdings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: 'isin,quantity,total_cost_paise\nINE002A01018,4,20000',
          expectedVersion: 0,
          storageConsent: true,
        }),
      });
      if (response.status !== 201)
        throw Error('Owned concurrent preview failed');
      const preview = await response.json();
      return (
        await fetch('/api/v1/account/holdings/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previewId: preview.previewId,
            expectedVersion: 0,
          }),
        })
      ).status;
    }),
  ).toBe(201);
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Holdings changed');
  await expect(
    region.getByRole('checkbox', { name: /^I attest that each supplied cost/ }),
  ).toBeChecked();
  await page
    .getByRole('button', {
      name: 'Refresh baseline and keep draft',
      exact: true,
    })
    .click();
  await expect(page.getByText(/Current baseline loaded/)).toBeVisible();
  await expect(
    page.getByLabel('Normalized mapped holdings', { exact: true }),
  ).toHaveValue(/3\.000001,10001/);
  await previewSupplemental(page);
  await expect(
    page.getByRole('region', { name: 'Holdings preview', exact: true }),
  ).toContainText('replacing revision 1');
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
});
test('E2E-WEB-724 actual session revocation clears private supplemental costs and attestation @BROKER-DIALECTS-001', async ({
  page,
}) => {
  await mappingAccount(page);
  await prepareSupplemental(page);
  expect(
    await page.evaluate(
      async () =>
        (await fetch('/api/v1/account/logout', { method: 'POST' })).status,
    ),
  ).toBe(200);
  await page
    .getByRole('checkbox', { name: /^I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByText('Keep a private record of your holdings', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Map CSV columns', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Normalized mapped holdings', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', {
      name: 'Supplemental acquisition-cost receipt',
      exact: true,
    }),
  ).toHaveCount(0);
});
test('E2E-WEB-725 broker help links real export paths and separates substituted prices from acquisition costs @BROKER-DIALECTS-001', async ({
  page,
}) => {
  await mappingAccount(page);
  await page
    .getByText('Broker export help and supported imports', { exact: true })
    .click();
  await expect(
    page.getByText(/Automatic broker formats are not enabled/),
  ).toBeVisible();
  await page.getByLabel('Your broker', { exact: true }).selectOption('groww');
  await expect(
    page.getByRole('link', {
      name: 'Groww official export help (opens a new tab)',
      exact: true,
    }),
  ).toHaveAttribute(
    'href',
    'https://groww.in/updates/updates-from-groww-tax-loss-harvesting-intraday-oco-bonds-and-lots-more',
  );
  await page.getByLabel('Your broker', { exact: true }).selectOption('upstox');
  await expect(
    page.getByRole('link', {
      name: 'Upstox official export help (opens a new tab)',
      exact: true,
    }),
  ).toHaveAttribute(
    'href',
    'https://upstox.com/help-center/how-can-i-check-my-holdings-248548/',
  );
  await page
    .getByLabel('Your broker', { exact: true })
    .selectOption('icici-direct');
  await expect(
    page.getByText(
      /ICICI Direct says off-market Portfolio entries can use transfer-day closing prices/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'ICICI Direct additional guidance (opens a new tab)',
      exact: true,
    }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
