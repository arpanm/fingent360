import type { Locator, Page } from '@playwright/test';
import { CompanyNewsQueueSchema } from '../../../../packages/contracts/src/index';
import { retentionHeaders } from '../../helpers/retention';
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
import {
  activateObservationControl as activate,
  tabToObservationControl as tabTo,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';

async function keyboardText(page: Page, control: Locator, value: string) {
  await tabTo(page, control);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
  await expect(control).toHaveValue(value);
}

async function keyboardCheck(page: Page, control: Locator, checked: boolean) {
  await tabTo(page, control);
  if ((await control.isChecked()) !== checked)
    await page.keyboard.press('Space');
  await expect(control).toBeChecked({ checked });
}

// Reach native widgets through Tab, but set fixture values with Playwright:
// OS-specific select popups/date segments require separate physical acceptance.
async function selectFixture(page: Page, control: Locator, value: string) {
  await tabTo(page, control);
  await control.selectOption(value);
  await expect(control).toHaveValue(value);
}

test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1594 company news form retains two source proofs then independent reviewer publishes and withdraws @SRC-012 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 800 });
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
    await activate(
      page,
      region.getByText('Prepare a company report', { exact: true }),
    );
    // Synthetic date setup precedes the keyboard workflow. Filling a date
    // must not masquerade as sequential keyboard focus in the assertions below.
    for (const [index, row] of input.citations.entries()) {
      const group = region.getByRole('group', {
        name: 'Source ' + (index + 1),
        exact: true,
      });
      await group
        .getByLabel('Publication time (UTC)')
        .fill(row.publishedAt.slice(0, 16));
      await group
        .getByLabel('Retrieved time (UTC)')
        .fill(row.retrievedAt.slice(0, 16));
    }
    await keyboardText(
      page,
      region.getByRole('textbox', { name: 'Company ISIN', exact: true }),
      input.isin,
    );
    await keyboardText(
      page,
      region.getByRole('textbox', { name: 'Report title', exact: true }),
      title,
    );
    await keyboardText(
      page,
      region.getByRole('textbox', { name: 'Original summary', exact: true }),
      input.summary,
    );
    await keyboardText(
      page,
      region.getByRole('textbox', {
        name: 'What did the independent evidence confirm?',
        exact: true,
      }),
      input.verification,
    );
    await selectFixture(
      page,
      region.getByRole('combobox', { name: 'Conflicting evidence' }),
      'none-found',
    );
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
        await keyboardText(
          page,
          group.getByLabel(label!, { exact: true }),
          value!,
        );
      for (const [label, value] of [
        ['Publication time (UTC)', row.publishedAt.slice(0, 16)],
        ['Retrieved time (UTC)', row.retrievedAt.slice(0, 16)],
      ]) {
        const date = group.getByLabel(label!, { exact: true });
        // Values were seeded before traversal; this checks native date-field
        // reachability without claiming portable OS date-segment entry.
        await tabTo(page, date);
        await expect(date).toHaveValue(value!);
      }
      await keyboardCheck(
        page,
        group.getByRole('checkbox', { name: 'Primary filing or release' }),
        row.primary,
      );
      await keyboardCheck(
        page,
        group.getByRole('checkbox', {
          name: 'Independent reporting, not a mirror or syndication',
        }),
        true,
      );
      const allowed = group.getByRole('combobox', { name: 'Allowed use' });
      await tabTo(page, allowed);
      await expect(allowed).toHaveValue('link-only');
    }
    await tabTo(page, region.getByRole('button', { name: 'Add source' }));
    const optionalText = region.getByRole('textbox', {
      name: 'Optional licensed text',
      exact: true,
    });
    await tabTo(page, optionalText);
    await expect(optionalText).toHaveValue('');
    await keyboardCheck(
      page,
      region.getByRole('checkbox', {
        name: /I checked every source permits linking/,
      }),
      true,
    );
    await captureObservationLayout(
      page,
      region,
      testInfo,
      'synthetic-company-news-source-form.png',
    );
    // Lose only the real acknowledgment, after the actual store commits. The
    // unchanged draft must retry its original idempotency key.
    let committedStatus = 0;
    let firstRequestId = '';
    await page.route('**/api/v1/ops/company-news/prepare', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      firstRequestId = String(route.request().postDataJSON().requestId);
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + '/api/v1/ops/company-news/prepare',
        // Preserve the actual browser's selected actor even when web and API
        // use different loopback hostnames; headers() omits security headers.
        headers: {
          ...(await route.request().allHeaders()),
          ...retentionHeaders,
        },
      });
      committedStatus = response.status();
      await route.abort('failed');
    });
    const submit = region.getByRole('button', {
      name: 'Retain draft for verification',
    });
    await activate(page, submit);
    await expect(region.getByRole('alert')).toBeVisible();
    expect(committedStatus).toBe(201);
    await expect(
      region.getByRole('textbox', { name: 'Report title', exact: true }),
    ).toHaveValue(title);
    await expect(submit).toBeEnabled();
    await page.unroute('**/api/v1/ops/company-news/prepare');
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/company-news/prepare') &&
        r.request().method() === 'POST',
    );
    await activate(page, submit);
    const acknowledged = await saved;
    expect(acknowledged.status()).toBe(201);
    expect(acknowledged.request().postDataJSON().requestId).toBe(
      firstRequestId,
    );
    const retained = CompanyNewsQueueSchema.parse(
      await (await request.get('/api/v1/ops/company-news')).json(),
    );
    expect(
      retained.items.filter((item) => item.input.requestId === firstRequestId),
    ).toHaveLength(1);
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
    await activate(page, card.locator('summary'));
    await keyboardText(
      page,
      card.getByRole('textbox', { name: 'Review reason', exact: true }),
      'Independent original reporting and source-specific permission checked.',
    );
    await keyboardCheck(
      page,
      card.getByRole('checkbox', {
        name: 'I independently checked all linking, reproduction and offline permissions',
      }),
      true,
    );
    await keyboardCheck(
      page,
      card.getByRole('checkbox', {
        name: 'Two independent originators corroborate the material claim, including a primary source',
      }),
      true,
    );
    await captureObservationLayout(
      page,
      card,
      testInfo,
      'synthetic-company-news-independent-review.png',
    );
    await activate(
      page,
      card.getByRole('button', { name: 'Publish verified report' }),
    );
    await expect(card.locator('summary')).toContainText('published');
    if ((await card.getAttribute('open')) === null)
      await activate(page, card.locator('summary'));
    await keyboardText(
      page,
      card.getByRole('textbox', { name: 'Review reason', exact: true }),
      'Withdraw after independent publication to test receipt state.',
    );
    await activate(page, card.getByRole('button', { name: 'Withdraw report' }));
    await expect(card.locator('summary')).toContainText('withdrawn');
    expect(
      (
        await fixture.reviewer.delete('/api/v1/ops/session', {
          headers: retentionHeaders,
        })
      ).status(),
    ).toBe(200);
    const expiredRefresh = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/ops/company-news' &&
        response.request().method() === 'GET',
    );
    await activate(
      page,
      region.getByRole('button', {
        name: 'Refresh company reports',
        exact: true,
      }),
    );
    expect((await expiredRefresh).status()).toBe(401);
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toBeVisible();
    await expect(region).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
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
