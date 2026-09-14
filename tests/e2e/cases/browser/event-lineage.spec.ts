import { test, expect } from '../../helpers/event-fixture';
import { eventHeaders } from '../../helpers/event-fixture';
import { prepareLineage, saveLineage } from '../../helpers/event-lineage';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-830 guided merge review Back real application and replacement navigation @EVENT-LINEAGE-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const cookies = (await request.storageState()).cookies;
  await context.addCookies(
    cookies.map((cookie) => ({
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
    .getByRole('button', { name: 'Merge/split events', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Load current published event choices',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Synthetic original 0 · revision 2', { exact: true })
    .check();
  await page
    .getByLabel('Synthetic original 1 · revision 2', { exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Author replacement outputs', exact: true })
    .click();
  await page
    .getByLabel('Output 1 title', { exact: true })
    .fill('Synthetic UI consolidated context');
  await page
    .getByLabel('Public restructuring reason', { exact: true })
    .fill('Synthetic duplicate explanation reviewed through the UI.');
  await page
    .getByRole('button', { name: 'Review lineage plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to output editing', exact: true })
    .click();
  await expect(page.getByLabel('Output 1 title', { exact: true })).toHaveValue(
    'Synthetic UI consolidated context',
  );
  await page
    .getByRole('button', { name: 'Review lineage plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save immutable lineage plan', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Stored replacements', exact: true }),
  ).toContainText('Synthetic UI consolidated context');
  await page
    .getByRole('button', { name: 'Load saved lineage plans', exact: true })
    .click();
  await page.getByRole('button', { name: /^Open plan / }).click();
  await expect(
    page.getByRole('region', { name: 'Stored originals', exact: true }),
  ).toContainText(fixture.source.title);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', {
      name: 'Apply reviewed lineage in bootstrap mode',
      exact: true,
    })
    .click();
  await expect(page.getByText(/Applied merge at/)).toBeVisible();
  await page.goto('/#events/' + fixture.input.inputs[0]!.id);
  await page
    .getByRole('link', {
      name: 'Synthetic UI consolidated context',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic UI consolidated context',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Reviewed original context',
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', {
      name: 'This event has reviewed replacements',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('E2E-WEB-831 actual revoked operator clears saved lineage inspection on the next protected read @EVENT-LINEAGE-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const plan = await saveLineage(request, fixture.input);
  const cookies = (await request.storageState()).cookies;
  await context.addCookies(
    cookies.map((cookie) => ({
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
    .getByRole('button', { name: 'Merge/split events', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Load saved lineage plans', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open plan ' + plan.id, exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Stored replacements', exact: true }),
  ).toContainText('Synthetic merged context');
  expect(
    (
      await request.delete('/api/v1/ops/session', { headers: eventHeaders })
    ).ok(),
  ).toBe(true);
  const denial = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/ops/event-lineage/' + plan.id && response.status() === 401,
  );
  await page
    .getByRole('button', { name: 'Read application receipt', exact: true })
    .click();
  await denial;
  await expect(page.getByLabel('Operator key', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved lineage plan', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Synthetic merged context', { exact: true }),
  ).toHaveCount(0);
});
