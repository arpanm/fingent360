import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  CompletePrivacyExportSchema,
  MaterialReceiptSchema,
  MaterialViewSchema,
} from '../../../../packages/contracts/src/index';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  materialPath,
  materialBrowserCall as call,
  prepareMaterialBrowser,
  saveMaterialSettings,
  seedMaterialObservation,
  gdp,
} from '../../helpers/material-alert-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const region = (page: Page) =>
  page.getByRole('region', { name: 'Material changes', exact: true });
async function trackedRoute(
  page: Page,
  handler: (route: Route) => Promise<void>,
) {
  const active = new Set<Promise<void>>();
  const wrapped = (route: Route) => {
    const pending = handler(route);
    active.add(pending);
    return pending.finally(() => active.delete(pending));
  };
  await page.route('**/api/v1/account/inbox/material', wrapped);
  return {
    async idle() {
      await Promise.all([...active]);
    },
    async close() {
      await Promise.all([...active]);
      await page.unroute('**/api/v1/account/inbox/material', wrapped);
    },
  };
}
test('E2E-WEB-660 ordinary keyboard and mobile threshold review save check receipt acknowledgment history and source navigation @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await page
    .getByRole('button', { name: 'Edit material thresholds', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('button', { name: 'Cancel material settings', exact: true })
    .click();
  await saveMaterialSettings(page);
  await seedMaterialObservation(feedbackSandbox, 2021, '4');
  await page
    .getByRole('button', { name: 'Check stored observations', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Saved material receipt' }),
  ).toContainText('Threshold reached');
  await expect(
    page.getByLabel('GDP growth material notice', { exact: true }),
  ).toContainText('3 percentage points');
  await page
    .getByRole('button', {
      name: 'Acknowledge GDP growth material notice',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Reopen GDP growth material notice',
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole('button', {
      name: 'Reopen GDP growth material notice',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Acknowledge GDP growth material notice',
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Read material history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Material-change history', exact: true }),
  ).toContainText('Retained receipts');
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  await region(page).screenshot({
    path: testInfo.outputPath('synthetic-material-inbox.png'),
  });
  await page
    .getByRole('button', { name: 'Close material history', exact: true })
    .click();
  await region(page)
    .getByRole('link', {
      name: 'Read source evidence and revision history',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#macro$/);
  await page.goBack();
  await expect(region(page)).toContainText('Threshold: 1 percentage points');
});
test('E2E-WEB-661 lost real check response replays immutable receipt while failed currentGET stays unavailable @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  await seedMaterialObservation(feedbackSandbox, 2021, '3');
  let lost = false,
    failRead = false;
  let original: ReturnType<typeof MaterialReceiptSchema.parse> | undefined;
  const routes = await trackedRoute(page, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && !lost) {
      lost = true;
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + materialPath,
      });
      expect(response.status()).toBe(200);
      original = MaterialReceiptSchema.parse(await response.json());
      await route.abort('failed');
    } else if (req.method() === 'GET' && failRead) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic current material read outage.',
        }),
      });
    } else
      await route.continue({ url: feedbackSandbox.apiOrigin + materialPath });
  });
  try {
    await page
      .getByRole('button', { name: 'Check stored observations', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Retry same material request',
        exact: true,
      }),
    ).toBeEnabled();
    await routes.idle();
    expect(original?.state.version).toBe(2);
    await seedMaterialObservation(feedbackSandbox, 2022, '7');
    const newer = await call(page, materialPath, 'POST', {
      action: 'check',
      requestId: randomUUID(),
      expectedVersion: 2,
    });
    expect(newer.status).toBe(200);
    failRead = true;
    await page
      .getByRole('button', { name: 'Retry same material request', exact: true })
      .click();
    await expect(
      page.getByRole('status', { name: 'Saved material receipt' }),
    ).toContainText('saved state version 2');
    await expect(region(page)).toContainText(
      'Your account is temporarily unavailable. Please try again shortly.',
    );
    await expect(region(page)).toContainText(
      'Current material context is unavailable.',
    );
    await expect(
      page.getByLabel('GDP growth material notice', { exact: true }),
    ).toHaveCount(0);
    failRead = false;
    await page
      .getByRole('button', { name: 'Refresh material changes', exact: true })
      .click();
    await expect(
      page.getByLabel('GDP growth material notice', { exact: true }),
    ).toContainText('notice version 2');
    await expect(
      page.getByRole('status', { name: 'Saved material receipt' }),
    ).toContainText('saved state version 2');
    const history = await call(page, materialPath + '/history');
    expect(
      history.body.events.filter(
        (e: { receipt: { requestId: string } }) =>
          e.receipt.requestId === original!.requestId,
      ),
    ).toHaveLength(1);
  } finally {
    await routes.close();
  }
});
test('E2E-WEB-662 existing mute controls pause material checks and unmute starts without backlog after reload @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  await page
    .getByRole('button', { name: 'Mute GDP growth', exact: true })
    .click();
  await expect(region(page)).toContainText('Muted; evaluation paused');
  await seedMaterialObservation(feedbackSandbox, 2021, '8');
  await page
    .getByRole('button', { name: 'Check stored observations', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Saved material receipt' }),
  ).toContainText('Muted; baseline paused');
  await page
    .getByRole('button', { name: 'Unmute GDP growth', exact: true })
    .click();
  await expect(region(page)).toContainText('Baseline: 2021: 8%');
  await page.reload();
  await expect(region(page)).toContainText('Baseline: 2021: 8%');
  await page
    .getByRole('button', { name: 'Check stored observations', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Saved material receipt' }),
  ).toContainText('Unchanged value; no new notice');
  await expect(
    page.getByLabel('GDP growth material notice', { exact: true }),
  ).toHaveCount(0);
});
test('E2E-WEB-663 actual material history401 clears private account while an older valid current read is held @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  let release!: () => void, admitted!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      admitted = resolve;
    });
  const routes = await trackedRoute(page, async (route) => {
    const response = await route.fetch({
      url: feedbackSandbox.apiOrigin + materialPath,
    });
    expect(response.status()).toBe(200);
    admitted();
    await gate;
    try {
      await route.fulfill({ response });
    } catch {
      /* Page may unmount the private component after real401. */
    }
  });
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await page
      .getByRole('button', { name: 'Refresh material changes', exact: true })
      .click();
    await ready;
    await pool.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await page
      .getByRole('button', { name: 'Read material history', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    release();
    await routes.idle();
    await expect(region(page)).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Observation inbox', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /Signed in as/ }),
    ).toHaveCount(0);
  } finally {
    release();
    await routes.close();
    await pool.end();
  }
});
test('E2E-WEB-664 Privacy downloads every material history page and actual later page401 cannot produce a partial file @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  const count = await page.evaluate(async (path) => {
    let version = (await (await fetch(path)).json()).state.version;
    for (let i = 0; i < 102; i++) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          expectedVersion: version,
          requestId: crypto.randomUUID(),
        }),
      });
      if (!response.ok)
        throw Error('Actual owned material history setup failed.');
      version = (await response.json()).state.version;
    }
    return version;
  }, materialPath);
  await page.goto('/#privacy');
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download account JSON', exact: true })
    .click();
  const file = await downloaded,
    filePath = await file.path();
  expect(filePath).toBeTruthy();
  const complete = CompletePrivacyExportSchema.parse(
    JSON.parse(await readFile(filePath!, 'utf8')),
  );
  expect(complete.materialAlerts.events).toHaveLength(count);
  expect(complete.materialAlerts.complete).toBe(true);
  let downloads = 0;
  page.on('download', () => downloads++);
  const pool = await connectionDatabase(feedbackSandbox),
    active = new Set<Promise<void>>();
  const pattern = '**/api/v1/account/inbox/material/history?*';
  const handler = (route: Route) => {
    const work = (async () => {
      await pool.query(
        "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
      expect(response.status()).toBe(401);
      await route.fulfill({ response });
    })();
    active.add(work);
    return work.finally(() => active.delete(work));
  };
  await page.route(pattern, handler);
  try {
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await Promise.all([...active]);
    expect(downloads).toBe(0);
    await expect(
      page.getByRole('button', { name: 'Download account JSON', exact: true }),
    ).toHaveCount(0);
  } finally {
    await Promise.all([...active]);
    await page.unroute(pattern, handler);
    await pool.end();
  }
});
test('E2E-WEB-665 conflicting material settings retain the draft for explicit refresh and resubmission @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await page.goto('/');
  await prepareMaterialBrowser(page);
  await saveMaterialSettings(page);
  await page
    .getByRole('button', { name: 'Edit material thresholds', exact: true })
    .click();
  await page
    .getByLabel('GDP growth threshold (percentage points)', { exact: true })
    .fill('2');
  await page
    .getByLabel(
      'I agree to store material thresholds, observation snapshots and check history in my account.',
      { exact: true },
    )
    .check();
  await page
    .getByRole('button', { name: 'Review material settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to material settings', exact: true })
    .click();
  await expect(
    page.getByLabel('GDP growth threshold (percentage points)', {
      exact: true,
    }),
  ).toHaveValue('2');
  await page
    .getByRole('button', { name: 'Review material settings', exact: true })
    .click();
  const view = MaterialViewSchema.parse((await call(page, materialPath)).body);
  expect(
    (
      await call(page, materialPath, 'POST', {
        action: 'configure',
        expectedVersion: view.state.version,
        requestId: randomUUID(),
        policies: [{ indicator: gdp, thresholdPoints: '3' }],
        storageConsent: true,
      })
    ).status,
  ).toBe(200);
  await page
    .getByRole('button', { name: 'Save material settings', exact: true })
    .click();
  await expect(region(page)).toContainText(
    'Your material-change settings changed.',
  );
  await expect(
    page.getByLabel('GDP growth threshold (percentage points)', {
      exact: true,
    }),
  ).toHaveValue('2');
  await page
    .getByRole('button', { name: 'Refresh material changes', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Save material settings', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Save material settings', exact: true })
    .click();
  await expect(region(page)).toContainText('Threshold: 2 percentage points');
});
