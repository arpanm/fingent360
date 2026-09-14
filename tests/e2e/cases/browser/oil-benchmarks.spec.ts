import {
  test,
  expect,
  captureOilFixture,
  seedOilEdition,
  oilWorkbook,
  oilOperator,
  reviewOil,
  openOilOperations,
  oilDatabase,
} from '../../helpers/oil-benchmarks';
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
test('E2E-WEB-740 reviewed exact rates history evidence keyboard Back and phone layout @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  await seedOilEdition(feedbackSandbox, await oilWorkbook({ nextYear: true }));
  await oilOperator(request);
  await reviewOil(request);
  await page.goto('/#more');
  await page.getByRole('link', { name: /Oil benchmarks/ }).click();
  const region = page.getByRole('region', {
    name: 'Oil benchmarks',
    exact: true,
  });
  await expect(region).toContainText('13.1 USD per barrel');
  await expect(region).toContainText('Not reported');
  await expect(region).toContainText(
    'Monthly averages are not end-of-day quotes',
  );
  await expect(region).toContainText('not a reconstructed as-of vintage');
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  );
  await page.screenshot({
    path: testInfo.outputPath('synthetic-public-oil-benchmarks.png'),
    fullPage: true,
  });
  await region
    .getByRole('link', { name: 'Review retrieval history', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', {
      name: 'Reviewed retrieval history',
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByRole('link', { name: 'Retrieval edition 1', exact: true })
    .click();
  await expect(page.getByRole('table')).toContainText('-2.3');
  const year = page.getByLabel('Observation year', { exact: true });
  await expect(year).toHaveValue('2001');
  await year.focus();
  await expect(year).toBeFocused();
  // Select the native option portably; keyboard history/Back remains covered above and below.
  await year.selectOption('2000');
  await expect(year).toHaveValue('2000');
  await expect(page.getByRole('table')).toContainText('2000-12');
  await expect(page.getByRole('table')).not.toContainText('2001-01');
  await year.selectOption('all');
  await expect(page.getByRole('table')).toContainText('2001-01');
  await expect(page.getByRole('table')).toContainText('2000-01');
  await page
    .getByRole('link', { name: "Inspect this edition's evidence", exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Oil-benchmark evidence', exact: true }),
  ).toBeFocused();
  await page.getByText('Evidence identity and parser', { exact: true }).click();
  await expect(region).toContainText('world-bank-pink-sheet-oil-v1');
  await page
    .getByText('Source cell precision for selected year', { exact: true })
    .click();
  await expect(region).toContainText('12.349999999999998');
  await page
    .getByRole('button', {
      name: 'Back to previous oil-benchmark view',
      exact: true,
    })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Back to previous oil-benchmark view',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Reviewed retrieval history',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Back to previous oil-benchmark view',
      exact: true,
    })
    .click();
  await expect(region).toContainText('13.1 USD per barrel');
});
test('E2E-WEB-741 actual committed review lost reply same-ID replay retains historical receipt during failed refresh @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const active = activeApiRequests(page);
  await seedOilEdition(feedbackSandbox);
  const region = await openOilOperations(page);
  await region
    .getByLabel('Oil-benchmark review reason', { exact: true })
    .fill('Synthetic draft to cancel');
  await region
    .getByRole('button', { name: 'Cancel review draft', exact: true })
    .click();
  await expect(
    region.getByLabel('Oil-benchmark review reason', { exact: true }),
  ).toHaveValue('');
  let first = true,
    failRead = false;
  const requestIds: string[] = [];
  await page.route('**/api/v1/ops/oil-benchmarks', async (route) => {
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
  await page.route('**/api/v1/ops/oil-benchmarks/review', async (route) => {
    requestIds.push(
      (route.request().postDataJSON() as { requestId: string }).requestId,
    );
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}/api/v1/ops/oil-benchmarks/review`,
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
      .getByLabel('Oil-benchmark review reason', { exact: true })
      .fill('Synthetic isolated review of the exact retained edition.');
    await region
      .getByRole('button', {
        name: 'Confirm oil-benchmark review',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('button', {
        name: 'Retry same oil-benchmark request',
        exact: true,
      }),
    ).toBeEnabled();
    await region
      .getByRole('button', {
        name: 'Retry same oil-benchmark request',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical oil-benchmark review receipt',
        exact: true,
      }),
    ).toContainText('published');
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic read failure',
    );
    await expect(
      region.getByRole('button', {
        name: 'Capture fixed World Bank workbook',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      region.getByRole('button', {
        name: 'Confirm oil-benchmark review',
        exact: true,
      }),
    ).toHaveCount(0);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBe(requestIds[1]);
    failRead = false;
    await region
      .getByRole('button', { name: 'Retry oil-benchmark state', exact: true })
      .click();
    await expect(region).toContainText('Current head 2 · published');
    await page.reload();
    await page
      .getByRole('button', { name: 'Oil benchmarks', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Open published receipt for head 2',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical oil-benchmark review receipt',
        exact: true,
      }),
    ).toContainText('Synthetic isolated review');
  } finally {
    await page.unroute('**/api/v1/ops/oil-benchmarks');
    await page.unroute('**/api/v1/ops/oil-benchmarks/review');
    await expect.poll(active).toBe(0);
  }
});
for (const [id, expire] of [
  [742, false],
  [743, true],
] as const) {
  test(`E2E-WEB-${id} retained response ${expire ? 'real401 fences held successful private data' : 'Close fences delayed successful content'} @EIA-BENCHMARKS-001 @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    const network = activeApiRequests(page);
    const { run } = await captureOilFixture(feedbackSandbox);
    const region = await openOilOperations(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let admitted = false,
      active = 0;
    const pattern = `**/api/v1/ops/oil-benchmarks/retained/${run.requestId}`;
    await page.route(pattern, async (route) => {
      active++;
      try {
        const response = await route.fetch({
          url: `${feedbackSandbox.apiOrigin}/api/v1/ops/oil-benchmarks/retained/${run.requestId}`,
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
        const pool = await oilDatabase(feedbackSandbox);
        try {
          await pool.query('DELETE FROM operator_sessions');
        } finally {
          await pool.end();
        }
        await region
          .getByRole('button', {
            name: 'Reload oil-benchmark state',
            exact: true,
          })
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
        page.getByRole('region', {
          name: 'Retained oil-benchmark response',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('link', {
          name: 'Download retained workbook',
          exact: true,
        }),
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
test('E2E-WEB-744 first-load public error recovers to real empty state without invented values @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/v1/oil-benchmarks', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic oil read fault' }),
      });
    else await route.fallback();
  });
  try {
    await page.goto('/#oil-benchmarks');
    const region = page.getByRole('region', {
      name: 'Oil benchmarks',
      exact: true,
    });
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic oil read fault',
    );
    fail = false;
    await region
      .getByRole('button', { name: 'Retry oil benchmarks', exact: true })
      .click();
    await expect(region).toContainText(
      'No reviewed monthly oil edition is available yet.',
    );
    await expect(
      region.getByRole('link', {
        name: 'Inspect numerical evidence',
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await page.unroute('**/api/v1/oil-benchmarks');
  }
});
