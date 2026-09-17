import { test, expect } from '../../helpers/app-fixture';
import { indiaActors, indiaMacroInput } from '../../helpers/india-macro';
import { flowInput } from '../../helpers/institutional-flows';
import { positioningInput } from '../../helpers/participant-positioning';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1590 India original form resets changed permission and actually retains independently publishes withdraws @SRC-007 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indiaMacroInput();
    await sourceOpsBrowser(page, request, feedbackSandbox, 'India macro');
    let region = page.getByRole('region', {
      name: 'India macro onboarding',
      exact: true,
    });
    await region.getByLabel('Original source URL').fill(input.releaseUrl);
    await region.getByLabel('Original source file').setInputFiles({
      name: 'synthetic-cpi.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.releaseHtml),
    });
    await region.getByLabel('MoSPI API JSON').fill(input.apiBody);
    await region
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence);
    const confirmation = region.getByRole('checkbox', {
      name: 'I verified attribution, display, retention and offline usage rights.',
    });
    await confirmation.check();
    await region
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence + ' Changed scope.');
    await expect(confirmation).not.toBeChecked();
    await expect(
      region.getByRole('button', { name: 'Retain for independent review' }),
    ).toBeDisabled();
    await confirmation.check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/india-macro/import') &&
        r.request().method() === 'POST',
    );
    await region
      .getByRole('button', { name: 'Retain for independent review' })
      .click();
    expect((await saved).status()).toBe(201);
    await expect(
      region.getByRole('button', {
        name: 'Publish independently checked edition',
      }),
    ).toBeVisible();
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'India macro');
    region = page.getByRole('region', {
      name: 'India macro onboarding',
      exact: true,
    });
    await region
      .getByLabel('Independent review reason')
      .fill('Independent source and rights validation for simulated original.');
    await region
      .getByRole('button', { name: 'Publish independently checked edition' })
      .click();
    await expect(region.locator('article')).toContainText('publish');
    await region.getByRole('button', { name: 'Withdraw edition' }).click();
    await expect(region.locator('article')).toContainText('withdraw');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1591 institutional flow real form capture independent publish and withdrawal @SRC-010 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = await flowInput();
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Institutional activity',
    );
    let region = page.getByRole('region', {
      name: 'Institutional flow onboarding',
      exact: true,
    });
    await region.getByLabel('Original flow HTML').setInputFiles({
      name: 'synthetic-nse.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.body),
    });
    await region
      .getByLabel('Flow source permission evidence')
      .fill(input.rightsEvidence);
    await region
      .getByRole('checkbox', {
        name: 'Written permission covers original retention, display and offline distribution.',
      })
      .check();
    const capture = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/institutional-flows/capture') &&
        r.request().method() === 'POST',
    );
    await region.getByRole('button', { name: 'Retain flow capture' }).click();
    expect((await capture).status()).toBe(201);
    await expect(region).toContainText(
      'Original retained; independent review required.',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Institutional activity',
    );
    region = page.getByRole('region', {
      name: 'Institutional flow onboarding',
      exact: true,
    });
    await region
      .getByLabel('Flow independent review reason')
      .fill(
        'Independent review of simulated separate flow scopes and exact arithmetic.',
      );
    await region
      .getByRole('checkbox', {
        name: 'I independently checked the source, distinct dates, arithmetic and usage rights.',
      })
      .check();
    await region
      .getByRole('button', { name: 'Publish independently reviewed flows' })
      .click();
    await expect(region).toContainText('Status: publish');
    await region.getByRole('button', { name: 'Withdraw flow edition' }).click();
    await expect(region).toContainText('Status: withdraw');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1592 participant source form actual submit and independently reviewed publication @SRC-011 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = positioningInput();
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Participant positioning',
    );
    let region = page.getByRole('region', {
      name: 'Positioning source review',
      exact: true,
    });
    await region.getByLabel('Original participant OI CSV').setInputFiles({
      name: input.filename,
      mimeType: 'text/csv',
      buffer: Buffer.from(input.csv),
    });
    await region
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence);
    const check = region.getByRole('checkbox', {
      name: 'I have confirmed retention, display and offline rights for this source capture.',
    });
    await check.check();
    await region
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence + ' Revised.');
    await expect(check).not.toBeChecked();
    await check.check();
    const capture = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/positioning/capture') &&
        r.request().method() === 'POST',
    );
    await region
      .getByRole('button', { name: 'Retain positioning capture' })
      .click();
    expect((await capture).status()).toBe(201);
    await expect(region).toContainText(
      'Original capture retained for independent review.',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Participant positioning',
    );
    region = page.getByRole('region', {
      name: 'Positioning source review',
      exact: true,
    });
    await region
      .getByLabel('Independent review reason')
      .fill(
        'Independent exact simulated participant counts and original rights reviewed.',
      );
    await region
      .getByRole('checkbox', {
        name: 'I independently checked source identity, totals and source-specific rights.',
      })
      .check();
    await region
      .getByRole('button', { name: 'Publish positioning', exact: true })
      .click();
    await expect(region).toContainText('Status: publish');
    await region
      .getByRole('button', { name: 'Withdraw positioning', exact: true })
      .click();
    await expect(region).toContainText('Status: withdraw');
  } finally {
    await reviewer.dispose();
  }
});
