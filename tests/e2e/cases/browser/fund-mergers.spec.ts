import { test, expect } from '../../helpers/app-fixture';
import { mergerFixture } from '../../helpers/fund-mergers';
import { retentionHeaders as headers } from '../../helpers/india-macro';
test.use({ namedOperators: true });
test('E2E-WEB-1900 actual reviewed merger appears in selected fund with distinct plans and unknown conversion @DEV-022 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await mergerFixture(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await f.reviewer.post(
          '/api/v1/ops/fund-mergers/' + f.input.requestId + '/review',
          { headers, data: f.review },
        )
      ).status(),
    ).toBe(201);
    await page.route(/\/api\/v1\/(funds|fund-mergers)(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#funds-bonds');
    await page
      .getByRole('button', { name: /HDFC Long Term Advantage/ })
      .click();
    const section = page.getByRole('region', { name: 'Fund merger lineage' });
    await expect(section).toContainText('2022-01-14');
    await expect(section).toContainText('108001');
    await expect(section).toContainText('108002');
    await expect(section).toContainText(
      'your holdings and cash flows are unchanged',
    );
    await section.getByText('Merger provenance', { exact: true }).click();
    await expect(section).toContainText('upload retrieval time unknown');
    await expect(
      section.getByRole('link', { name: 'Original HDFC merger notice' }),
    ).toHaveAttribute('href', /files.hdfcfund.com/);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-WEB-1901 actual Operations upload retains original and keeps mapping review separate @DEV-022 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { sourceOpsBrowser } = await import('../../helpers/source-ops-browser');
  const { syntheticMergerPdf } = await import('../../helpers/fund-mergers');
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Fund mergers');
  const region = page.getByRole('region', { name: 'Fund merger Operations' });
  await region
    .getByLabel('Merger retention permission', { exact: true })
    .fill('TEST-SIMULATION explicit source retention only.');
  await region
    .getByLabel('Original merger PDF', { exact: true })
    .setInputFiles({
      name: 'synthetic.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(syntheticMergerPdf, 'base64'),
    });
  await region
    .getByRole('checkbox', {
      name: 'I confirm this is the linked original notice and retention is permitted.',
    })
    .check();
  await region
    .getByRole('button', { name: 'Retain merger notice', exact: true })
    .click();
  await expect(region).toContainText('Status: draft');
  await expect(
    region.getByRole('button', {
      name: 'Publish reviewed merger',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    region.getByRole('button', {
      name: 'Inspect retained merger PDF',
      exact: true,
    }),
  ).toBeEnabled();
  await expect(region).toContainText(
    'not investor-level execution confirmation',
  );
});
