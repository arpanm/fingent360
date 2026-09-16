import { test, expect } from '../../helpers/app-fixture';
import { analyticalScenarioFixture } from '../../helpers/analytical-reader';
import { routeConnectionReading } from '../../helpers/research-connection-fixture';
test('E2E-WEB-1500 analytical reading exposes reviewed arithmetic, historical limits and connected scenario navigation @DEV-016 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const fixture = await analyticalScenarioFixture(request, feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.route('**/api/v1/event-scenarios/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#read/' + fixture.source.id);
  const layers = page.getByRole('region', { name: 'Explanation layers' });
  await layers
    .getByText('Analytical — evidence and limits', { exact: true })
    .click();
  const scenario = layers.getByRole('article', { name: 'Reviewed scenario' });
  await expect(scenario).toContainText('-0.5');
  await expect(scenario).toContainText('Historical evidence');
  await expect(scenario).toContainText('No portfolio or goal change');
  await expect(
    scenario.getByRole('link', { name: /source edition 1/ }),
  ).toHaveCount(2);
  await scenario
    .getByRole('link', { name: 'Open reviewed scenario', exact: true })
    .focus();
  await scenario
    .getByRole('link', { name: 'Open reviewed scenario', exact: true })
    .press('Enter');
  await expect(page).toHaveURL(
    new RegExp('#event-scenarios/' + fixture.scenario.id),
  );
});
