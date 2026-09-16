import {
  test,
  expect,
  indiaActors,
  insuranceInput,
} from '../../helpers/equity-insurance';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { NSE_GI_PARSER } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-WEB-1820 actual insurance file upload distinct review and operating ratio reader on web mobile @SRC-004 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await insuranceInput();
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Indian equity data',
    );
    const ops = page.getByRole('region', { name: 'Equity source operations' });
    await ops.getByLabel('Source format').selectOption(NSE_GI_PARSER);
    await ops.getByLabel('Source effective date').fill(input.effectiveOn);
    await ops.getByLabel('Original HTTPS source URL').fill(input.sourceUrl);
    await ops.getByLabel('Permission or licence basis').fill(input.rightsBasis);
    await ops.getByRole('checkbox').check();
    await ops.getByLabel('Source file', { exact: true }).setInputFiles({
      name: 'reconstructed-gi.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await ops.getByRole('button', { name: 'Retain and validate file' }).click();
    await expect(ops.getByRole('status')).toContainText(
      'Saved 17 observations as draft',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Indian equity data',
    );
    await ops
      .getByLabel('Publication or withdrawal reason')
      .fill(
        'Reconstructed general-insurance operating report independently reviewed.',
      );
    await ops
      .getByRole('button', { name: 'Publish edition', exact: true })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.goto('/?equity=INE765G01017#equities');
    const row = page
      .getByText(/insurance underwriting result: -62988.00 lakhs/)
      .locator('..');
    const summary = row.getByText('Insurance operating reconciliation', {
      exact: true,
    });
    await summary.focus();
    await summary.press('Enter');
    await expect(row).toContainText('2.7100 times');
    await expect(row).toContainText('107.200%');
    await expect(row).toContainText('not shareholder profit after tax');
    await expect(row).toContainText('current-quarter, year-to-date');
  } finally {
    await reviewer.dispose();
  }
});
