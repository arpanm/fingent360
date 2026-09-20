import { test, expect } from '../../helpers/app-fixture';
import {
  ccilLiquidityWorkbook,
  reviewLiquidity,
} from '../../helpers/ccil-liquidity';
import {
  governanceFixture,
  governanceHeaders,
} from '../../helpers/research-governance';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  activateObservationControl,
  tabToObservationControl,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';
import { CCIL_LIQUIDITY_URL } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, ccilLiquiditySimulation: true });
test('E2E-WEB-2320 actual liquidity file review source paging and reader work by keyboard at narrow width @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 800 });
  const actors = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'CCIL liquidity');
    const ops = page.getByRole('region', {
      name: 'CCIL liquidity Operations',
      exact: true,
    });
    await expect(
      ops.getByLabel('Import unchanged liquidity XLSX'),
    ).toBeEnabled();
    await tabToObservationControl(
      page,
      ops.getByLabel('Import unchanged liquidity XLSX'),
    );
    await ops.getByLabel('Import unchanged liquidity XLSX').setInputFiles({
      name: 'reconstructed-liquidity.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(ccilLiquidityWorkbook(26)),
    });
    await expect(ops.locator('article')).toContainText('draft');
    await expect(
      ops.getByRole('button', {
        name: 'Publish reviewed liquidity',
        exact: true,
      }),
    ).toBeDisabled();
    await sourceOpsBrowser(
      page,
      actors.reviewer,
      feedbackSandbox,
      'CCIL liquidity',
    );
    const reason = ops.getByLabel('Liquidity review reason');
    await tabToObservationControl(page, reason);
    await page.keyboard.insertText(
      'TEST-SIMULATION independent source rows and exact bytes reviewed.',
    );
    await activateObservationControl(
      page,
      ops.getByRole('button', {
        name: 'Publish reviewed liquidity',
        exact: true,
      }),
    );
    await expect(ops.locator('article')).toContainText('published');
    await activateObservationControl(
      page,
      ops.getByRole('button', { name: 'Next source rows', exact: true }),
    );
    await expect(ops).toContainText('showing 26–28');
    await activateObservationControl(
      page,
      ops.getByRole('button', { name: 'Previous source rows', exact: true }),
    );
    await expect(ops).toContainText('showing 1–25');
    await page.route(/\/api\/v1\/bond-liquidity(?:\?|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await page.goto('/#funds-bonds');
    const reader = page.getByRole('region', {
      name: 'Historical government-security liquidity',
      exact: true,
    });
    await expect(reader).toContainText('1.34254584763383E-3');
    await expect(reader).toContainText('not executable prices');
    await expect(
      reader.getByRole('link', { name: 'CCIL original liquidity workbook' }),
    ).toHaveAttribute('href', CCIL_LIQUIDITY_URL);
    await tabToObservationControl(
      page,
      reader.getByLabel('Find source security description'),
    );
    await page.keyboard.insertText('06.01 GS 2028');
    await expect(reader.locator('tbody tr')).toHaveCount(1);
    await expect(reader.locator('tbody')).toContainText(
      'No Orders on Bid/Ask Side',
    );
    await expect(
      reader
        .locator('tbody')
        .getByRole('cell', { name: 'Not reported', exact: true }),
    ).toHaveCount(7);
    await captureObservationLayout(
      page,
      reader,
      testInfo,
      'ccil-liquidity-historical-reader-360',
    );
    await sourceOpsBrowser(
      page,
      actors.reviewer,
      feedbackSandbox,
      'CCIL liquidity',
    );
    await tabToObservationControl(page, reason);
    await page.keyboard.insertText(
      'TEST-SIMULATION withdraw historical disclosure after review.',
    );
    await activateObservationControl(
      page,
      ops.getByRole('button', { name: 'Withdraw liquidity', exact: true }),
    );
    await expect(ops.locator('article')).toContainText('withdrawn');
    await page.goto('/#funds-bonds');
    await expect(reader).toContainText(
      'No reviewed liquidity disclosure is available.',
    );
  } finally {
    await actors.reviewer.dispose();
  }
});
test('E2E-WEB-2321 liquidity pending permissions and actual response loss recover without duplicate capture @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 800 });
  const actors = await governanceFixture(request, playwright, feedbackSandbox);
  let release = () => {};
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'CCIL liquidity');
    const ops = page.getByRole('region', {
      name: 'CCIL liquidity Operations',
      exact: true,
    });
    await expect(
      ops.getByRole('button', { name: 'Refresh liquidity queue' }),
    ).toBeEnabled();
    let mode: 'hold' | 'abort' | 'pass' = 'hold';
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = () => {};
    const reached = new Promise<void>((resolve) => {
      captured = resolve;
    });
    await page.route('**/api/v1/ops/bond-liquidity', async (route) => {
      if (mode === 'abort') {
        mode = 'pass';
        await route.abort('failed');
        return;
      }
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + '/api/v1/ops/bond-liquidity',
        headers: {
          ...(await route.request().allHeaders()),
          ...governanceHeaders,
        },
      });
      if (mode === 'hold') {
        captured();
        await held;
      }
      await route.fulfill({ response });
    });
    await page.reload();
    await page
      .getByRole('button', { name: 'CCIL liquidity', exact: true })
      .click();
    await reached;
    await expect(
      ops.getByLabel('Import unchanged liquidity XLSX'),
    ).toBeDisabled();
    await expect(
      ops.getByRole('button', {
        name: 'Fetch original July2026 liquidity workbook',
      }),
    ).toBeDisabled();
    mode = 'pass';
    release();
    await expect(ops).toContainText('No retained liquidity editions.');
    mode = 'abort';
    await activateObservationControl(
      page,
      ops.getByRole('button', { name: 'Refresh liquidity queue' }),
    );
    await expect(ops.getByRole('status')).toBeVisible();
    await activateObservationControl(
      page,
      ops.getByRole('button', { name: 'Refresh liquidity queue' }),
    );
    await expect(ops.getByRole('status')).toHaveCount(0);
    let lose = true;
    await page.route('**/api/v1/ops/bond-liquidity/import', async (route) => {
      if (!lose) {
        await route.continue({
          url: feedbackSandbox.apiOrigin + '/api/v1/ops/bond-liquidity/import',
          headers: {
            ...(await route.request().allHeaders()),
            ...governanceHeaders,
          },
        });
        return;
      }
      lose = false;
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + '/api/v1/ops/bond-liquidity/import',
        headers: {
          ...(await route.request().allHeaders()),
          ...governanceHeaders,
        },
      });
      expect(response.status()).toBe(201);
      await route.abort('failed');
    });
    const file = {
      name: 'reconstructed-liquidity.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(ccilLiquidityWorkbook()),
    };
    await ops.getByLabel('Import unchanged liquidity XLSX').setInputFiles(file);
    await expect(ops.getByRole('status')).toBeVisible();
    await expect(
      ops.getByLabel('Import unchanged liquidity XLSX'),
    ).toBeEnabled();
    await ops.getByLabel('Import unchanged liquidity XLSX').setInputFiles(file);
    await expect(ops.locator('article')).toHaveCount(1);
    await expect(ops.locator('article')).toContainText('draft');
    const queue = await (
      await request.get('/api/v1/ops/bond-liquidity')
    ).json();
    expect(queue.editions).toHaveLength(1);
    expect(queue.nextCursor).toBeNull();
    await captureObservationLayout(
      page,
      ops,
      testInfo,
      'ccil-liquidity-recovered-draft-360',
    );
    await reviewLiquidity(actors.reviewer, queue.editions[0].id);
    // Reader failure recovery uses the real approved response after one transport failure.
    let readerFail = true;
    await page.route('**/api/v1/bond-liquidity', (route) => {
      if (readerFail) {
        readerFail = false;
        return route.abort('failed');
      }
      return route.continue({
        url: feedbackSandbox.apiOrigin + '/api/v1/bond-liquidity',
      });
    });
    await page.goto('/#funds-bonds');
    const reader = page.getByRole('region', {
      name: 'Historical government-security liquidity',
      exact: true,
    });
    await expect(reader.getByRole('alert')).toBeVisible();
    await activateObservationControl(
      page,
      reader.getByRole('button', { name: 'Retry liquidity evidence' }),
    );
    await expect(reader).toContainText('05.74 GS 2026');
  } finally {
    release();
    await actors.reviewer.dispose();
  }
});
