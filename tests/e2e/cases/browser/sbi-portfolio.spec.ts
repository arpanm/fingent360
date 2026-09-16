import { test, expect } from '../../helpers/app-fixture';
import { publishedSbiFixture } from '../../helpers/sbi-portfolio-flow';
test.use({ namedOperators: true });
test('E2E-WEB-1530 fund reader opens actual mapped disclosure with source discrepancy and separate derivative table @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await publishedSbiFixture(request, playwright, feedbackSandbox);
  try {
    await page.route(
      /\/api\/v1\/(funds|fund-lookthrough)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await page.goto('/#funds-bonds');
    await page.getByRole('button', { name: /SBI Contra Fund/ }).click();
    const disclosure = page.getByRole('region', {
      name: 'Fund portfolio disclosure',
    });
    await expect(disclosure).toContainText('Source discrepancy');
    await expect(disclosure).toContainText('2026-08-31');
    await disclosure.getByText(/Derivatives — separate from cash AUM/).click();
    await expect(disclosure).toContainText(
      'adding them to cash assets would double count',
    );
    await disclosure.getByText(/Inspect source discrepancies/).click();
    await expect(disclosure).toContainText('Row 153');
    await expect(
      disclosure.getByRole('link', { name: 'Original AMC disclosure' }),
    ).toHaveAttribute('href', /sbimf.com/);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-WEB-1531 fund disclosure history shows separately reviewed July options and August source @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { randomUUID } = await import('node:crypto');
  const { governanceHeaders: headers } =
    await import('../../helpers/research-governance');
  const { syntheticSbiJulyWorkbook } =
    await import('../../helpers/sbi-portfolio-structural');
  const { SBI_PORTFOLIO_JULY_URL } =
    await import('../../../../packages/contracts/src/index');
  const f = await publishedSbiFixture(request, playwright, feedbackSandbox);
  try {
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/fund-lookthrough/import', {
          headers,
          data: {
            requestId: id,
            sourceUrl: SBI_PORTFOLIO_JULY_URL,
            permissionReference: 'Synthetic isolated archive permission.',
            body: Buffer.from(syntheticSbiJulyWorkbook()).toString('base64'),
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await f.reviewer.post(`/api/v1/ops/fund-lookthrough/${id}/review`, {
          headers,
          data: {
            requestId: randomUUID(),
            decision: 'publish',
            schemeCode: '108001',
            reason: 'Independent synthetic July archive mapping.',
            acknowledgeDiscrepancy: true,
          },
        })
      ).status(),
    ).toBe(201);
    await page.route(
      /\/api\/v1\/(funds|fund-lookthrough)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await page.goto('/#funds-bonds');
    await page.getByRole('button', { name: /SBI Contra Fund/ }).click();
    const region = page.getByRole('region', {
      name: 'Fund portfolio disclosure',
    });
    await expect(region).toContainText('2026-07-31');
    await expect(region).toContainText('2026-08-31');
    const july = region.getByRole('article').filter({
      has: page
        .getByRole('link', { name: 'Original AMC disclosure' })
        .and(page.locator(`a[href="${SBI_PORTFOLIO_JULY_URL}"]`)),
    });
    await july.getByText('stock-options (1)', { exact: true }).click();
    await expect(july).toContainText('Synthetic CALL Option');
    await expect(july).toContainText('less than 0.005%');
  } finally {
    await f.reviewer.dispose();
  }
});
