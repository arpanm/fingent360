import { transmissionFor } from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders as headers,
} from '../../helpers/research-governance';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-WEB-1700 released transmission mechanism previews and saves actual six-step owned trace @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(
    request,
    playwright,
    feedbackSandbox,
    true,
    'earnings',
  );
  try {
    const id = randomUUID(),
      draft = {
        ...fixture.input,
        requestId: randomUUID(),
        title: 'Synthetic released company context',
        content: {
          kind: 'causal-context',
          transmission: transmissionFor('earnings'),
          sector: 'Synthetic sector',
          isin: 'INE002A01018',
          direction: 'mixed',
          horizon: 'Over the next year',
          limitations: 'Synthetic context with uncalibrated numerical effects.',
          quantifiedImpact: null,
        },
      };
    expect(
      (
        await request.put('/api/v1/ops/research-governance/' + id, {
          headers,
          data: draft,
        })
      ).status(),
    ).toBe(200);
    await releaseGovernanceFixture(request, { ...fixture, id });
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await prepareConnectionBrowser(page);
    await page.goto('/#impact-traces');
    const panel = page.getByRole('region', {
      name: 'Impact traces',
      exact: true,
    });
    await panel
      .getByLabel('Reviewed event', { exact: true })
      .selectOption(fixture.eventId);
    await panel
      .getByLabel('Reviewed sector', { exact: true })
      .selectOption('Synthetic sector');
    await panel
      .getByLabel('Company in your holdings', { exact: true })
      .selectOption('INE002A01018');
    await panel
      .getByLabel('Your goal', { exact: true })
      .selectOption({ label: 'Synthetic research goal' });
    await panel
      .getByLabel('Independently released causal context', { exact: true })
      .selectOption(id);
    await panel
      .getByRole('button', { name: 'Review impact trace', exact: true })
      .click();
    const review = panel.getByRole('region', {
      name: 'Impact trace review',
      exact: true,
    });
    await expect(review).toContainText('mixed over Over the next year');
    await expect(
      review.getByRole('region', { name: 'Reviewed transmission conclusion' }),
    ).toContainText('Holding unchanged. Goal unchanged.');
    await expect(review).toContainText('Reported profit and cash generation');
    await review.getByRole('checkbox').check();
    await review
      .getByRole('button', { name: 'Save impact trace', exact: true })
      .click();
    await expect(
      panel.getByText('Impact trace saved.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await panel.getByText('Open saved trace', { exact: true }).click();
    await expect(panel).toContainText(
      'Synthetic context with uncalibrated numerical effects.',
    );
  } finally {
    await fixture.reviewer.dispose();
  }
});

test('E2E-WEB-1702 Operations saves an explicit compatible transmission catalog binding @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(
    request,
    playwright,
    feedbackSandbox,
    true,
    'earnings',
  );
  try {
    // Governance loads public evidence as well as protected Operations data.
    // Both must belong to the same real isolated fixture.
    await page.route(/\/api\/v1\/events(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    const { sourceOpsBrowser } =
      await import('../../helpers/source-ops-browser');
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Research policies and causal review',
    );
    const panel = page.getByRole('region', {
      name: 'Research governance',
      exact: true,
    });
    await panel
      .getByRole('button', { name: 'New research draft', exact: true })
      .click();
    const reviewedEvent = panel.getByLabel('Reviewed event', { exact: true });
    await expect(
      reviewedEvent.locator(`option[value="${fixture.eventId}"]`),
    ).toHaveCount(1);
    await reviewedEvent.selectOption(fixture.eventId);
    await panel.getByRole('checkbox').check();
    await panel
      .getByLabel('Research title', { exact: true })
      .fill('Synthetic catalog earnings channel');
    await panel
      .getByLabel('Review by', { exact: true })
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    await panel
      .getByLabel('Evidence and policy rationale', { exact: true })
      .fill(
        'Synthetic source-based company cash generation and earnings interpretation.',
      );
    await panel
      .getByLabel('Transmission mechanism', { exact: true })
      .selectOption('earnings');
    await expect(
      panel.getByRole('link', { name: 'Primary mechanism reference' }),
    ).toHaveAttribute('href', transmissionFor('earnings')!.reference);
    await panel
      .getByLabel('Reviewed sector', { exact: true })
      .selectOption('Synthetic sector');
    await panel
      .getByLabel('Reviewed company', { exact: true })
      .selectOption('INE002A01018');
    await panel
      .getByLabel('Context horizon', { exact: true })
      .fill('Next reporting period');
    await panel
      .getByLabel('Uncertainty and limitations', { exact: true })
      .fill('No quantified response or causal coefficient is established.');
    const saved = page.waitForResponse(
      (r) =>
        r.url().includes('/ops/research-governance/') &&
        r.request().method() === 'PUT',
    );
    await panel
      .getByRole('button', { name: 'Save research draft', exact: true })
      .click();
    const response = await saved;
    expect(response.status()).toBe(200);
    expect((await response.json()).input.content.transmission.family).toBe(
      'earnings',
    );
    await expect(panel).toContainText(
      'Draft saved. Simulate this version before independent review.',
    );
  } finally {
    await fixture.reviewer.dispose();
  }
});
