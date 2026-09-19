import { test, expect } from '../../helpers/equity-coverage';
import { crosswalkFixture } from '../../helpers/classification-crosswalk';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-WEB-1360 independent crosswalk reviewer inspects actual label publishes and reads history @SRC-006 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await crosswalkFixture(request, playwright, feedbackSandbox);
  try {
    await page.goto('/#ops');
    await page
      .getByLabel('Named operator username', { exact: true })
      .fill(fixture.credentials.username);
    await page
      .getByLabel('Named operator password', { exact: true })
      .fill(fixture.credentials.password);
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Sector mappings', exact: true })
      .click();
    const panel = page.getByRole('region', {
      name: 'Classification crosswalk operations',
      exact: true,
    });
    await panel
      .getByRole('button', {
        name: 'INE002A01018 → Synthetic application sector · version 1',
        exact: true,
      })
      .click();
    await expect(
      panel.getByLabel('Application sector', { exact: true }),
    ).toHaveValue('Synthetic application sector');
    await panel
      .getByLabel('Crosswalk independent review reason', { exact: true })
      .fill('Independent UI review of exact retained source mapping.');
    await panel
      .getByRole('button', { name: 'Publish crosswalk', exact: true })
      .click();
    await expect(
      panel.getByText('Crosswalk published.', { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'Open crosswalk history', exact: true })
      .click();
    await expect(panel).toContainText(
      'Version 1 · publish · Independent UI review',
    );
    await panel
      .getByRole('button', {
        name: 'Load admitted classifications',
        exact: true,
      })
      .click();
    await expect(
      panel.getByRole('combobox', {
        name: 'Exact provider classification',
        exact: true,
      }),
    ).toBeVisible();
    await panel
      .getByLabel('Classification company ISIN', { exact: true })
      .fill('INE009A01021');
    await expect(
      panel.getByRole('combobox', {
        name: 'Exact provider classification',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole('button', { name: 'Save crosswalk draft', exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await fixture.reviewer.dispose();
  }
});
