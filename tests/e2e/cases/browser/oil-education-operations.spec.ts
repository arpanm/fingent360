import { test, expect } from '../../helpers/app-fixture';
import { indiaActors } from '../../helpers/india-macro';
import { oilEducationInput } from '../../helpers/oil-education';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1472 actual oil Operations form captures source then independent UI review publishes and withdraws @DEV-010 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Oil disclosure');
    let region = page.getByRole('region', {
      name: 'Oil education source',
      exact: true,
    });
    const input = oilEducationInput();
    await region.getByLabel('Issuer HTML').setInputFiles({
      name: 'synthetic-issuer.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await region
      .getByLabel('Source permission record')
      .fill(input.rightsEvidence);
    await region
      .getByRole('checkbox', {
        name: 'Written permission covers retained original, display and offline use.',
      })
      .check();
    const capture = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/oil-education/capture') &&
        r.request().method() === 'POST',
    );
    await region
      .getByRole('button', { name: 'Retain oil disclosure', exact: true })
      .click();
    expect((await capture).status()).toBe(201);
    await expect(region).toContainText('Original report date 2026-04-01');
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'Oil disclosure');
    region = page.getByRole('region', {
      name: 'Oil education source',
      exact: true,
    });
    await region
      .getByLabel('Independent source review reason')
      .fill(
        'Independent actual-source review in isolated simulated permission test.',
      );
    await region
      .getByRole('checkbox', {
        name: 'I independently checked original issuer evidence and usage permission.',
      })
      .check();
    await region
      .getByRole('button', {
        name: 'Publish reviewed oil disclosure',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('link', { name: 'Read reviewed issuer report' }),
    ).toBeVisible();
    await region
      .getByRole('button', { name: 'Withdraw oil disclosure', exact: true })
      .click();
    await expect(
      region.getByRole('link', { name: 'Read reviewed issuer report' }),
    ).toHaveCount(0);
    await expect(region).toContainText('Status: withdraw');
  } finally {
    await reviewer.dispose();
  }
});
