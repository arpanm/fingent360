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

test('E2E-WEB-961 failed evidence review retries current selections and requires fresh consent @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { event } = await impactEventFixture(request, feedbackSandbox);
  await page.goto('/#today');
  await prepareConnectionBrowser(page);
  await page.goto('/#impact-traces');
  const panel = page.getByRole('region', { name: 'Impact traces', exact: true });
  await panel
    .getByLabel('Reviewed event', { exact: true })
    .selectOption(event.id);
  await panel
    .getByLabel('Reviewed sector', { exact: true })
    .selectOption('Synthetic sector context');
  await panel
    .getByLabel('Company in your holdings', { exact: true })
    .selectOption('INE002A01018');
  const goal = panel.getByLabel('Your goal', { exact: true });
  await goal.selectOption({ label: 'Synthetic research goal' });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  const endpoint = '**/api/v1/equities/INE002A01018';
  await page.route(endpoint, async (route) => {
    if (first) {
      first = false;
      await held;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Explicit simulated evidence outage' }),
      });
    } else {
      const url = new URL(route.request().url());
      await route.continue({ url: feedbackSandbox.apiOrigin + url.pathname });
    }
  });
  try {
    const submit = panel.getByRole('button', {
      name: 'Review impact trace', exact: true,
    });
    await submit.click();
    await expect(goal).toBeDisabled();
    await expect(
      panel.getByLabel('Independently released causal context', { exact: true }),
    ).toBeDisabled();
    await expect(
      panel.getByLabel('Use the verified IndiGo oil-cost educational walkthrough'),
    ).toBeDisabled();
    release();
    await expect(panel.getByRole('alert')).toContainText(
      'Company evidence unavailable. Retry before reviewing.',
    );
    const review = panel.getByRole('region', {
      name: 'Impact trace review', exact: true,
    });
    await expect(review).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(
      review.getByRole('heading', { name: 'Review before saving' }),
    ).toBeFocused();
    await expect(
      review.getByRole('list', { name: 'Evidence to goal trace' })
        .locator(':scope > li'),
    ).toHaveCount(6);
    await review.getByRole('checkbox').check();
    await goal.selectOption('');
    await expect(review).toHaveCount(0);
    await expect(submit).toBeDisabled();
    await goal.selectOption({ label: 'Synthetic research goal' });
    await submit.click();
    await expect(review.getByRole('checkbox')).not.toBeChecked();
    await expect(
      review.getByRole('button', { name: 'Save impact trace' }),
    ).toBeDisabled();
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Save impact trace' }).click();
    await expect(
      panel.getByText('Impact trace saved.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      panel.getByText('Open saved trace', { exact: true }),
    ).toHaveCount(1);
  } finally {
    release();
    await page.unroute(endpoint);
  }
});
