import {
  test,
  expect,
  captureEcbFixture,
  seedEcbEdition,
  ecbOperator,
  reviewEcb,
  openEcbOperations,
  ecbDatabase,
} from '../../helpers/ecb-rates';
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
test('E2E-WEB-680 reviewed exact rates history evidence keyboard Back and phone layout @ECB-RATES-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  await seedEcbEdition(feedbackSandbox);
  await ecbOperator(request);
  await reviewEcb(request);
  await page.goto('/#more');
  await page.getByRole('link', { name: /ECB policy rates/ }).click();
  const region = page.getByRole('region', {
    name: 'ECB policy rates',
    exact: true,
  });
  await expect(region).toContainText('-0.125% per annum');
  await expect(region).toContainText('1.2345678% per annum');
  await expect(region).toContainText('not yet effective');
  await expect(region).toContainText('not a reconstructed as-of vintage');
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  );
  await page.screenshot({
    path: testInfo.outputPath('synthetic-public-ecb-rates.png'),
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
  await expect(page.getByRole('table')).toContainText('1.2345678%');
  await page
    .getByRole('link', { name: "Inspect this edition's evidence", exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Policy-rate evidence', exact: true }),
  ).toBeFocused();
  await page.getByText('Evidence identity and parser', { exact: true }).click();
  await expect(region).toContainText('ecb-sdmx-policy-rates-v1');
  await page
    .getByRole('button', {
      name: 'Back to previous policy-rate view',
      exact: true,
    })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Back to previous policy-rate view',
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
      name: 'Back to previous policy-rate view',
      exact: true,
    })
    .click();
  await expect(region).toContainText('-0.125% per annum');
});
test('E2E-WEB-681 actual committed review lost reply same-ID replay retains historical receipt during failed refresh @ECB-RATES-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const active = activeApiRequests(page);
  await seedEcbEdition(feedbackSandbox);
  const region = await openEcbOperations(page);
  await region
    .getByLabel('Policy-rate review reason', { exact: true })
    .fill('Synthetic draft to cancel');
  await region
    .getByRole('button', { name: 'Cancel review draft', exact: true })
    .click();
  await expect(
    region.getByLabel('Policy-rate review reason', { exact: true }),
  ).toHaveValue('');
  let first = true,
    failRead = false;
  const requestIds: string[] = [];
  await page.route('**/api/v1/ops/policy-rates', async (route) => {
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
  await page.route('**/api/v1/ops/policy-rates/review', async (route) => {
    requestIds.push(
      (route.request().postDataJSON() as { requestId: string }).requestId,
    );
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}/api/v1/ops/policy-rates/review`,
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
      .getByLabel('Policy-rate review reason', { exact: true })
      .fill('Synthetic isolated review of the exact retained edition.');
    await region
      .getByRole('button', { name: 'Confirm policy-rate review', exact: true })
      .click();
    await expect(
      region.getByRole('button', {
        name: 'Retry same policy-rate request',
        exact: true,
      }),
    ).toBeEnabled();
    await region
      .getByRole('button', {
        name: 'Retry same policy-rate request',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical policy-rate review receipt',
        exact: true,
      }),
    ).toContainText('published');
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic read failure',
    );
    await expect(
      region.getByRole('button', {
        name: 'Refresh fixed ECB source',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      region.getByRole('button', {
        name: 'Confirm policy-rate review',
        exact: true,
      }),
    ).toHaveCount(0);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBe(requestIds[1]);
    failRead = false;
    await region
      .getByRole('button', { name: 'Retry policy-rate state', exact: true })
      .click();
    await expect(region).toContainText('Current head 2 · published');
    await page.reload();
    await page
      .getByRole('button', { name: 'ECB policy rates', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Open published receipt for head 2',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Historical policy-rate review receipt',
        exact: true,
      }),
    ).toContainText('Synthetic isolated review');
  } finally {
    await page.unroute('**/api/v1/ops/policy-rates');
    await page.unroute('**/api/v1/ops/policy-rates/review');
    await expect.poll(active).toBe(0);
  }
});
for (const [id, expire] of [
  [682, false],
  [683, true],
] as const) {
  test(`E2E-WEB-${id} retained response ${expire ? 'real401 fences held successful private data' : 'Close fences delayed successful content'} @ECB-RATES-001 @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    const network = activeApiRequests(page);
    const { run } = await captureEcbFixture(feedbackSandbox);
    const region = await openEcbOperations(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let admitted = false,
      active = 0;
    const pattern = `**/api/v1/ops/policy-rates/retained/${run.requestId}`;
    await page.route(pattern, async (route) => {
      active++;
      try {
        const response = await route.fetch({
          url: `${feedbackSandbox.apiOrigin}/api/v1/ops/policy-rates/retained/${run.requestId}`,
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
        const pool = await ecbDatabase(feedbackSandbox);
        try {
          await pool.query('DELETE FROM operator_sessions');
        } finally {
          await pool.end();
        }
        await region
          .getByRole('button', {
            name: 'Reload policy-rate state',
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
          name: 'Retained policy-rate response',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.getByText(/SYNTHETIC-SDMX-PARSER-FIXTURE/)).toHaveCount(
        0,
      );
      if (expire) await expect(region).toHaveCount(0);
    } finally {
      release();
      await page.unroute(pattern);
      await expect.poll(() => active).toBe(0);
      await expect.poll(network).toBe(0);
    }
  });
}
test('E2E-WEB-684 first-load public error recovers to real empty state without invented values @ECB-RATES-001 @TEST-SIMULATION', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/v1/policy-rates', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic ECB read fault' }),
      });
    else await route.fallback();
  });
  try {
    await page.goto('/#policy-rates');
    const region = page.getByRole('region', {
      name: 'ECB policy rates',
      exact: true,
    });
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic ECB read fault',
    );
    fail = false;
    await region
      .getByRole('button', { name: 'Retry policy rates', exact: true })
      .click();
    await expect(region).toContainText(
      'No reviewed ECB numerical edition is available yet.',
    );
    await expect(
      region.getByRole('link', {
        name: 'Inspect numerical evidence',
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await page.unroute('**/api/v1/policy-rates');
  }
});
