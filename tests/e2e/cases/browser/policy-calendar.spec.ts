import { test, expect } from '../../helpers/app-fixture';
import { policyCalendarFixture } from '../../helpers/policy-calendar';
test('E2E-WEB-1440 retained FOMC calendar exposes day precision keyboard history and retry on desktop and mobile @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await policyCalendarFixture(feedbackSandbox);
  await page.route('**/api/v1/research-calendar/policy*', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#research-calendar');
  const region = page.getByRole('region', {
    name: 'FOMC policy calendar',
    exact: true,
  });
  await expect(region).toContainText(
    'Exact announcement times are not supplied',
  );
  await region.getByLabel('Policy meeting period').selectOption('all');
  await expect(region).toContainText('2024-04-30');
  await expect(
    region
      .getByRole('link', { name: 'Read original policy statement' })
      .first(),
  ).toHaveAttribute(
    'href',
    'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240501a.htm',
  );
  const picker = region.getByLabel('Policy calendar capture');
  await picker.focus();
  await expect(picker).toBeFocused();
  await picker.selectOption({ index: 1 });
  await expect(region).toContainText('FOMC notation vote');
  await page.route(
    '**/api/v1/research-calendar/policy*',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic policy storage failure' }),
      }),
    { times: 1 },
  );
  await picker.selectOption('');
  await expect(region.getByRole('alert')).toContainText(
    'Synthetic policy storage failure',
  );
  await region.getByRole('button', { name: 'Retry policy calendar' }).click();
  await expect(region).toContainText('2024-04-30');
});
