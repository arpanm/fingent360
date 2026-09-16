import {
  test,
  expect,
  indiaActors,
  filingRss,
  discoveryRights,
} from '../../helpers/filing-discovery';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-2000 real RSS permission upload inbox original inspection and explicit unresolved identity workflow @SRC-004 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Filing discovery');
    const ops = page.getByRole('region', {
      name: 'Financial filing discovery',
    });
    await expect(
      ops.getByRole('button', { name: 'Fetch official RSS' }),
    ).toBeDisabled();
    await ops
      .getByLabel('RSS retention and display permission')
      .fill(discoveryRights);
    await ops
      .getByRole('checkbox', {
        name: 'Enable permitted RSS discovery',
        exact: true,
      })
      .check();
    await ops
      .getByRole('checkbox', {
        name: 'I verified this RSS retention and internal display permission.',
        exact: true,
      })
      .check();
    await ops.getByRole('button', { name: 'Save RSS permission' }).click();
    await expect(
      ops.getByRole('button', { name: 'Fetch official RSS' }),
    ).toBeEnabled();
    await ops.getByLabel('Original filing RSS file').setInputFiles({
      name: 'reconstructed-original.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(filingRss()),
    });
    await ops
      .getByRole('button', { name: 'Retain original RSS', exact: true })
      .click();
    await expect(ops).toContainText('retained: 2 discovered items');
    await expect(ops).toContainText('CMI Limited');
    await expect(ops.getByText('Observed', { exact: false })).toHaveCount(2);
    await expect(
      ops.getByRole('link', { name: 'Open original XML at exchange' }).first(),
    ).toHaveAttribute(
      'href',
      /^https:\/\/nsearchives\.nseindia\.com\/corporate\/xbrl\//,
    );
    await expect(ops.getByRole('button', { name: /Publish/ })).toHaveCount(0);
    await ops.getByRole('button', { name: 'Inspect original RSS' }).click();
    await expect(ops.locator('pre')).toContainText('TEST-SIMULATION');
    await ops
      .getByRole('button', { name: 'Close original RSS' })
      .press('Enter');
    await expect(ops.locator('pre')).toHaveCount(0);
    await expect(ops).toContainText(
      'Security unmapped; original XML not parsed.',
    );
  } finally {
    await reviewer.dispose();
  }
});
