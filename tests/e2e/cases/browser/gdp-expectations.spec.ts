import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  spfInput,
} from '../../helpers/gdp-expectations';
test.use({ namedOperators: true });
test('E2E-WEB-1620 published GDP survey median reader keeps publication capture and unavailable comparison explicit @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = spfInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/gdp-expectations/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/gdp-expectations/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: data.requestId,
            decision: 'publish',
            reason: 'Synthetic independently reviewed SPF source facts.',
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#research-calendar');
    const region = page.getByRole('region', {
      name: 'GDP forecast comparison',
    });
    await expect(region).toContainText('survey median 1.5%');
    await expect(region).toContainText('Source published 2025-05-16');
    await expect(region).toContainText('No reviewed BEA estimate');
    const details = region.getByText('Reconstruction and uncertainty', {
      exact: true,
    });
    await details.focus();
    await details.press('Enter');
    await expect(region).toContainText('A later capture never proves');
    await expect(
      region.getByRole('link', { name: 'Original SPF report' }),
    ).toHaveAttribute('href', data.url);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-WEB-1622 actual SPF capture and independent Operations review preserve source confirmation and withdrawal @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = spfInput();
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'GDP survey expectations',
    );
    let region = page.getByRole('region', {
      name: 'GDP expectation operations',
    });
    await region.getByLabel('Original SPF report URL').fill(data.url);
    await region.getByLabel('Original SPF HTML file').setInputFiles({
      name: 'synthetic-spf.html',
      mimeType: 'text/html',
      buffer: Buffer.from(data.body),
    });
    await region
      .getByLabel('SPF source permission scope')
      .fill(data.rightsBasis);
    const consent = region.getByRole('checkbox');
    await consent.check();
    await region
      .getByLabel('SPF source permission scope')
      .fill(data.rightsBasis + ' Revised explicit test-only scope.');
    await expect(consent).not.toBeChecked();
    const capture = region.getByRole('button', {
      name: 'Retain SPF file',
      exact: true,
    });
    await expect(capture).toBeDisabled();
    await consent.check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/gdp-expectations/import') &&
        r.request().method() === 'POST',
    );
    await capture.click();
    expect((await saved).status()).toBe(201);
    await expect(region).toContainText('2025-Q2: 1.5%');
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
      'GDP survey expectations',
    );
    region = page.getByRole('region', { name: 'GDP expectation operations' });
    await region.getByRole('button', { name: 'Inspect SPF original' }).click();
    await expect(region.locator('pre')).toContainText(
      'Synthetic layout reconstruction',
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
    await expect(region).toContainText('2025-Q2: 1.5% · published');
    await region
      .getByRole('button', { name: 'Withdraw expectation', exact: true })
      .click();
    await expect(region).toContainText('2025-Q2: 1.5% · withdrawn');
  } finally {
    await reviewer.dispose();
  }
});
