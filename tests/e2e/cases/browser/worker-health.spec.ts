import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  workerBase as base,
  workerDatabase,
  loginWorkerOperator,
  workerControl,
} from '../../helpers/worker-health';
import { WorkerControlReceiptSchema } from '../../../../packages/contracts/src/index';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
async function signIn(page: Page) {
  await page.goto('/#today');
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Worker health', exact: true })
    .click();
}
const health = (page: Page) =>
  page.getByRole('region', { name: 'Worker health', exact: true });
const reports = (page: Page) =>
  page.getByRole('article', { name: 'Saved reports health', exact: true });
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('E2E-WEB-350 worker controls review cancel keyboard confirm receipt history reload and mobile layout @WORKER-HEALTH-001', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await expect(reports(page)).toContainText('Mode: Running');
  await reports(page)
    .getByRole('button', {
      name: 'Control history for Saved reports',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Worker control history', exact: true }),
  ).toContainText('No controls recorded');
  const review = reports(page).getByRole('button', {
    name: 'Review pause Saved reports',
    exact: true,
  });
  await review.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {
    name: 'Pause Saved reports?',
    exact: true,
  });
  await expect(dialog).toContainText('Already admitted work may complete');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(review).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog
    .getByRole('button', { name: 'Confirm pause', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Saved worker control receipt',
      exact: true,
    }),
  ).toContainText('historical receipt');
  await expect(reports(page)).toContainText('Mode: Paused');
  await expect(
    page.getByRole('region', { name: 'Worker control history', exact: true }),
  ).toContainText('Paused · version 2');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('worker-health-paused.png'),
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole('button', { name: 'Worker health', exact: true })
    .click();
  await expect(reports(page)).toContainText('Mode: Paused');
  await reports(page)
    .getByRole('button', { name: 'Review resume Saved reports', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm resume', exact: true })
    .click();
  await expect(reports(page)).toContainText('Mode: Running');
});

test('E2E-WEB-351 initial unavailable or unreadable health has Retry and later failed refresh keeps dated controls disabled @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  page,
}) => {
  let fault: 'unavailable' | 'unreadable' | null = 'unavailable';
  await page.route('**/api/v1/ops/workers', (route) =>
    fault === 'unavailable'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic worker observation outage.',
          }),
        })
      : fault === 'unreadable'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{unreadable',
          })
        : route.fallback(),
  );
  await signIn(page);
  await expect(health(page).getByRole('alert')).toContainText(
    'Synthetic worker observation outage',
  );
  const reload = health(page).getByRole('button', {
    name: 'Reload worker health',
    exact: true,
  });
  fault = 'unreadable';
  await reload.focus();
  await page.keyboard.press('Enter');
  await expect(health(page).getByRole('alert')).toContainText('unreadable');
  fault = null;
  await reload.click();
  await expect(reports(page)).toContainText('Mode: Running');
  fault = 'unavailable';
  await reload.click();
  await expect(health(page).getByRole('note')).toContainText(
    'dated observations are historical',
  );
  await expect(
    reports(page).getByRole('button', {
      name: 'Review pause Saved reports',
      exact: true,
    }),
  ).toBeDisabled();
  fault = null;
  await reload.click();
  await expect(health(page).getByRole('note')).toHaveCount(0);
  await expect(
    reports(page).getByRole('button', {
      name: 'Review pause Saved reports',
      exact: true,
    }),
  ).toBeEnabled();
});

