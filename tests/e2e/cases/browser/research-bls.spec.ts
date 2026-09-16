import { test, expect } from '../../helpers/app-fixture';
import { seedBlsCalendar } from '../../helpers/research-bls';
import { seedResearchCalendar } from '../../helpers/research-auto';
test('E2E-WEB-1070 calendar source switching clears editions and BLS history retries @RESEARCH-AUTO-002 @BLS-CALENDAR-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const hashes = await seedBlsCalendar(feedbackSandbox);
  await seedResearchCalendar(feedbackSandbox);
  await page.goto('/#research-calendar');
  const region = page.getByRole('region', {
    name: 'Release calendar',
    exact: true,
  });
  await expect(region).toContainText('Synthetic release');
  await region
    .getByLabel('Calendar source', { exact: true })
    .selectOption('bls-calendar');
  await expect(region).toContainText('Synthetic BLS release');
  await expect(
    region.getByRole('link', { name: 'Official BLS calendar' }),
  ).toHaveAttribute(
    'href',
    'https://www.bls.gov/schedule/news_release/bls.ics',
  );
  await region
    .getByLabel('Calendar capture', { exact: true })
    .selectOption(hashes[0]!);
  await expect(region).toContainText('Source revision 1');
  await region
    .getByLabel('Calendar source', { exact: true })
    .selectOption('bea-calendar');
  await expect(region).toContainText('Synthetic release');
  await expect(region).not.toContainText('Synthetic BLS release');
  await expect(
    region.getByLabel('Calendar capture', { exact: true }),
  ).toHaveValue('');
  await page.route(
    '**/api/v1/research-calendar?source=bls-calendar',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic unavailable calendar' }),
      }),
    { times: 1 },
  );
  await region
    .getByLabel('Calendar source', { exact: true })
    .selectOption('bls-calendar');
  await expect(region.getByRole('alert')).toContainText(
    'Synthetic unavailable calendar',
  );
  await region.getByRole('button', { name: 'Retry calendar' }).click();
  await expect(region).toContainText('Source revision 2');
});
