import { test, expect } from '../../helpers/app-fixture';
import { indiaActors } from '../../helpers/india-macro';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  commodityFixtureUrl,
  commodityRights,
} from '../../helpers/commodity-benchmarks';
import { fileURLToPath } from 'node:url';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1710 actual commodity upload independent review monthly reader history evidence and withdrawal @SRC-009 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Commodities');
    let panel = page.getByRole('region', {
      name: 'Commodity benchmark operations',
    });
    await panel
      .getByLabel('Original World Bank workbook')
      .setInputFiles(fileURLToPath(commodityFixtureUrl));
    await panel
      .getByLabel('Retention, display and offline rights evidence')
      .fill(commodityRights);
    await panel
      .getByRole('checkbox', {
        name: 'I reviewed the World Bank dataset attribution and any third-party conditions for this original.',
      })
      .check();
    await panel
      .getByRole('button', { name: 'Capture commodity original' })
      .click();
    await expect(panel).toContainText('2026-09-02');
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'Commodities');
    panel = page.getByRole('region', {
      name: 'Commodity benchmark operations',
    });
    await panel
      .getByLabel('Independent review reason')
      .fill(
        'Independent original commodity precision and attribution reviewed.',
      );
    await panel
      .getByRole('checkbox', {
        name: 'I independently verified the original values and retention/display/offline rights.',
      })
      .check();
    await panel
      .getByRole('button', { name: 'Publish commodity capture' })
      .click();
    await expect(
      panel.getByText('publish · 2026-09-02', { exact: true }),
    ).toBeVisible();
    await page.route('**/api/v1/commodity-benchmarks**', (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await panel
      .getByRole('link', { name: 'Open reviewed monthly reader' })
      .click();
    const reader = page.getByRole('main', { name: 'Monthly commodities' });
    await expect(reader).toContainText('USD-per-troy-ounce');
    await expect(reader).toContainText('Method changed in June 2025');
    await expect(
      reader.getByRole('list', { name: 'Monthly source observations' }),
    ).toContainText('2026-08: 4411');
    await reader
      .getByRole('combobox', { name: 'Commodity', exact: true })
      .selectOption('COPPER');
    await expect(reader).toContainText('USD-per-metric-ton');
    await reader
      .getByRole('combobox', { name: 'Observation year', exact: true })
      .selectOption('2000');
    await expect(
      reader.getByRole('list', { name: 'Monthly source observations' }),
    ).toContainText('2000-01: 1844');
    await reader
      .getByText('Source and retained edition evidence', { exact: true })
      .click();
    await expect(
      reader.getByRole('button', { name: 'Download this retained original' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'Commodities');
    panel = page.getByRole('region', {
      name: 'Commodity benchmark operations',
    });
    await panel
      .getByLabel('Independent review reason')
      .fill('Independent publication withdrawal for current reader admission.');
    await panel
      .getByRole('button', { name: 'Withdraw commodity capture' })
      .click();
    await expect(
      panel.getByText('withdraw · 2026-09-02', { exact: true }),
    ).toBeVisible();
    await page.goto('/#commodities');
    await expect(
      page
        .getByRole('main', { name: 'Monthly commodities' })
        .getByRole('alert'),
    ).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1711 actual source schedule requires rights and can enable then pause without a provider run @SRC-009 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Automatic research',
    );
    const panel = page.getByRole('region', { name: 'Automatic research' });
    await panel
      .getByLabel(
        'RBI permission evidence for caching, display, internal links and offline distribution',
      )
      .fill('Synthetic RBI-only permission; never applies to another dataset.');
    await expect(
      panel.getByLabel(
        'Commodity dataset attribution and retention/display/offline evidence',
      ),
    ).toHaveValue('');
    await expect(
      panel.getByLabel('PIB and MoSPI GDP source permission evidence'),
    ).toHaveValue('');
    await panel
      .getByRole('button', { name: 'Enable commodity-benchmarks', exact: true })
      .click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel
      .getByLabel(
        'Commodity dataset attribution and retention/display/offline evidence',
      )
      .fill(commodityRights);
    await panel
      .getByRole('button', { name: 'Enable commodity-benchmarks', exact: true })
      .click();
    await expect(
      panel.getByRole('button', {
        name: 'Pause commodity-benchmarks',
        exact: true,
      }),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'Pause commodity-benchmarks', exact: true })
      .click();
    await expect(
      panel.getByRole('button', {
        name: 'Enable commodity-benchmarks',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