test('E2E-WEB-352 lost committed pause replays historical receipt after real resume and failed current refresh @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  await signIn(page);
  await loginWorkerOperator(request);
  const writes: string[] = [],
    receipts: unknown[] = [];
  await page.route('**/api/v1/ops/workers/reports/control', async (route) => {
    writes.push(route.request().postData()!);
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}${base}/reports/control`,
    });
    expect(response.status()).toBe(201);
    receipts.push(WorkerControlReceiptSchema.parse(await response.json()));
    if (writes.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await reports(page)
    .getByRole('button', { name: 'Review pause Saved reports', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm pause', exact: true })
    .click();
  await expect(health(page).getByRole('alert')).toBeVisible();
  await workerControl(request, 'reports', false, 2);
  let unavailable = true;
  await page.route('**/api/v1/ops/workers', (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic refresh failure after saved control.',
          }),
        })
      : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Retry same control', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Saved worker control receipt',
      exact: true,
    }),
  ).toContainText('pause recorded');
  await expect(
    page.getByRole('region', {
      name: 'Saved worker control receipt',
      exact: true,
    }),
  ).toContainText('does not establish the current worker mode');
  await expect(health(page).getByRole('note')).toContainText(
    'Current worker health is unavailable',
  );
  await expect(
    reports(page).getByRole('button', {
      name: 'Review pause Saved reports',
      exact: true,
    }),
  ).toBeDisabled();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toBe(writes[0]);
  expect(receipts[1]).toEqual(receipts[0]);
  unavailable = false;
  await page
    .getByRole('button', { name: 'Reload worker health', exact: true })
    .click();
  await expect(reports(page)).toContainText('control version 3');
  await expect(reports(page)).toContainText('Mode: Running');
  await expect(
    page.getByRole('region', {
      name: 'Saved worker control receipt',
      exact: true,
    }),
  ).toContainText('control version 2');
});

test('E2E-WEB-353 actual401 closes operations and delayed successful health cannot restore its view @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await signIn(page);
  await expect(reports(page)).toBeVisible();
  const pool = await workerDatabase(feedbackSandbox),
    gate = deferred(),
    drained = deferred();
  let started = false,
    held = false;
  const pattern = '**/api/v1/ops/workers';
  const handler = async (route: Route) => {
    started = true;
    try {
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}${base}`,
        timeout: 15000,
      });
      expect(response.status()).toBe(200);
      held = true;
      await gate.promise;
      await route.fulfill({ response });
    } finally {
      drained.release();
    }
  };
  await page.route(pattern, handler);
  try {
    await page
      .getByRole('button', { name: 'Reload worker health', exact: true })
      .click();
    await expect.poll(() => held).toBe(true);
    await pool.query(
      'UPDATE operator_sessions SET expires_at=clock_timestamp()',
    );
    await page.evaluate(() => {
      type BodyFixture = {
        status: number;
        jsonCalls: number;
        restore: () => void;
      };
      const target = window as typeof window & { worker401Body?: BodyFixture };
      const native = window.fetch.bind(window);
      let release: (() => void) | undefined;
      const fixture: BodyFixture = {
        status: 0,
        jsonCalls: 0,
        restore: () => {
          window.fetch = native;
          release?.();
        },
      };
      target.worker401Body = fixture;
      window.fetch = async (input, init) => {
        const response = await native(input, init);
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          location.href,
        );
        if (
          url.pathname.startsWith('/api/v1/ops/workers') &&
          response.status === 401
        ) {
          fixture.status = response.status;
          // Real transport, status and auth denial; only its JSON reader is
          // deliberately stalled. Header-first denial must never call it.
          Object.defineProperty(response, 'json', {
            value: () => {
              fixture.jsonCalls++;
              return new Promise<unknown>((resolve) => {
                release = () => resolve(null);
              });
            },
          });
        }
        return response;
      };
    });
    const denial = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `${base}/reports/history`,
    );
    await reports(page)
      .getByRole('button', {
        name: 'Control history for Saved reports',
        exact: true,
      })
      .click();
    expect((await denial).status()).toBe(401);
    await expect(
      page.getByRole('heading', { name: 'Operations sign-in', exact: true }),
    ).toBeVisible();
    await expect(health(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const fixture = (
          window as typeof window & {
            worker401Body?: { status: number; jsonCalls: number };
          }
        ).worker401Body;
        return { status: fixture?.status, jsonCalls: fixture?.jsonCalls };
      }),
    ).toEqual({ status: 401, jsonCalls: 0 });
    const late = page.waitForResponse(
      (response) => new URL(response.url()).pathname === base,
    );
    gate.release();
    await (await late).finished();
    await drained.promise;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(health(page)).toHaveCount(0);
    await expect(
      page.getByLabel('Operator key', { exact: true }),
    ).toBeVisible();
  } finally {
    await page.evaluate(() =>
      (
        window as typeof window & { worker401Body?: { restore: () => void } }
      ).worker401Body?.restore(),
    );
    gate.release();
    if (started) await drained.promise;
    await page.unroute(pattern, handler);
    await pool.end();
  }
});

test('E2E-WEB-354 competing operator conflict requires reload and Back cancels unconfirmed review @WORKER-HEALTH-001', async ({
  page,
  request,
}) => {
  await signIn(page);
  await loginWorkerOperator(request);
  await workerControl(request, 'reports', true, 1);
  await reports(page)
    .getByRole('button', { name: 'Review pause Saved reports', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm pause', exact: true })
    .click();
  await expect(health(page).getByRole('alert')).toContainText('changed');
  await page
    .getByRole('button', { name: 'Dismiss control retry', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reload worker health', exact: true })
    .click();
  await reports(page)
    .getByRole('button', { name: 'Review resume Saved reports', exact: true })
    .click();
  await page.goBack();
  await expect(page).toHaveURL(/#ops$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(reports(page)).toContainText('Mode: Paused');
  await page.getByRole('link', { name: '← Investor app', exact: true }).click();
  await expect(page).toHaveURL(/#today$/);
});
