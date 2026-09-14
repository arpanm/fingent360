import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  auditDatabase,
  seedAudit,
  signInAudit,
  syntheticSource,
} from '../../helpers/operator-audit';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const pattern = /\/api\/v1\/ops\/audit(?:\?|$)/;
const activity = (page: Page) =>
  page.getByRole('region', { name: 'Audit activity', exact: true });
const rows = (page: Page) =>
  page
    .getByRole('list', { name: 'Recorded audit activity', exact: true })
    .locator(':scope > li');
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function actualResponse(route: Route, apiOrigin: string) {
  const url = new URL(route.request().url());
  return route.fetch({ url: `${apiOrigin}${url.pathname}${url.search}` });
}
function trackedRoutes(work: (route: Route) => Promise<void>) {
  let active = 0;
  const handler = async (route: Route) => {
    active++;
    try {
      await work(route);
    } finally {
      active--;
    }
  };
  const waitForIdle = async () => {
    await expect
      .poll(() => active, {
        timeout: 10000,
        message:
          'Owned intercepted API reads must finish before assertions and fixture teardown.',
      })
      .toBe(0);
  };
  return {
    handler,
    activeCount: () => active,
    waitForIdle,
    async close(page: Page, pattern: RegExp | string) {
      await page.unroute(pattern, handler);
      await waitForIdle();
    },
  };
}

