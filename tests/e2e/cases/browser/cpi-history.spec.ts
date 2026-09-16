import { randomUUID } from 'node:crypto';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
} from '../../helpers/cpi-expectations';
import {
  cpiHistoryInput,
  cpiHistoricalActualInput,
} from '../../helpers/cpi-history';
test.use({ namedOperators: true });
test('E2E-WEB-1850 historical model file selection independent review and reader show actual dated error @EVENT-SCENARIOS-001 @SOURCE-EXCERPT', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    model = cpiHistoryInput(),
    actual = cpiHistoricalActualInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/cpi-expectations/import', {
          headers: retentionHeaders,
          data: actual,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/cpi-expectations/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: actual.requestId,
            decision: 'publish',
            reason: 'Independent original BLS actual header inspection.',
          },
        })
      ).status(),
    ).toBe(201);
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'CPI model expectations',
    );
    let ops = page.getByRole('region', { name: 'CPI expectation operations' });
    await ops
      .getByRole('button', { name: 'Cleveland monthly archive', exact: true })
      .click();
    await ops.getByLabel('Historical CPI target month').fill('2025-01');
    await ops.getByLabel('Historical model vintage day').fill('2025-02-11');
    await ops.getByLabel('Original CPI HTML or JSON file').setInputFiles({
      name: 'cleveland-original-chart-excerpt.json',
      mimeType: 'application/json',
      buffer: Buffer.from(model.body),
    });
    await ops.getByLabel('CPI source permission scope').fill(model.rightsBasis);
    await ops.getByRole('checkbox').check();
    const receipt = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/cpi-expectations/import') &&
        r.request().method() === 'POST',
    );
    await ops
      .getByRole('button', { name: 'Retain CPI file', exact: true })
      .click();
    expect((await receipt).status()).toBe(201);
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'CPI model expectations',
    );
    ops = page.getByRole('region', { name: 'CPI expectation operations' });
    const article = ops
      .getByRole('article')
      .filter({ hasText: 'historical-model-nowcast' });
    await article.getByRole('button', { name: 'Inspect CPI original' }).click();
    await expect(ops.locator('pre')).toContainText('0.242424629147151');
    await ops.getByRole('button', { name: 'Close original' }).click();
    await ops
      .getByLabel('Expectation review reason')
      .fill(
        'Independent original chart vintage before actual release; no consensus claim.',
      );
    await article
      .getByRole('button', { name: 'Publish expectation', exact: true })
      .click();
    await expect(article).toContainText('published');
    await page.goto('/#research-calendar');
    const reader = page.getByRole('region', { name: 'CPI model comparisons' });
    await expect(reader).toContainText('Historical model vintage 2025-02-11');
    await expect(reader).toContainText(
      'Actual minus model: 0.257575370852849 percentage points.',
    );
    await expect(reader).toContainText('not market-consensus surprise');
  } finally {
    await reviewer.dispose();
  }
});
