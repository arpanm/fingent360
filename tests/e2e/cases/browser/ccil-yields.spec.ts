import { test, expect } from '../../helpers/app-fixture';
import { publishedCcilFixture } from '../../helpers/ccil-yields';
test.use({ namedOperators: true, ccilSimulation: true });
test('E2E-WEB-1570 retained government yield context opens source and separates auction cutoffs from benchmarks @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await publishedCcilFixture(request, playwright, feedbackSandbox);
  try {
    await page.route('**/api/v1/bond-yields', (route) =>
      route.continue({
        url: feedbackSandbox.apiOrigin + '/api/v1/bond-yields',
      }),
    );
    await page.goto('/#funds-bonds');
    const region = page.getByRole('region', {
      name: 'Government bond yield context',
    });
    await expect(region).toContainText('2026-09-11');
    await expect(region).toContainText('Primary auction cutoff');
    await expect(region).toContainText('Indicative benchmark');
    await expect(
      region.getByRole('link', { name: 'CCIL original indicative yields' }),
    ).toHaveAttribute(
      'href',
      'https://www.ccilindia.com/web/ccil/tenorwise-indicative-yields',
    );
    await expect(region).toContainText('not executable prices');
  } finally {
    await f.reviewer.dispose();
  }
});
