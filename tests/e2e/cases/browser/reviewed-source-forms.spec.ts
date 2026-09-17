import { test, expect } from '../../helpers/app-fixture';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  prepareCompanyNews,
  companyNewsInput,
} from '../../helpers/company-news';
import { crosswalkFixture } from '../../helpers/classification-crosswalk';
import {
  adjustmentActors,
  adjustmentInput,
} from '../../helpers/equity-adjustments';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1594 company news form retains two source proofs then independent reviewer publishes and withdraws @SRC-012 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await prepareCompanyNews(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = companyNewsInput(),
      title = 'Browser company report with original source proofs';
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Company news');
    let region = page.getByRole('region', {
      name: 'Company news onboarding',
      exact: true,
    });
    await region.getByText('Prepare a company report', { exact: true }).click();
    await region.getByLabel('Company ISIN', { exact: true }).fill(input.isin);
    await region.getByLabel('Report title').fill(title);
    await region.getByLabel('Original summary').fill(input.summary);
    await region
      .getByLabel('What did the independent evidence confirm?')
      .fill(input.verification);
    await region.getByLabel('Conflicting evidence').selectOption('none-found');
    for (const [index, row] of input.citations.entries()) {
      const group = region.getByRole('group', {
        name: 'Source ' + (index + 1),
        exact: true,
      });
      for (const [label, value] of [
        ['Source name', row.name],
        ['Original source URL', row.url],
        ['Original reporting organisation', row.originator],
        ['Rights terms URL', row.termsUrl],
        ['Permission evidence and scope', row.permissionReference],
      ])
        await group.getByLabel(label!, { exact: true }).fill(value!);
      await group
        .getByLabel('Publication time (UTC)')
        .fill(row.publishedAt.slice(0, 16));
      await group
        .getByLabel('Retrieved time (UTC)')
        .fill(row.retrievedAt.slice(0, 16));
      if (row.primary)
        await group
          .getByRole('checkbox', { name: 'Primary filing or release' })
          .check();
      await group
        .getByRole('checkbox', {
          name: 'Independent reporting, not a mirror or syndication',
        })
        .check();
    }
    await region
      .getByRole('checkbox', { name: /I checked every source permits linking/ })
      .check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/company-news/prepare') &&
        r.request().method() === 'POST',
    );
    await region
      .getByRole('button', { name: 'Retain draft for verification' })
      .click();
    expect((await saved).status()).toBe(201);
    await expect(region).toContainText('Draft retained.');
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Company news',
    );
    region = page.getByRole('region', {
      name: 'Company news onboarding',
      exact: true,
    });
    const card = region
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: title }) });
    await card.locator('summary').click();
    await card
      .getByLabel('Review reason', { exact: true })
      .fill(
        'Independent original reporting and source-specific permission checked.',
      );
    await card
      .getByRole('checkbox', {
        name: 'I independently checked all linking, reproduction and offline permissions',
      })
      .check();
    await card
      .getByRole('checkbox', {
        name: 'Two independent originators corroborate the material claim, including a primary source',
      })
      .check();
    await card.getByRole('button', { name: 'Publish verified report' }).click();
    await expect(card.locator('summary')).toContainText('published');
    if ((await card.getAttribute('open')) === null)
      await card.locator('summary').click();
    await card
      .getByLabel('Review reason', { exact: true })
      .fill('Withdraw after independent publication to test receipt state.');
    await card.getByRole('button', { name: 'Withdraw report' }).click();
    await expect(card.locator('summary')).toContainText('withdrawn');
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-WEB-1595 actual classification form loads admitted source saves mapping and independently publishes withdraws @SRC-006 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await crosswalkFixture(request, playwright, feedbackSandbox);
  try {
    await page.route('**/api/v1/equities/**', (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Sector mappings');
    let region = page.getByRole('region', {
      name: 'Classification crosswalk operations',
      exact: true,
    });
    await region
      .getByRole('button', { name: 'New crosswalk', exact: true })
      .click();
    await region
      .getByLabel('Classification company ISIN')
      .fill(fixture.input.isin);
    await region
      .getByRole('button', { name: 'Load admitted classifications' })
      .click();
    await region
      .getByLabel('Exact provider classification')
      .selectOption({ index: 1 });
    await region
      .getByLabel('Application sector', { exact: true })
      .fill('Browser reviewed sector');
    await region
      .getByLabel('Mapping rationale')
      .fill(
        'Explicit application mapping of the exact retained synthetic classification.',
      );
    await region.getByLabel('Crosswalk review by').fill(fixture.input.reviewBy);
    const saved = page.waitForResponse(
      (r) =>
        r.url().includes('/ops/classification-crosswalks/') &&
        r.request().method() === 'PUT',
    );
    await region.getByRole('button', { name: 'Save crosswalk draft' }).click();
    expect((await saved).status()).toBe(200);
    await expect(region).toContainText('Crosswalk draft saved.');
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Sector mappings',
    );
    region = page.getByRole('region', {
      name: 'Classification crosswalk operations',
      exact: true,
    });
    await region
      .getByRole('button', {
        name: 'INE002A01018 → Browser reviewed sector · version 1',
        exact: true,
      })
      .click();
    await region
      .getByLabel('Crosswalk independent review reason')
      .fill(
        'Independent exact source classification and application mapping review.',
      );
    await region
      .getByRole('button', { name: 'Publish crosswalk', exact: true })
      .click();
    await expect(region).toContainText('Crosswalk published.');
    await region
      .getByRole('button', { name: 'Withdraw crosswalk', exact: true })
      .click();
    await expect(region).toContainText('Crosswalk withdrawn.');
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-WEB-1596 actual normalization form clears changed coverage attestation then independent publish withdraw @INDIA-EQUITY-001 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await adjustmentActors(request, playwright, feedbackSandbox);
  try {
    const input = adjustmentInput();
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Price normalization',
    );
    let region = page.getByRole('region', {
      name: 'Price adjustment review',
      exact: true,
    });
    await region.getByLabel('Company ISIN', { exact: true }).fill(input.isin);
    await region.getByLabel('First trading date').fill(input.windowStart);
    await region.getByLabel('Last trading date').fill(input.windowEnd);
    await region.getByLabel('Original company action CSV').setInputFiles({
      name: 'synthetic-actions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(input.sourceCsv),
    });
    await region
      .getByLabel('How was the full action and traded-price window checked?')
      .fill(input.coverageEvidence);
    await region
      .getByLabel('Source usage permission evidence')
      .fill(input.rightsEvidence);
    const confirmed = region.getByRole('checkbox', {
      name: /I checked complete company\/date coverage/,
    });
    await confirmed.check();
    await region
      .getByLabel('Source usage permission evidence')
      .fill(input.rightsEvidence + ' Revised scope.');
    await expect(confirmed).not.toBeChecked();
    await confirmed.check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/equity-adjustments/prepare') &&
        r.request().method() === 'POST',
    );
    await region
      .getByRole('button', { name: 'Prepare normalization receipt' })
      .click();
    expect((await saved).status()).toBe(201);
    await expect(
      region.getByRole('button', { name: 'Publish reviewed normalization' }),
    ).toBeVisible();
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Price normalization',
    );
    region = page.getByRole('region', {
      name: 'Price adjustment review',
      exact: true,
    });
    await region
      .getByLabel('Independent review evidence')
      .fill(
        'Independent complete-window coverage and exact rational factors reviewed.',
      );
    await region
      .getByRole('checkbox', {
        name: 'I independently verified complete-window source coverage and exact factors.',
      })
      .check();
    await region
      .getByRole('button', { name: 'Publish reviewed normalization' })
      .click();
    await expect(region).toContainText('Status: publish');
    await region
      .getByRole('button', { name: 'Withdraw normalization' })
      .click();
    await expect(region).toContainText('Status: withdraw');
  } finally {
    await fixture.reviewer.dispose();
  }
});
