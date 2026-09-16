import { test, expect } from '../../helpers/app-fixture';
import { oilEducationFixture } from '../../helpers/oil-education';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
import { OIL_EDUCATION_ISIN } from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-WEB-1470 actual issuer fuel-cost excerpt and owned goal preview save reload expose no-action and exact six steps @DEV-010 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await oilEducationFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await prepareConnectionBrowser(page, OIL_EDUCATION_ISIN);
    await page.goto('/#impact-traces');
    const panel = page.getByRole('region', {
      name: 'Impact traces',
      exact: true,
    });
    await panel
      .getByLabel('Reviewed event', { exact: true })
      .selectOption(fixture.event.id);
    await panel
      .getByLabel('Reviewed sector', { exact: true })
      .selectOption('Airlines');
    await panel
      .getByLabel('Company in your holdings', { exact: true })
      .selectOption(OIL_EDUCATION_ISIN);
    await panel
      .getByLabel('Your goal', { exact: true })
      .selectOption({ label: 'Synthetic research goal' });
    await panel
      .getByLabel('Independently released causal context')
      .selectOption(fixture.context.id);
    await panel
      .getByRole('checkbox', {
        name: 'Use the verified IndiGo oil-cost educational walkthrough',
      })
      .check();
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
    await expect(
      review.getByRole('region', { name: 'Oil cost educational conclusion' }),
    ).toContainText('2026-04-01');
    await expect(review).toContainText(
      'not a one-for-one Brent or WTI sensitivity',
    );
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Save impact trace' }).click();
    await expect(
      panel.getByText('Impact trace saved.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await panel.getByText('Open saved trace', { exact: true }).click();
    await expect(panel).toContainText(
      'Keep the recorded holding and goal unchanged',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const back = panel.getByRole('link', { name: 'Back to my overview' });
    await back.focus();
    await back.press('Enter');
    await expect(page).toHaveURL(/#overview$/);
  } finally {
    await fixture.reviewer.dispose();
  }
});
