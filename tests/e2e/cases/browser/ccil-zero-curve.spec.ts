import { test, expect } from '../../helpers/app-fixture';
import { governanceFixture } from '../../helpers/research-governance';
import {
  ccilZeroHtml,
  ccilZeroPointsHtml,
} from '../../helpers/ccil-zero-curve';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, ccilZeroSimulation: true });
test('E2E-WEB-1970 actual original NSS file capture independent review and model reader @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'CCIL NSS');
    const ops = page.getByRole('region', { name: 'CCIL NSS Operations' });
    await ops.getByLabel('Import unchanged NSS HTML').setInputFiles({
      name: 'reconstructed-nss.html',
      mimeType: 'text/html',
      buffer: Buffer.from(ccilZeroHtml()),
    });
    await expect(ops.locator('article')).toContainText('draft');
    await sourceOpsBrowser(page, f.reviewer, feedbackSandbox, 'CCIL NSS');
    await ops
      .getByLabel('NSS review reason')
      .fill('Independent original coefficients and dates reviewed.');
    await ops
      .getByRole('button', { name: 'Publish reviewed NSS parameters' })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.route('**/api/v1/bond-zero-curve', (route) =>
      route.continue({
        url: feedbackSandbox.apiOrigin + '/api/v1/bond-zero-curve',
      }),
    );
    await page.goto('/#funds-bonds');
    const reader = page.getByRole('region', {
      name: 'Sovereign curve model parameters',
    });
    await expect(reader).toContainText('-15.8059');
    await expect(reader).toContainText('not executable prices');
    await expect(
      reader.getByRole('link', { name: 'CCIL original NSS parameters' }),
    ).toHaveAttribute('href', 'https://www.ccilindia.com/en/zcyc-parameters');
  } finally {
    await f.reviewer.dispose();
  }
});

test('E2E-WEB-1971 actual original point file capture independent review and source-label reader @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'CCIL NSS');
    const ops = page.getByRole('region', { name: 'CCIL NSS Operations' });
    await ops
      .getByLabel('CCIL curve source')
      .selectOption('https://www.ccilindia.com/en/zero-rates');
    await ops.getByLabel('Import unchanged NSS HTML').setInputFiles({
      name: 'reconstructed-nss.html',
      mimeType: 'text/html',
      buffer: Buffer.from(await ccilZeroPointsHtml()),
    });
    await expect(ops.locator('article')).toContainText('draft');
    await sourceOpsBrowser(page, f.reviewer, feedbackSandbox, 'CCIL NSS');
    await ops
      .getByLabel('NSS review reason')
      .fill('Independent original coefficients and dates reviewed.');
    await ops
      .getByRole('button', { name: 'Publish reviewed NSS parameters' })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.route('**/api/v1/bond-zero-curve', (route) =>
      route.continue({
        url: feedbackSandbox.apiOrigin + '/api/v1/bond-zero-curve',
      }),
    );
    await page.goto('/#funds-bonds');
    const reader = page.getByRole('region', {
      name: 'Sovereign curve model parameters',
    });
    await reader
      .getByText('Reported curve points · 2026-09-11', { exact: true })
      .click();
    await expect(
      reader.getByRole('cell', { name: '7.11', exact: true }),
    ).toBeVisible();
    await expect(reader).toContainText(
      'does not declare maturity units or compounding',
    );
    await expect(reader).toContainText('not executable prices');
    await expect(
      reader.getByRole('link', { name: 'CCIL original zero-rate points' }),
    ).toHaveAttribute('href', 'https://www.ccilindia.com/en/zero-rates');
  } finally {
    await f.reviewer.dispose();
  }
});

test('E2E-WEB-1975 actual101 edition capture history navigates Older and Back while reader remains usable @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { publishedCcilZeroFixture, ccilZeroVolume } =
    await import('../../helpers/ccil-zero-curve');
  const f = await publishedCcilZeroFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    await ccilZeroVolume(feedbackSandbox, f.id);
    await sourceOpsBrowser(page, request, feedbackSandbox, 'CCIL NSS');
    const ops = page.getByRole('region', { name: 'CCIL NSS Operations' });
    await expect(ops.locator('article')).toHaveCount(30);
    for (let i = 0; i < 3; i++)
      await ops
        .getByRole('button', { name: 'Older captures', exact: true })
        .click();
    await expect(ops.locator('article')).toHaveCount(11);
    await expect(
      ops.getByRole('button', { name: 'Older captures', exact: true }),
    ).toBeDisabled();
    await ops
      .getByRole('button', { name: 'Previous captures', exact: true })
      .click();
    await expect(ops.locator('article')).toHaveCount(30);
    await page.route(/\/api\/v1\/bond-zero-curve(?:\?|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#funds-bonds');
    const reader = page.getByRole('region', {
      name: 'Sovereign curve model parameters',
    });
    await expect(
      reader.getByRole('button', { name: 'Older history' }),
    ).toBeEnabled();
    await reader.getByRole('button', { name: 'Older history' }).click();
    await expect(
      reader.getByRole('button', { name: 'Previous history' }),
    ).toBeEnabled();
    await reader.getByRole('button', { name: 'Previous history' }).click();
    await expect(
      reader.getByRole('button', { name: 'Previous history' }),
    ).toBeDisabled();
  } finally {
    await f.reviewer.dispose();
  }
});
