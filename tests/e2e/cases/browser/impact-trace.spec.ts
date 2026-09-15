import { test, expect } from '../../helpers/app-fixture';
import { impactEventFixture } from '../../helpers/impact-trace';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-960 reviewed six step trace preview consent save reload delete and navigation @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { event } = await impactEventFixture(request, feedbackSandbox);
  await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#today');
  await prepareConnectionBrowser(page);
  await page.goto('/#impact-traces');
  const panel = page.getByRole('region', {
    name: 'Impact traces',
    exact: true,
  });
  await panel
    .getByLabel('Reviewed event', { exact: true })
    .selectOption(event.id);
  await panel
    .getByLabel('Reviewed sector', { exact: true })
    .selectOption('Synthetic sector context');
  await panel
    .getByLabel('Company in your holdings', { exact: true })
    .selectOption('INE002A01018');
  await panel
    .getByLabel('Your goal', { exact: true })
    .selectOption({ label: 'Synthetic research goal' });
  await panel
    .getByRole('button', { name: 'Review impact trace', exact: true })
    .click();
  const review = panel.getByRole('region', {
    name: 'Impact trace review',
    exact: true,
  });
  await expect(
    review
      .getByRole('list', { name: 'Evidence to goal trace' })
      .locator(':scope > li'),
  ).toHaveCount(6);
  await expect(review).toContainText('3.000001 units');
  await expect(
    review.getByRole('button', { name: 'Save impact trace' }),
  ).toBeDisabled();
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: 'Save impact trace' }).click();
  await expect(
    panel.getByText('Impact trace saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await panel.getByText('Open saved trace', { exact: true }).click();
  await expect(panel).toContainText('No estimated gain or loss.');
  await panel
    .getByRole('button', {
      name: 'Delete trace for Synthetic research goal',
      exact: true,
    })
    .click();
  await expect(
    panel.getByText('No saved traces yet.', { exact: true }),
  ).toBeVisible();
  await panel.getByRole('link', { name: 'Back to my overview' }).click();
  await expect(page).toHaveURL(/#overview$/);
});
