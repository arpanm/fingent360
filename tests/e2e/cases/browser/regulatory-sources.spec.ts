import { test, expect } from '../../helpers/app-fixture';
import {
  regulatoryFixture,
  regulatoryReview,
  syntheticRegulatoryHtml,
} from '../../helpers/regulatory-sources';
import { governanceHeaders as headers } from '../../helpers/research-governance';
test.use({ namedOperators: true, regulatorySimulation: true });
test('E2E-WEB-1680 actual regulatory library shows original provenance and unknown effective date @SRC-014 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await regulatoryFixture(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await f.reviewer.post(`/api/v1/ops/regulatory-sources/${f.id}/review`, {
          headers,
          data: regulatoryReview(),
        })
      ).status(),
    ).toBe(201);
    await page.route('**/api/v1/regulatory-sources**', (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#regulatory-sources');
    const library = page.getByRole('region', {
      name: 'Regulatory source library',
    });
    await library
      .getByText('Synthetic tax source annotation · published', { exact: true })
      .click();
    await expect(library).toContainText('Not established');
    await expect(library).toContainText(f.edition.hash);
    await expect(
      library.getByRole('link', { name: 'Open original authority document' }),
    ).toHaveAttribute('href', f.input.metadata.sourceUrl);
    await library.getByLabel('Search rule sources').fill('no-such-source');
    await expect(library).toContainText('No reviewed sources match');
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-WEB-1681 actual Operations form retains unchanged bytes and leaves independent review pending @SRC-014 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Regulatory originals', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'Regulatory source Operations',
  });
  await region
    .getByRole('combobox', { name: 'Authority', exact: true })
    .selectOption('income-tax');
  await region
    .getByLabel('Document key', { exact: true })
    .fill('synthetic-ui-registry');
  await region
    .getByLabel('Source title', { exact: true })
    .fill('Synthetic UI original');
  await region
    .getByLabel('Original authority URL')
    .fill(
      'https://www.incometax.gov.in/iec/foportal/using-the-portal/webSitePolicies',
    );
  await region
    .getByLabel('Indian jurisdiction and scope')
    .fill('Synthetic India source scope.');
  await region
    .getByLabel('Editorial summary')
    .fill('Synthetic annotation solely for independent source review.');
  await region
    .getByLabel('Date evidence and page/paragraph locator')
    .fill('Synthetic original has no stated effective date.');
  await region
    .getByLabel('Editorial review by')
    .fill(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10));
  await region
    .getByLabel('Document-specific retention and display permission')
    .fill('Synthetic test-only retention permission.');
  await region
    .getByRole('combobox', { name: 'Original format', exact: true })
    .selectOption('text/html');
  await region.getByLabel('Unchanged original file').setInputFiles({
    name: 'synthetic.html',
    mimeType: 'text/html',
    buffer: Buffer.from(syntheticRegulatoryHtml),
  });
  await region.getByLabel('Original retrieved at').fill('2026-09-01T12:00');
  await region.getByRole('button', { name: 'Retain original upload' }).click();
  await expect(region).toContainText('Synthetic UI original · draft');
  await expect(
    region.getByRole('button', { name: 'Publish reviewed source' }),
  ).toBeDisabled();
});
test('E2E-WEB-1682 late actual historical source response cannot replace a newer current-only view @SRC-014 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await regulatoryFixture(request, playwright, feedbackSandbox);
  let release!: () => void, seen!: () => void;
  const blocked = new Promise<void>((resolve) => {
      release = resolve;
    }),
    arrived = new Promise<void>((resolve) => {
      seen = resolve;
    });
  try {
    expect(
      (
        await f.reviewer.post(`/api/v1/ops/regulatory-sources/${f.id}/review`, {
          headers,
          data: regulatoryReview(),
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await f.reviewer.post(`/api/v1/ops/regulatory-sources/${f.id}/review`, {
          headers,
          data: { ...regulatoryReview(), decision: 'withdraw' },
        })
      ).status(),
    ).toBe(201);
    await page.route('**/api/v1/regulatory-sources**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('history') === 'true') {
        const response = await route.fetch({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
        seen();
        await blocked;
        await route.fulfill({ response });
      } else
        await route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
    });
    await page.goto('/#regulatory-sources');
    const library = page.getByRole('region', {
        name: 'Regulatory source library',
      }),
      toggle = library.getByRole('checkbox', {
        name: 'Include previously published history',
      });
    await expect(library).toContainText('No reviewed sources match');
    await toggle.check();
    await arrived;
    await toggle.uncheck();
    await expect(
      library.getByRole('button', { name: 'Refresh source library' }),
    ).toBeEnabled();
    const late = page.waitForResponse((response) =>
      response.url().includes('history=true'),
    );
    release();
    await (await late).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      library.getByText('Synthetic tax source annotation · withdrawn', {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(toggle).not.toBeChecked();
  } finally {
    release();
    await f.reviewer.dispose();
  }
});
