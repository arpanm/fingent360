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
test('E2E-WEB-1330 released source mapping previews and saves actual six-step owned trace @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
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
  );
  try {
    const id = randomUUID(),
      draft = {
        ...fixture.input,
        requestId: randomUUID(),
        title: 'Synthetic released company context',
        content: {
          kind: 'causal-context',
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
