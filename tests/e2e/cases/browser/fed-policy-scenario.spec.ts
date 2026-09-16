import { test, expect } from '../../helpers/event-fixture';
import { fedPolicyScenarioFixture } from '../../helpers/fed-policy-scenario';
test('E2E-WEB-1260 reviewed historical Fed bound extraction feeds real save publish and public explanation @FED-POLICY-PACK-001 @EVENT-SCENARIOS-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  const event = await fedPolicyScenarioFixture(request, feedbackSandbox);
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
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Event scenarios', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'Event scenario preparation',
    exact: true,
  });
  await region
    .getByLabel('Reviewed source event', { exact: true })
    .selectOption(event.id);
  await region
    .getByRole('button', { name: 'Extract FOMC lower bound', exact: true })
    .click();
  await expect(region).toContainText('Official FOMC values filled');
  await region
    .getByRole('button', { name: 'Save scenario draft', exact: true })
    .click();
  await expect(region).toContainText(
    'Scenario draft saved for independent review.',
  );
  await expect(region).toContainText('4-3/4');
  await region
    .getByLabel('Publication review reason', { exact: true })
    .fill(
      'Historical official target-range and exact fraction conversion reviewed.',
    );
  await region
    .getByRole('button', { name: 'Publish scenario', exact: true })
    .click();
  await expect(region).toContainText('Scenario published.');
  await region
    .getByRole('link', { name: 'Open public scenario', exact: true })
    .click();
  const publicView = page.getByRole('region', {
    name: 'Reviewed event scenarios',
    exact: true,
  });
  await expect(publicView).toContainText('-0.5');
  await expect(publicView).toContainText('exact quarter fractions');
  await expect(publicView).toContainText('not a consensus surprise');
});
