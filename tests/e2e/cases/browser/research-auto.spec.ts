import { test, expect } from '../../helpers/app-fixture';
import { seedResearchCalendar } from '../../helpers/research-auto';
test('E2E-WEB-1053 actual retained release calendar supports retry and capture navigation @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedResearchCalendar(feedbackSandbox);
  await page.route('**/api/v1/research-calendar*', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#research-calendar');
  const region = page.getByRole('region', {
    name: 'Release calendar',
    exact: true,
  });
  await expect(region).toContainText('Synthetic release');
  await expect(region).toContainText('not original numerical data vintages');
  const picker = region.getByRole('combobox', {
    name: 'Calendar capture',
    exact: true,
  });
  await picker.selectOption({ index: 1 });
  await expect(region).toContainText('Source revision 2');
  await page.route(
    '**/api/v1/research-calendar*',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic calendar storage fault' }),
      }),
    { times: 1 },
  );
  await picker.selectOption('');
  await expect(region.getByRole('alert')).toContainText(
    'Synthetic calendar storage fault',
  );
  await region.getByRole('button', { name: 'Retry calendar' }).click();
  await expect(region).toContainText('Synthetic release');
  await region.getByRole('link', { name: 'Back to Today' }).click();
  await expect(page).toHaveURL(/#today$/);
});
test('E2E-WEB-1059 operator reviews explicit automatic publication policy scope and approval @RESEARCH-AUTO-002', async ({
  page,
  feedbackSandbox,
}) => {
  const { operatorKey } = await import('../../helpers/operator');
  await page.route('**/api/v1/ops/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Automatic research', exact: true })
    .click();
  const policy = page.getByRole('region', {
    name: 'Automatic news publication',
    exact: true,
  });
  await policy
    .getByRole('button', { name: 'Load publication policies' })
    .click();
  await policy
    .getByLabel(
      'I reviewed the source rights and existing/future draft publication scope',
    )
    .check();
  await policy
    .getByLabel('Review note')
    .fill(
      'Synthetic explicit official source rights and automatic publication review.',
    );
  await policy
    .getByRole('button', { name: 'Propose seven-day policy' })
    .click();
  await expect(policy).toContainText('awaits approval');
  await policy.getByRole('button', { name: /^Approve policy / }).click();
  await expect(policy).toContainText('Policy approved.');
});
