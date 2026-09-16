import {
  test,
  expect,
  indiaActors,
  lifeInsuranceInput,
} from '../../helpers/equity-life-insurance';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { NSE_LI_PARSER } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-WEB-1840 actual life-insurance upload review and account distinction reader on mobile and desktop @SRC-004 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await lifeInsuranceInput();
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Indian equity data',
    );
    const ops = page.getByRole('region', { name: 'Equity source operations' });
    await ops.getByLabel('Source format').selectOption(NSE_LI_PARSER);
    await ops.getByLabel('Source effective date').fill(input.effectiveOn);
    await ops.getByLabel('Original HTTPS source URL').fill(input.sourceUrl);
    await ops.getByLabel('Permission or licence basis').fill(input.rightsBasis);
    await ops.getByRole('checkbox').check();
    await ops.getByLabel('Source file', { exact: true }).setInputFiles({
      name: 'reconstructed-li.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await ops.getByRole('button', { name: 'Retain and validate file' }).click();
    await expect(ops.getByRole('status')).toContainText(
      'Saved 29 observations as draft',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Indian equity data',
    );
    await ops
      .getByLabel('Publication or withdrawal reason')
      .fill('Reconstructed LI accounts checked independently.');
    await ops
      .getByRole('button', { name: 'Publish edition', exact: true })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.goto('/?equity=INE795G01014#equities');
    const row = page
      .getByText(/life policy net surplus: 31722.00 lakhs/)
      .locator('..');
    const summary = row.getByText('Life-insurance account reconciliation', {
      exact: true,
    });
    await summary.focus();
    await summary.press('Enter');
    await expect(row).toContainText(
      'shareholder profit after tax 61119.00 lakhs',
    );
    await expect(row).toContainText('ratios are not interpreted');
    await expect(row).toContainText('current-quarter, year-to-date');
  } finally {
    await reviewer.dispose();
  }
});
