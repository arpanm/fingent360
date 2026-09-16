import { test, expect } from '../../helpers/app-fixture';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-1280 actual FIFO rebalance review retains lot allocation purchase and immutable result @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#today');
  await prepareConnectionBrowser(page);
  await page.goto('/#action-centre');
  const panel = page.getByRole('region', {
    name: 'Educational action centre',
    exact: true,
  });
  await panel
    .getByLabel('Saved holding', { exact: true })
    .selectOption('INE002A01018');
  await panel
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic research goal' });
  await panel
    .getByLabel('Comparison type', { exact: true })
    .selectOption('rebalance');
  await panel
    .getByLabel('Cost and transaction evidence explanation', { exact: true })
    .fill('Synthetic open-lot records, not broker data.');
  const first = panel.getByRole('group', { name: 'Open lot 1', exact: true });
  await first
    .getByLabel('Lot reference', { exact: true })
    .fill('Synthetic opening A');
  await first
    .getByLabel('Acquisition date', { exact: true })
    .fill('2024-01-02');
  await first.getByLabel('Open units', { exact: true }).fill('1');
  await first
    .getByLabel('Open acquisition cost (INR)', { exact: true })
    .fill('20');
  await panel
    .getByRole('button', { name: 'Add acquisition lot', exact: true })
    .click();
  const second = panel.getByRole('group', { name: 'Open lot 2', exact: true });
  await second
    .getByLabel('Lot reference', { exact: true })
    .fill('Synthetic opening B');
  await second
    .getByLabel('Acquisition date', { exact: true })
    .fill('2024-02-02');
  await second.getByLabel('Open units', { exact: true }).fill('2.000001');
  await second
    .getByLabel('Open acquisition cost (INR)', { exact: true })
    .fill('80');
  await panel.getByLabel('Purchase ISIN', { exact: true }).fill('INE009A01021');
  await panel.getByLabel('Purchase units', { exact: true }).fill('2');
  await panel
    .getByLabel('Assumed purchase price (INR)', { exact: true })
    .fill('50');
  await panel
    .getByLabel('Purchase price date', { exact: true })
    .fill(new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10));
  const fields: Record<string, string> = {
    'Proposed units to dispose': '1',
    'Assumed price per unit (INR)': '200',
    'Total assumed fees (INR)': '1',
    'Total assumed tax (INR)': '2',
    'Available cash (INR)': '500',
    'Emergency reserve (INR)': '100',
    'Loss capacity (INR)': '10',
    'Cash needed within days': '30',
    'Assumed executable units': '1',
    'Assumed settlement days': '2',
    'Maximum concentration (basis points)': '10000',
    'Turnover budget (basis points)': '4000',
    'Prior disposed acquisition cost (INR)': '0',
    'Cooldown days': '7',
    'Downside stress (basis points)': '1000',
    'Fee and tax assumption explanation':
      'Synthetic explicit assumptions, not a tax calculation.',
  };
  for (const [label, value] of Object.entries(fields))
    await panel.getByLabel(label, { exact: true }).fill(value);
  await panel
    .getByLabel('I understand price and investment uncertainty.', {
      exact: true,
    })
    .check();
  await panel
    .getByLabel('I have reviewed my financial obligations.', { exact: true })
    .check();
  await panel
    .getByLabel('Hypothetically earmark net proceeds to this goal once.', {
      exact: true,
    })
    .check();
  await panel
    .getByRole('button', { name: 'Review educational comparison', exact: true })
    .click();
  const review = panel.getByRole('region', {
    name: 'Educational comparison review',
    exact: true,
  });
  await expect(review).toContainText('₹119.00');
  await expect(
    review.getByRole('list', { name: 'FIFO lot allocation' }),
  ).toContainText('Synthetic opening A');
  await expect(
    review.getByRole('region', { name: 'Proposed trade breakdown' }),
  ).toContainText('INE009A01021');
  await expect(
    review
      .getByRole('list', { name: 'Policy constraints' })
      .locator(':scope > li'),
  ).toHaveCount(11);
  await expect(
    review.getByRole('button', { name: 'Save educational comparison' }),
  ).toBeDisabled();
  await review.getByRole('checkbox').check();
  await review
    .getByRole('button', { name: 'Save educational comparison' })
    .click();
  await expect(
    panel.getByText('Educational comparison saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(panel).toContainText(
    'Purchase price is beyond the seven-day review window.',
  );
  await panel.getByText('Open saved comparison', { exact: true }).click();
  await expect(panel).toContainText('₹119.00');
  await panel
    .getByRole('button', {
      name: 'Delete comparison for Synthetic research goal',
      exact: true,
    })
    .click();
  await expect(
    panel.getByText('No saved comparisons yet.', { exact: true }),
  ).toBeVisible();
  await panel.getByRole('link', { name: 'Back to my overview' }).click();
  await expect(page).toHaveURL(/#overview$/);
});

