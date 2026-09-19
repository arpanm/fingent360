import { test, expect } from '../../helpers/event-fixture';
import { companyEventFixture } from '../../helpers/company-event-pack';
for (const entry of [
  {
    id: '1394',
    button: 'Extract reported company revenue',
    expected: '3002',
    label: 'IFRS',
  },
  {
    id: '1395',
    button: 'Extract guidance upper bound',
    expected: 'Guided upper bound3',
    label: 'constant-currency',
  },
  {
    id: '1396',
    button: 'Extract FIU enforcement context',
    expected: 'Paytm Payments Bank Ltd',
    label: 'not a legal determination',
  },
])
  test(`E2E-WEB-${entry.id} original company/governance extraction saves reviews and opens public distinctions @EVENT-SCENARIOS-001 @TEST-SIMULATION`, async ({
    page,
    context,
    request,
    feedbackSandbox,
    baseURL,
  }) => {
    const event = await companyEventFixture(
      request,
      feedbackSandbox,
      entry.id === '1396',
    );
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
      .getByRole('combobox', { name: 'Reviewed source event', exact: true })
      .selectOption(event.id);
    await region
      .getByRole('button', { name: entry.button, exact: true })
      .click();
    await region
      .getByRole('button', { name: 'Save scenario draft', exact: true })
      .click();
    await expect(region).toContainText(
      'Scenario draft saved for independent review.',
    );
    await region
      .getByLabel('Publication review reason', { exact: true })
      .fill(
        'Original source, company/regulator identity, basis and period reviewed.',
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
    await expect(publicView).toContainText(
      entry.id === '1395' ? /Guided upper bound\s*3/ : entry.expected,
    );
    await expect(publicView).toContainText(entry.label);
  });
