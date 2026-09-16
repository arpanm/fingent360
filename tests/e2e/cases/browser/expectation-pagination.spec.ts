import { test, expect, indiaActors } from '../../helpers/gdp-expectations';
import { seedExpectationQueue } from '../../helpers/expectation-pagination';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true });
for (const [id, domain, label, tab] of [
  [1624, 'gdp', 'GDP', 'GDP survey expectations'],
  [1673, 'cpi', 'CPI', 'CPI model expectations'],
] as const) {
  test(`E2E-WEB-${id} actual ${domain} Operations load older drafts and refresh resets page @EVENT-SCENARIOS-001 @TEST-SIMULATION`, async ({
    page,
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const reviewer = await indiaActors(request, playwright, feedbackSandbox);
    try {
      await seedExpectationQueue(domain, request, feedbackSandbox);
      await sourceOpsBrowser(page, request, feedbackSandbox, tab);
      const region = page.getByRole('region', {
        name: `${label} expectation operations`,
      });
      await expect(region.locator('article')).toHaveCount(25);
      for (const count of [50, 75, 100, 101]) {
        await region
          .getByRole('button', { name: 'Load older expectations' })
          .click();
        await expect(region.locator('article')).toHaveCount(count);
      }
      await expect(
        region.getByRole('button', { name: 'Load older expectations' }),
      ).toHaveCount(0);
      await region
        .getByRole('button', { name: 'Refresh expectation queue' })
        .click();
      await expect(region.locator('article')).toHaveCount(25);
      await expect(
        region.getByRole('button', { name: 'Load older expectations' }),
      ).toBeEnabled();
    } finally {
      await reviewer.dispose();
    }
  });
}
