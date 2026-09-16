import { test, expect } from '../../helpers/app-fixture';
import { axisFixture } from '../../helpers/axis-portfolio-flow';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { syntheticAxisWorkbook } from '../../helpers/axis-portfolio';
import { AXIS_PORTFOLIO_URL } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-WEB-1720 actual Axis Operations upload independent mapping and fund reader retain original format @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await axisFixture(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Fund data');
    const panel = page.getByRole('region', {
      name: 'AMC portfolio Operations',
    });
    await panel
      .getByLabel('Verified original disclosure')
      .selectOption(AXIS_PORTFOLIO_URL);
    await panel
      .getByLabel('Portfolio retention permission reference')
      .fill(f.input.permissionReference);
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/fund-lookthrough/import') &&
        r.request().method() === 'POST',
    );
    await panel.getByLabel('Import original Axis workbook').setInputFiles({
      name: 'synthetic-axis.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(syntheticAxisWorkbook()),
    });
    expect((await saved).status()).toBe(201);
    await expect(panel).toContainText('2026-02-28');
    await sourceOpsBrowser(page, f.reviewer, feedbackSandbox, 'Fund data');
    await panel.getByLabel('Reviewed AMFI scheme code').fill('108001');
    await panel
      .getByLabel('Mapping and quality review reason')
      .fill(
        'Independent synthetic original source and exact AMFI scheme mapping approval.',
      );
    const reviewed = page.waitForResponse(
      (r) =>
        /\/ops\/fund-lookthrough\/[^/]+\/review$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await panel
      .getByRole('button', { name: 'Publish reviewed disclosure', exact: true })
      .click();
    expect((await reviewed).status()).toBe(201);
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
    await page.getByRole('button', { name: /Axis NIFTY 50 ETF/ }).click();
    const disclosure = page.getByRole('region', {
      name: 'Fund portfolio disclosure',
    });
    await expect(disclosure).toContainText('2026-02-28');
    await disclosure.getByText('equity (50)', { exact: true }).click();
    await expect(disclosure).toContainText('Synthetic equity 7');
    await disclosure.getByText('treps (1)', { exact: true }).click();
    await expect(
      disclosure.getByRole('table').filter({
        has: page.getByText('Synthetic clearing counterparty', {
          exact: true,
        }),
      }),
    ).toContainText('5.00');
    await expect(
      disclosure.getByRole('link', { name: 'Original AMC disclosure' }),
    ).toHaveAttribute('href', AXIS_PORTFOLIO_URL);
  } finally {
    await f.reviewer.dispose();
  }
});
