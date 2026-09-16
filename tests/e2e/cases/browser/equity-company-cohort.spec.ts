import {
  test,
  expect,
  indiaActors,
  loadCompanyCohort,
  companyCohortInput,
} from '../../helpers/equity-company-cohort';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true });
test('E2E-WEB-1890 original-linked cohort upload and independent reader retain negative profit and duplicate-period cardinality @SRC-005 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    company = (await loadCompanyCohort()).find((c) => c.symbol === 'BIGBLOC')!,
    input = await companyCohortInput(company);
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Indian equity data',
    );
    const ops = page.getByRole('region', { name: 'Equity source operations' });
    await ops.getByLabel('Source format').selectOption(input.parser);
    await ops.getByLabel('Source effective date').fill(input.effectiveOn);
    await ops.getByLabel('Original HTTPS source URL').fill(input.sourceUrl);
    await ops.getByLabel('Permission or licence basis').fill(input.rightsBasis);
    await ops.getByRole('checkbox').check();
    await ops.getByLabel('Source file', { exact: true }).setInputFiles({
      name: 'reconstructed-bigbloc.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await ops.getByRole('button', { name: 'Retain and validate file' }).click();
    await expect(ops.getByRole('status')).toContainText(
      'Saved 2 observations as draft',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Indian equity data',
    );
    await ops
      .getByLabel('Publication or withdrawal reason')
      .fill('Independently checked dated cohort loss in INR lakhs.');
    await ops
      .getByRole('button', { name: 'Publish edition', exact: true })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.goto(`/?equity=${company.isin}#equities`);
    await expect(
      page.getByText(/profit after tax: -496.16 lakhs/),
    ).toBeVisible();
    await expect(page.getByText(/revenue: 5635.54 lakhs/)).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
