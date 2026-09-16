import { test, expect } from '../../helpers/app-fixture';
import { rbiCalendarFixture } from '../../helpers/rbi-calendar';
test('E2E-WEB-1550 RBI day precision retained history keyboard and storage retry @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await rbiCalendarFixture(feedbackSandbox);
  await page.route('**/api/v1/research-calendar/rbi*', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#research-calendar');
  const region = page.getByRole('region', {
    name: 'RBI policy calendar',
    exact: true,
  });
  await expect(region).toContainText('Original schedule date: 2026-03-23');
  await region.getByLabel('Include earlier RBI meetings').check();
  await expect(region).toContainText('2026-04-06');
  const picker = region.getByLabel('RBI calendar capture');
  await picker.focus();
  await expect(picker).toBeFocused();
  await picker.selectOption({ index: 1 });
  await expect(region).toContainText('Day precision');
  await page.route(
    '**/api/v1/research-calendar/rbi*',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic RBI storage failure' }),
      }),
    { times: 1 },
  );
  await picker.selectOption('');
  await expect(region.getByRole('alert')).toContainText(
    'Synthetic RBI storage failure',
  );
  await region.getByRole('button', { name: 'Retry RBI calendar' }).click();
  await expect(region).toContainText('2026-04-06');
});
