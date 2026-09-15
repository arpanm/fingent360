import { test, expect } from '../../helpers/event-fixture';
import { scenarioEventFixture } from '../../helpers/event-scenarios';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-1020 actual source scenario prepare publish read history and return navigation @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  const { event } = await scenarioEventFixture(request, feedbackSandbox);
  await context.addCookies(
    (await request.storageState()).cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.route(/\/api\/v1\/event-scenarios(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Event scenarios', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Event scenario preparation',
    exact: true,
  });
  await panel
    .getByLabel('Reviewed source event', { exact: true })
    .selectOption(event.id);
  await panel
    .getByLabel('Scenario family', { exact: true })
    .selectOption('regulatory');
  await panel
    .getByLabel('Editorial regulatory interpretation', { exact: true })
    .fill('Synthetic governance interpretation for actual retained evidence.');
  await panel
    .getByLabel('Scenario revision reason', { exact: true })
    .fill('Synthetic reviewed scenario acceptance.');
  await panel
    .getByRole('button', { name: 'Save scenario draft', exact: true })
    .click();
  await expect(
    panel.getByText('Scenario draft saved for independent review.', {
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByLabel('Publication review reason', { exact: true })
    .fill('Synthetic explicit source and interpretation review.');
  await panel
    .getByRole('button', { name: 'Publish scenario', exact: true })
    .click();
  await expect(
    panel.getByText('Scenario published.', { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole('link', { name: 'Open public scenario', exact: true })
    .click();
  const publicView = page.getByRole('region', {
    name: 'Reviewed event scenarios',
    exact: true,
  });
  await expect(publicView).toContainText('No numerical difference inferred');
  await publicView.getByText('Publication history', { exact: true }).click();
  await expect(publicView).toContainText('Edition 1');
  await publicView
    .getByRole('link', { name: 'Open reviewed event and context' })
    .click();
  await expect(page).toHaveURL(new RegExp('#events/' + event.id + '$'));
});