test('E2E-WEB-1283 eligible tax scenario shows calculation and retains saved source-backed policy @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#today');
  await prepareConnectionBrowser(page);
  await page.goto('/#action-centre');
  const panel = page.getByRole('region', {
    name: 'Educational action centre',
    exact: true,
  });
  await panel
    .getByLabel('Saved holding', { exact: true })
    .selectOption('INE002A01018');
  await panel
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic research goal' });
  await panel
    .getByLabel('Comparison type', { exact: true })
    .selectOption('rebalance');
  await panel
    .getByLabel('Cost and transaction evidence explanation', { exact: true })
    .fill('Synthetic open-lot records, not broker data.');
  const first = panel.getByRole('group', { name: 'Open lot 1', exact: true });
  await first
    .getByLabel('Lot reference', { exact: true })
    .fill('Synthetic opening A');
  await first
    .getByLabel('Acquisition date', { exact: true })
    .fill('2024-01-02');
  await first.getByLabel('Open units', { exact: true }).fill('1');
  await first
    .getByLabel('Open acquisition cost (INR)', { exact: true })
    .fill('20');
  await panel
    .getByRole('button', { name: 'Add acquisition lot', exact: true })
    .click();
  const second = panel.getByRole('group', { name: 'Open lot 2', exact: true });
  await second
    .getByLabel('Lot reference', { exact: true })
    .fill('Synthetic opening B');
  await second
    .getByLabel('Acquisition date', { exact: true })
    .fill('2024-02-02');
  await second.getByLabel('Open units', { exact: true }).fill('2.000001');
  await second
    .getByLabel('Open acquisition cost (INR)', { exact: true })
    .fill('80');
  await panel.getByLabel('Purchase ISIN', { exact: true }).fill('INE009A01021');
  await panel.getByLabel('Purchase units', { exact: true }).fill('2');
  await panel
    .getByLabel('Assumed purchase price (INR)', { exact: true })
    .fill('50');
  await panel
    .getByLabel('Purchase price date', { exact: true })
    .fill(new Date().toISOString().slice(0, 10));
  await panel
    .getByLabel('Tax calculation', { exact: true })
    .selectOption('calculated');
  await panel
    .getByLabel('Total taxable income including these gains (INR)', {
      exact: true,
    })
    .fill('600000');
  await panel
    .getByLabel('Prior eligible long-term gains this financial year (INR)', {
      exact: true,
    })
    .fill('125000');
  await panel
    .getByLabel('Deductible disposal fees excluding STT (INR)', { exact: true })
    .fill('1');
  await panel
    .getByLabel(
      'I confirm every listed eligibility condition for this tax scenario.',
      { exact: true },
    )
    .check();
  const fields: Record<string, string> = {
    'Proposed units to dispose': '1',
    'Assumed price per unit (INR)': '200',
    'Total assumed fees (INR)': '1',
    'Total assumed tax (INR)': '0',
    'Available cash (INR)': '500',
    'Emergency reserve (INR)': '100',
    'Loss capacity (INR)': '10',
    'Cash needed within days': '30',
    'Assumed executable units': '1',
    'Assumed settlement days': '2',
    'Maximum concentration (basis points)': '10000',
    'Turnover budget (basis points)': '4000',
    'Prior disposed acquisition cost (INR)': '0',
    'Cooldown days': '7',
    'Downside stress (basis points)': '1000',
    'Fee and tax assumption explanation':
      'Synthetic explicit assumptions, not a tax calculation.',
  };
  for (const [label, value] of Object.entries(fields))
    await panel.getByLabel(label, { exact: true }).fill(value);
  await panel
    .getByLabel('I understand price and investment uncertainty.', {
      exact: true,
    })
    .check();
  await panel
    .getByLabel('I have reviewed my financial obligations.', { exact: true })
    .check();
  await panel
    .getByLabel('Hypothetically earmark net proceeds to this goal once.', {
      exact: true,
    })
    .check();
  await panel
    .getByRole('button', { name: 'Review educational comparison', exact: true })
    .click();
  const review = panel.getByRole('region', {
    name: 'Educational comparison review',
    exact: true,
  });
  await expect(review).toContainText('₹97.72');
  await expect(
    review.getByRole('region', { name: 'Calculated disposal tax' }),
  ).toContainText('₹23.28');
  await expect(
    review.getByRole('list', { name: 'FIFO lot allocation' }),
  ).toContainText('Synthetic opening A');
  await expect(
    review.getByRole('region', { name: 'Proposed trade breakdown' }),
  ).toContainText('INE009A01021');
  await expect(
    review
      .getByRole('list', { name: 'Policy constraints' })
      .locator(':scope > li'),
  ).toHaveCount(11);
  await expect(
    review.getByRole('button', { name: 'Save educational comparison' }),
  ).toBeDisabled();
  await review.getByRole('checkbox').check();
  await review
    .getByRole('button', { name: 'Save educational comparison' })
    .click();
  await expect(
    panel.getByText('Educational comparison saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await panel.getByText('Open saved comparison', { exact: true }).click();
  await expect(panel).toContainText('₹97.72');
  await panel
    .getByRole('button', {
      name: 'Delete comparison for Synthetic research goal',
      exact: true,
    })
    .click();
  await expect(
    panel.getByText('No saved comparisons yet.', { exact: true }),
  ).toBeVisible();
  await panel.getByRole('link', { name: 'Back to my overview' }).click();
  await expect(page).toHaveURL(/#overview$/);
});
