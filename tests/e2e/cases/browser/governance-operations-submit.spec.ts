import { test, expect } from '../../helpers/app-fixture';
import { oilEducationFixture } from '../../helpers/oil-education';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1593 governance browser creates source-bound draft simulates and independently releases then withdraws @DEV-015 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await oilEducationFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    await page.route('**/api/v1/events**', (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Research policies and causal review',
    );
    let region = page.getByRole('region', {
      name: 'Research governance',
      exact: true,
    });
    await region.getByRole('button', { name: 'New research draft' }).click();
    await region
      .getByLabel('Reviewed event', { exact: true })
      .selectOption(fixture.event.id);
    await region.getByRole('checkbox', { name: /Citation 1:/ }).check();
    await region
      .getByLabel('Research title')
      .fill('Browser-authored source-bound context');
    await region
      .getByLabel('Review by')
      .fill(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10));
    await region
      .getByLabel('Evidence and policy rationale')
      .fill(
        'Source reports incomplete fuel-cost pass-through, without numeric price or goal claims.',
      );
    await region.getByLabel('Reviewed sector').selectOption('Airlines');
    await region.getByLabel('Reviewed company').selectOption('INE646L01027');
    await region.getByLabel('Qualitative direction').selectOption('mixed');
    await region
      .getByLabel('Context horizon')
      .fill('Historical issuer disclosure');
    await region
      .getByLabel('Uncertainty and limitations')
      .fill(
        'Historical qualitative context only; current conditions and exact causality remain uncertain.',
      );
    const save = page.waitForResponse(
      (r) =>
        r.url().includes('/ops/research-governance/') &&
        r.request().method() === 'PUT',
    );
    await region.getByRole('button', { name: 'Save research draft' }).click();
    expect((await save).status()).toBe(200);
    await region
      .getByRole('button', { name: 'Simulate saved revision' })
      .click();
    await expect(region).toContainText('Simulation passed');
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Research policies and causal review',
    );
    region = page.getByRole('region', {
      name: 'Research governance',
      exact: true,
    });
    await region
      .getByRole('button', {
        name: 'Browser-authored source-bound context',
        exact: true,
      })
      .click();
    await region
      .getByLabel('Independent review reason')
      .fill('Independent review of exact source and qualitative limitations.');
    await region
      .getByRole('button', { name: 'Release research version' })
      .click();
    await expect(region).toContainText('Research version released.');
    await region
      .getByRole('button', { name: 'Withdraw research version' })
      .click();
    await expect(region).toContainText('Research version withdrawn.');
  } finally {
    await fixture.reviewer.dispose();
  }
});
