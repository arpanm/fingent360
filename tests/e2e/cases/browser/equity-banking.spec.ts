import {
  test,
  expect,
  indiaActors,
  bankingInput,
} from '../../helpers/equity-banking';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { NSE_BANKING_PARSER } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-WEB-1730 actual banking upload independent publication reader ratios and withdrawal on web and mobile @SRC-004 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await bankingInput();
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Indian equity data',
    );
    const operations = page.getByRole('region', {
      name: 'Equity source operations',
    });
    await operations
      .getByLabel('Source format')
      .selectOption(NSE_BANKING_PARSER);
    await operations
      .getByLabel('Source effective date')
      .fill(input.effectiveOn);
    await operations
      .getByLabel('Original HTTPS source URL')
      .fill(input.sourceUrl);
    await operations
      .getByLabel('Permission or licence basis')
      .fill(input.rightsBasis);
    await operations.getByRole('checkbox').check();
    await operations.getByLabel('Source file', { exact: true }).setInputFiles({
      name: 'synthetic-banking.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await operations
      .getByRole('button', { name: 'Retain and validate file' })
      .click();
    await expect(operations.getByRole('status')).toContainText(
      'Saved 26 observations as draft',
    );
    await operations
      .getByLabel('Publication or withdrawal reason')
      .fill('Synthetic bank independent review required.');
    await operations
      .getByRole('button', { name: 'Publish edition', exact: true })
      .click();
    await expect(operations.getByRole('alert')).toContainText(
      'Another named operator',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Indian equity data',
    );
    await operations
      .getByLabel('Publication or withdrawal reason')
      .fill('Synthetic rendered banking statement independently reconciled.');
    await operations
      .getByRole('button', { name: 'Inspect original retained file' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Retained equity source' }),
    ).toContainText('Synthetic Bank');
    await operations
      .getByRole('button', { name: 'Publish edition', exact: true })
      .click();
    await expect(operations.locator('article')).toContainText('published');
    await page.goto('/?equity=INE545U01014#equities');
    const income = page
      .getByText(/bank interest earned: 100000.00 lakhs/)
      .first()
      .locator('..');
    const summary = income.getByText(
      'Reported bank ratios and reconciliation',
      { exact: true },
    );
    await summary.focus();
    await summary.press('Enter');
    await expect(income).toContainText('18.0400%');
    await expect(income).toContainText('not its publication timestamp');
    await expect(income).toContainText(
      'Total capital adequacy is not inferred',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Indian equity data',
    );
    await operations
      .getByLabel('Publication or withdrawal reason')
      .fill('Synthetic source withdrawal after review.');
    await operations
      .getByRole('button', { name: 'Withdraw edition', exact: true })
      .click();
    await expect(operations.locator('article')).toContainText('withdrawn');
  } finally {
    await reviewer.dispose();
  }
});
