import { test, expect } from '../../helpers/app-fixture';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
for (const scenario of [
  {
    id: 'E2E-WEB-1341',
    tab: 'Price normalization',
    region: 'Price adjustment review',
    label: 'Original company action CSV',
    name: 'synthetic.csv',
    type: 'text/csv',
    limit: 2000000,
    consent:
      'I checked complete company/date coverage, all source pages, every traded close and source-specific display/retention/offline permission.',
    submit: 'Prepare normalization receipt',
    tag: '@EQUITY-COVERAGE-001',
  },
  {
    id: 'E2E-WEB-1321',
    tab: 'India macro',
    region: 'India macro onboarding',
    label: 'Original source file',
    name: 'synthetic.html',
    type: 'text/html',
    limit: 5000000,
    consent:
      'I verified attribution, display, retention and offline usage rights.',
    submit: 'Retain for independent review',
    tag: '@SRC-007',
  },
] as const) {
  test(`${scenario.id} replacing source with oversized file clears previous bytes and consent ${scenario.tag} @UX-002G @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    await page.goto('/#ops');
    await page
      .getByLabel('Named operator username', { exact: true })
      .fill(feedbackSandbox.namedCredentials!.username);
    await page
      .getByLabel('Named operator password', { exact: true })
      .fill(feedbackSandbox.namedCredentials!.password);
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await page.getByRole('button', { name: scenario.tab, exact: true }).click();
    const panel = page.getByRole('region', {
      name: scenario.region,
      exact: true,
    });
    const file = panel.getByLabel(scenario.label, { exact: true });
    await file.setInputFiles({
      name: scenario.name,
      mimeType: scenario.type,
      buffer: Buffer.from(
        'TEST-SIMULATION source selection only; never submitted.',
      ),
    });
    const consent = panel.getByLabel(scenario.consent, { exact: true });
    await consent.check();
    await expect(
      panel.getByRole('button', { name: scenario.submit, exact: true }),
    ).toBeEnabled();
    await file.setInputFiles({
      name: scenario.name,
      mimeType: scenario.type,
      buffer: Buffer.alloc(scenario.limit + 1, 32),
    });
    await expect(panel.getByRole('alert')).toContainText(
      /exceeds|smaller than/,
    );
    await expect(consent).not.toBeChecked();
    await consent.check();
    await expect(
      panel.getByRole('button', { name: scenario.submit, exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
