import {
  test,
  expect,
  captureFxFixture,
  seedFxEdition,
  fxOperator,
  reviewFx,
  openFxOperations,
  fxDatabase,
} from '../../helpers/ecb-fx';
import type { Page } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
function activeApiRequests(page: Page) {
  const active = new Set<unknown>();
  page.on('request', (value) => {
    if (new URL(value.url()).pathname.startsWith('/api/v1/')) active.add(value);
  });
  page.on('requestfinished', (value) => active.delete(value));
  page.on('requestfailed', (value) => active.delete(value));
  return () => active.size;
}
test('E2E-WEB-810 exact references marked calculation month navigation evidence keyboard Back and mobile layout @ECB-FX-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  const edition = await seedFxEdition(feedbackSandbox);
  await fxOperator(request);
  await reviewFx(request);
  const latest = edition.observations[edition.observations.length - 1]!,
    months = [
      ...new Set(edition.observations.map((row) => row.date.slice(0, 7))),
    ]
      .sort()
      .reverse();
  expect(months.length).toBeGreaterThan(1);
  await page.goto('/#more');
  await page.getByRole('link', { name: /Reference exchange rates/ }).click();
  const region = page.getByRole('region', {
    name: 'Reference exchange rates',
    exact: true,
  });
  await expect(region).toContainText(latest.usdPerEur + ' USD');
  await expect(region).toContainText(latest.inrPerEur + ' INR');
  await expect(region).toContainText(latest.derivedInrPerUsd.value);
  await expect(region).toContainText('Fingent360 calculation');
  await expect(region).toContainText(
    'not executable quotes or Indian end-of-day rates',
  );
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  );
  await page.screenshot({
    path: testInfo.outputPath('synthetic-public-reference-fx.png'),
    fullPage: true,
  });
  await region
    .getByRole('link', { name: 'Review retrieval history', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Reviewed FX history', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('link', { name: 'Retrieval edition 1', exact: true })
    .click();
  const month = page.getByLabel('Observation month', { exact: true });
  await expect(month).toHaveValue(months[0]!);
  await month.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(month).toHaveValue(months[1]!);
  await expect(
    page.getByRole('table').locator(`time[datetime="${latest.date}"]`),
  ).toHaveCount(0);
  await month.selectOption('all');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(
    edition.observations.length,
  );
  await page
    .getByText('What changed in this capture?', { exact: true })
    .click();
  await expect(region).toContainText(
    'absence does not establish a correction or withdrawal',
  );
  await page
    .getByRole('link', { name: "Inspect this edition's evidence", exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Exchange-rate evidence', exact: true }),
  ).toBeFocused();
  await page
    .getByText('Evidence identity and method version', { exact: true })
    .click();
  await expect(region).toContainText('ecb-eurofxref-90d-v1');
  await expect(region).toContainText('f360-inr-per-usd-v1');
  await expect(region).toContainText('not a historical as-of vintage');
  await page
    .getByText('How the cross-rate is calculated', { exact: true })
    .click();
  await expect(region).toContainText(
    'INR per USD = (INR per EUR) ÷ (USD per EUR)',
  );
  await page
    .getByRole('button', {
      name: 'Back to previous exchange-rate view',
      exact: true,
    })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Back to previous exchange-rate view',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Reviewed FX history', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Back to previous exchange-rate view',
      exact: true,
    })
    .click();
  await expect(region).toContainText(latest.derivedInrPerUsd.value);
});
test('E2E-WEB-811 actual committed review lost reply same-ID replay retains historical receipt during failed refresh @ECB-FX-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const active = activeApiRequests(page);
  await seedFxEdition(feedbackSandbox);
  const region = await openFxOperations(page);
  await region
    .getByLabel('FX review reason', { exact: true })
    .fill('Synthetic draft to cancel');
  await region
    .getByRole('button', { name: 'Cancel review draft', exact: true })
    .click();
  await expect(
    region.getByLabel('FX review reason', { exact: true }),
  ).toHaveValue('');
  let first = true,
    failRead = false;
  const requestIds: string[] = [];
  await page.route('**/api/v1/ops/reference-fx', async (route) => {
    if (failRead)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic read failure after committed review.',
        }),
      });
    else await route.fallback();
  });
  await page.route('**/api/v1/ops/reference-fx/review', async (route) => {
    requestIds.push(
      (route.request().postDataJSON() as { requestId: string }).requestId,
    );
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}/api/v1/ops/reference-fx/review`,
    });
    expect(response.status()).toBe(200);
    if (first) {
      first = false;
      failRead = true;
      await route.abort('failed');
    } else await route.fulfill({ response });
  });
  try {
    await region
      .getByLabel('FX review reason', { exact: true })
      .fill('Synthetic isolated review of the exact retained edition.');
    await region
      .getByRole('button', { name: 'Confirm FX review', exact: true })
      .click();
    await expect(
      region.getByRole('button', {
        name: 'Retry same FX request',
        exact: true,
      }),
    ).toBeEnabled();
    await region
      .getByRole('button', { name: 'Retry same FX request', exact: true })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical FX review receipt',
        exact: true,
      }),
    ).toContainText('published');
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic read failure',
    );
    await expect(
      region.getByRole('button', {
        name: 'Capture fixed ECB reference XML',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      region.getByRole('button', { name: 'Confirm FX review', exact: true }),
    ).toHaveCount(0);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBe(requestIds[1]);
    failRead = false;
    await region
      .getByRole('button', { name: 'Retry FX state', exact: true })
      .click();
    await expect(region).toContainText('Current head 2 · published');
    await page.reload();
    await page
      .getByRole('button', { name: 'Reference exchange rates', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Open published receipt for head 2',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical FX review receipt',
        exact: true,
      }),
    ).toContainText('Synthetic isolated review');
  } finally {
    await page.unroute('**/api/v1/ops/reference-fx');
    await page.unroute('**/api/v1/ops/reference-fx/review');
    await expect.poll(active).toBe(0);
  }
});
for (const [id, expire] of [
  [812, false],
  [813, true],
] as const) {
  test(`E2E-WEB-${id} retained response ${expire ? 'real401 fences held successful private data' : 'Close fences delayed successful content'} @ECB-FX-001 @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    const network = activeApiRequests(page);
    const { run } = await captureFxFixture(feedbackSandbox);
    const region = await openFxOperations(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let admitted = false,
      active = 0;
    const pattern = `**/api/v1/ops/reference-fx/retained/${run.requestId}`;
    await page.route(pattern, async (route) => {
      active++;
      try {
        const response = await route.fetch({
          url: `${feedbackSandbox.apiOrigin}/api/v1/ops/reference-fx/retained/${run.requestId}`,
        });
        expect(response.status()).toBe(200);
        admitted = true;
        await gate;
        await route.fulfill({ response });
      } finally {
        active--;
      }
    });
    try {
      await region
        .getByRole('button', {
          name: `Inspect retained response for ${run.requestId}`,
          exact: true,
        })
        .click();
      await expect.poll(() => admitted).toBe(true);
      if (expire) {
        const pool = await fxDatabase(feedbackSandbox);
        try {
          await pool.query('DELETE FROM operator_sessions');
        } finally {
          await pool.end();
        }
        await region
          .getByRole('button', { name: 'Reload FX state', exact: true })
          .click();
        await expect(
          page.getByRole('button', {
            name: 'Sign in to operations',
            exact: true,
          }),
        ).toBeVisible();
      } else
        await region
          .getByRole('button', { name: 'Close retained response', exact: true })
          .click();
      release();
      await expect.poll(() => active).toBe(0);
      await expect.poll(network).toBe(0);
      await expect(
        page.getByRole('region', { name: 'Retained FX response', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText('Retained XML source text', { exact: true }),
      ).toHaveCount(0);
      if (expire) await expect(region).toHaveCount(0);
    } finally {
      release();
      await page.unroute(pattern);
      await expect.poll(() => active).toBe(0);
      await expect.poll(network).toBe(0);
    }
  });
}
test('E2E-WEB-814 first-load public error recovers to real empty state without invented values @ECB-FX-001 @TEST-SIMULATION', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/v1/reference-fx', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic FX read fault' }),
      });
    else await route.fallback();
  });
  try {
    await page.goto('/#reference-fx');
    const region = page.getByRole('region', {
      name: 'Reference exchange rates',
      exact: true,
    });
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic FX read fault',
    );
    fail = false;
    await region
      .getByRole('button', { name: 'Retry reference rates', exact: true })
      .click();
    await expect(region).toContainText(
      'No reviewed reference-rate edition is available yet.',
    );
    await expect(
      region.getByRole('link', {
        name: 'Inspect numerical evidence',
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await page.unroute('**/api/v1/reference-fx');
  }
});