test('E2E-WEB-480 audit keyboard pages filters dates section navigation reload and mobile layout @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  const expected = await seedAudit(feedbackSandbox);
  await signInAudit(page);
  await expect(
    activity(page).getByRole('heading', {
      name: 'Audit activity',
      exact: true,
    }),
  ).toBeFocused();
  await expect(rows(page)).toHaveCount(50);
  await expect(rows(page).first()).toContainText(expected[0]!.recordedAt);
  await expect(activity(page)).toContainText(
    'A request does not prove completed work',
  );
  const older = page.getByRole('button', {
    name: 'Older activity',
    exact: true,
  });
  await older.focus();
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveCount(100);
  await expect(rows(page).nth(50)).toBeFocused();
  await older.click();
  await expect(rows(page)).toHaveCount(115);
  await expect(activity(page)).toContainText('End of this activity window.');
  await page
    .getByLabel('Activity section', { exact: true })
    .selectOption('sources');
  await page
    .getByLabel('From date (UTC, inclusive)', { exact: true })
    .fill('2026-01-02');
  await page
    .getByLabel('Through date (UTC, inclusive)', { exact: true })
    .fill('2026-01-02');
  await page
    .getByRole('button', { name: 'Apply filters', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(50);
  await expect(
    rows(page).getByRole('heading', {
      name: 'Source metadata creation requested',
      exact: true,
    }),
  ).toHaveCount(50);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('operator-audit-mobile.png'),
    fullPage: false,
  });
  await rows(page)
    .first()
    .getByRole('button', {
      name: 'Open Source registry results and history',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Add source metadata', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Audit activity', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to Publishing', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Source ingestion and editorial review',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Audit activity', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(50);
  await page.getByRole('link', { name: '← Investor app', exact: true }).click();
  await expect(page).toHaveURL(/#today$/);
});

test('E2E-WEB-481 actual recorded source actions populate empty audit without suggesting either request completed @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await signInAudit(page);
  await expect(activity(page)).toContainText(
    'No activity matches these filters.',
  );
  const result = await page.evaluate(async (source) => {
    const responses = [];
    for (const data of [source, { privateBody: 'synthetic secret feedback' }]) {
      const response = await fetch('/api/v1/ops/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      responses.push(response.status);
    }
    return responses;
  }, syntheticSource());
  expect(result).toEqual([201, 400]);
  await page
    .getByRole('button', { name: 'Reset and read latest', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(2);
  await expect(
    rows(page)
      .locator('p')
      .filter({ hasText: 'Request only — outcome not established here.' }),
  ).toHaveCount(2);
  await expect(activity(page)).not.toContainText('synthetic secret');
  await page
    .getByLabel('Activity section', { exact: true })
    .selectOption('retention');
  await page
    .getByRole('button', { name: 'Apply filters', exact: true })
    .click();
  await expect(activity(page)).toContainText(
    'No activity matches these filters.',
  );
});

test('E2E-WEB-482 initial and older-page faults recover exact pages while invalid dates cannot retry stale filters @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedAudit(feedbackSandbox, 55);
  let fault = true;
  await page.route(pattern, (route) =>
    fault
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic unavailable audit' }),
        })
      : route.fallback(),
  );
  await signInAudit(page);
  await expect(page.getByRole('alert')).toContainText(
    'Audit activity could not be read.',
  );
  fault = false;
  await page
    .getByRole('button', { name: 'Retry audit page', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(50);
  fault = true;
  await page
    .getByRole('button', { name: 'Older activity', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Displayed records are incomplete.',
  );
  await expect(rows(page)).toHaveCount(50);
  fault = false;
  await page
    .getByRole('button', { name: 'Retry audit page', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(55);
  await page
    .getByLabel('From date (UTC, inclusive)', { exact: true })
    .fill('2026-01-03');
  await page
    .getByLabel('Through date (UTC, inclusive)', { exact: true })
    .fill('2026-01-02');
  await page
    .getByRole('button', { name: 'Apply filters', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('valid UTC date range');
  await expect(
    page.getByRole('button', { name: 'Retry audit page', exact: true }),
  ).toHaveCount(0);
  await expect(rows(page)).toHaveCount(0);
  await page
    .getByLabel('From date (UTC, inclusive)', { exact: true })
    .fill('2026-01-02');
  await page
    .getByRole('button', { name: 'Apply filters', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(50);
});

test('E2E-WEB-483 older successful response cannot overwrite changed filters and malformed private extras fail closed @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedAudit(feedbackSandbox, 55);
  const held = deferred(),
    released = deferred(),
    ready = deferred();
  let holdInitial = true,
    malformed = false;
  const tracked = trackedRoutes(async (route) => {
    const hold = holdInitial;
    const response = await actualResponse(route, feedbackSandbox.apiOrigin);
    if (hold) {
      try {
        expect(response.status()).toBe(200);
        ready.release();
        await held.promise;
        await route.fulfill({ response });
      } finally {
        released.release();
      }
    } else if (malformed)
      await route.fulfill({
        response,
        json: {
          ...(await response.json()),
          actor_hash: 'synthetic private session detail',
        },
      });
    else await route.fulfill({ response });
  });
  await page.route(pattern, tracked.handler);
  try {
    await signInAudit(page);
    await ready.promise;
    holdInitial = false;
    await page
      .getByLabel('Activity section', { exact: true })
      .selectOption('sources');
    await page
      .getByRole('button', { name: 'Apply filters', exact: true })
      .click();
    await expect(rows(page)).toHaveCount(27);
    held.release();
    await released.promise;
    await tracked.waitForIdle();
    await expect(rows(page)).toHaveCount(27);
    await expect(
      rows(page).getByRole('heading', {
        name: 'Source metadata creation requested',
        exact: true,
      }),
    ).toHaveCount(27);
    malformed = true;
    await page
      .getByRole('button', { name: 'Reset and read latest', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Audit activity could not be read.',
    );
    await expect(activity(page)).not.toContainText('synthetic private session');
    await expect(rows(page)).toHaveCount(0);
  } finally {
    held.release();
    await tracked.close(page, pattern);
  }
});

test('E2E-WEB-484 real401 clears audit and parent publication reads before their held successful responses arrive @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedAudit(feedbackSandbox, 2);
  const source = await seedConnectionSource(feedbackSandbox);
  const auditHeld = deferred(),
    publicationHeld = deferred(),
    auditReady = deferred(),
    publicationReady = deferred();
  let holdAudit = false,
    publicationAdmitted = 0;
  const auditRoutes = trackedRoutes(async (route) => {
    const hold = holdAudit;
    const response = await actualResponse(route, feedbackSandbox.apiOrigin);
    if (hold) {
      expect(response.status()).toBe(200);
      auditReady.release();
      await auditHeld.promise;
    }
    await route.fulfill({ response });
  });
  const publicationRoutes = trackedRoutes(async (route) => {
    const response = await actualResponse(route, feedbackSandbox.apiOrigin);
    expect(response.status()).toBe(200);
    publicationAdmitted++;
    publicationReady.release();
    await publicationHeld.promise;
    await route.fulfill({ response });
  });
  await page.route(pattern, auditRoutes.handler);
  await page.route('**/api/v1/ops/discovery/items', publicationRoutes.handler);
  const pool = await auditDatabase(feedbackSandbox);
  try {
    await signInAudit(page);
    await expect(rows(page)).toHaveCount(2);
    await auditRoutes.waitForIdle();
    await publicationReady.promise;
    await expect
      .poll(() => publicationAdmitted === publicationRoutes.activeCount())
      .toBe(true);
    holdAudit = true;
    await page
      .getByRole('button', { name: 'Reset and read latest', exact: true })
      .click();
    await auditReady.promise;
    holdAudit = false;
    await pool.query('DELETE FROM operator_sessions');
    await page
      .getByRole('button', { name: 'Reset and read latest', exact: true })
      .click();
    await expect(
      page.getByLabel('Operator key', { exact: true }),
    ).toBeVisible();
    await expect(activity(page)).toHaveCount(0);
    auditHeld.release();
    publicationHeld.release();
    await Promise.all([
      auditRoutes.waitForIdle(),
      publicationRoutes.waitForIdle(),
    ]);
    await expect(
      page.getByLabel('Operator key', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(source.title, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('list', { name: 'Recorded audit activity', exact: true }),
    ).toHaveCount(0);
  } finally {
    auditHeld.release();
    publicationHeld.release();
    try {
      await Promise.all([
        auditRoutes.close(page, pattern),
        publicationRoutes.close(page, '**/api/v1/ops/discovery/items'),
      ]);
    } finally {
      await pool.end();
    }
  }
});

test('E2E-WEB-485 explicit sign-out invalidates a held audit page and protected navigation @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedAudit(feedbackSandbox, 2);
  const ready = deferred(),
    held = deferred();
  let hold = false;
  const tracked = trackedRoutes(async (route) => {
    const capture = hold;
    const response = await actualResponse(route, feedbackSandbox.apiOrigin);
    if (capture) {
      expect(response.status()).toBe(200);
      ready.release();
      await held.promise;
    }
    await route.fulfill({ response });
  });
  await page.route(pattern, tracked.handler);
  try {
    await signInAudit(page);
    await expect(rows(page)).toHaveCount(2);
    await tracked.waitForIdle();
    hold = true;
    await page
      .getByRole('button', { name: 'Reset and read latest', exact: true })
      .click();
    await ready.promise;
    await page
      .getByRole('button', { name: 'Sign out of operations', exact: true })
      .click();
    await expect(
      page.getByLabel('Operator key', { exact: true }),
    ).toBeVisible();
    held.release();
    await tracked.waitForIdle();
    await expect(activity(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Audit activity', exact: true }),
    ).toHaveCount(0);
  } finally {
    held.release();
    await tracked.close(page, pattern);
  }
});

test('E2E-WEB-486 actual delayed audit401 after Back still clears the parent protected publishing view @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const ready = deferred(),
    held = deferred();
  const tracked = trackedRoutes(async (route) => {
    ready.release();
    await held.promise;
    const response = await actualResponse(route, feedbackSandbox.apiOrigin);
    expect(response.status()).toBe(401);
    await route.fulfill({ response });
  });
  await page.route(pattern, tracked.handler);
  const pool = await auditDatabase(feedbackSandbox);
  try {
    await signInAudit(page);
    await ready.promise;
    await page
      .getByRole('button', { name: 'Back to Publishing', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: source.title, exact: true }),
    ).toBeVisible();
    await pool.query('DELETE FROM operator_sessions');
    held.release();
    await tracked.waitForIdle();
    await expect(
      page.getByLabel('Operator key', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: source.title, exact: true }),
    ).toHaveCount(0);
  } finally {
    held.release();
    try {
      await tracked.close(page, pattern);
    } finally {
      await pool.end();
    }
  }
});
