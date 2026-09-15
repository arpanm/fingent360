import { test, expect } from '../../helpers/app-fixture';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-990 actual owned proposal review consent save reload and delete @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
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
  await expect(review).toContainText('₹219.00');
  await expect(
    review
      .getByRole('list', { name: 'Policy constraints' })
      .locator(':scope > li'),
  ).toHaveCount(10);
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
  await expect(panel).toContainText('₹219.00');
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
