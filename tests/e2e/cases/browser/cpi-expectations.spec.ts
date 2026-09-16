import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  cpiNowcastInput,
} from '../../helpers/cpi-expectations';
test.use({ namedOperators: true });
test('E2E-WEB-1670 CPI reader shows model basis and missing actual without presenting consensus @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = cpiNowcastInput();
    expect(
      (
        await request.post('/api/v1/ops/cpi-expectations/import', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/cpi-expectations/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: input.requestId,
            decision: 'publish',
            reason: 'Independently inspected reconstructed source.',
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#research-calendar');
    const region = page.getByRole('region', { name: 'CPI model comparisons' });
    await expect(region).toContainText('2026-08: model 0.37%');
    await expect(region).toContainText('No reviewed BLS actual');
    await expect(region).toContainText(
      'publication year and time are not established',
    );
    const details = region.getByText('Snapshot provenance and limitations', {
      exact: true,
    });
    await details.focus();
    await details.press('Enter');
    await expect(region).toContainText(
      'A current page does not reconstruct a prior vintage.',
    );
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-WEB-1672 actual CPI capture and independent Operations review preserve source confirmation and withdrawal @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = cpiNowcastInput();
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'CPI model expectations',
    );
    let region = page.getByRole('region', {
      name: 'CPI expectation operations',
    });
    await region.getByLabel('Original CPI report URL').fill(data.url);
    await region.getByLabel('Original CPI HTML or JSON file').setInputFiles({
      name: 'synthetic-spf.html',
      mimeType: 'text/html',
      buffer: Buffer.from(data.body),
    });
    await region
      .getByLabel('CPI source permission scope')
      .fill(data.rightsBasis);
    const consent = region.getByRole('checkbox');
    await consent.check();
    await region
      .getByLabel('CPI source permission scope')
      .fill(data.rightsBasis + ' Revised explicit test-only scope.');
    await expect(consent).not.toBeChecked();
    const capture = region.getByRole('button', {
      name: 'Retain CPI file',
      exact: true,
    });
    await expect(capture).toBeDisabled();
    await consent.check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/cpi-expectations/import') &&
        r.request().method() === 'POST',
    );
    await capture.click();
    expect((await saved).status()).toBe(201);
    await expect(region).toContainText('model-nowcast: 2026-08 0.37%');
    await region
      .getByLabel('Expectation review reason')
      .fill(
        'Synthetic source author cannot independently publish their own capture.',
      );
    await region
      .getByRole('button', { name: 'Publish expectation', exact: true })
      .click();
    await expect(region.getByRole('alert')).toContainText(
      'Another named operator',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'CPI model expectations',
    );
    region = page.getByRole('region', { name: 'CPI expectation operations' });
    await region.getByRole('button', { name: 'Inspect CPI original' }).click();
    await expect(region.locator('pre')).toContainText(
      'Inflation, month-over-month percent change',
    );
    await region.getByRole('button', { name: 'Close original' }).click();
    await region
      .getByLabel('Expectation review reason')
      .fill(
        'Independent synthetic retained original and explicit permission scope review.',
      );
    await region
      .getByRole('button', { name: 'Publish expectation', exact: true })
      .click();
    await expect(region).toContainText(
      'model-nowcast: 2026-08 0.37% · published',
    );
    await region
      .getByRole('button', { name: 'Withdraw expectation', exact: true })
      .click();
    await expect(region).toContainText(
      'model-nowcast: 2026-08 0.37% · withdrawn',
    );
  } finally {
    await reviewer.dispose();
  }
});
