import type { Page, Request, Route } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  seedQueue,
  signInQueue,
  queueDatabase,
  loginQueueOperator,
  reviewQueue,
} from '../../helpers/publishing-queue';
import { operatorKey } from '../../helpers/operator';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const pattern = /\/api\/v1\/ops\/discovery\/queue(?:\?|$)/;
const queue = (page: Page) =>
  page.getByRole('region', { name: 'Publishing queue', exact: true });
const cards = (page: Page) => queue(page).locator('article');
const reset = (page: Page) =>
  queue(page).getByRole('button', {
    name: 'Reset publishing queue',
    exact: true,
  });
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
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
  const idle = async () => {
    await expect.poll(() => active, { timeout: 10000 }).toBe(0);
  };
  return {
    handler,
    idle,
    async close(page: Page) {
      await page.unroute(pattern, handler);
      await idle();
    },
  };
}
async function actual(route: Route, origin: string) {
  const url = new URL(route.request().url());
  return route.fetch({ url: origin + url.pathname + url.search });
}
function ordinaryReads(page: Page) {
  const pending = new Set<Request>();
  const started = (r: Request) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/') && path != '/api/v1/ops/discovery/queue')
      pending.add(r);
  };
  const ended = (r: Request) => {
    pending.delete(r);
  };
  page.on('request', started);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  return {
    async idle() {
      await expect.poll(() => pending.size).toBe(0);
    },
    close() {
      page.off('request', started);
      page.off('requestfinished', ended);
      page.off('requestfailed', ended);
    },
  };
}
test('E2E-WEB-560 current queue filters pages keyboard empty reset and responsive layout @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  const entries = await seedQueue(feedbackSandbox);
  const legacy: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v1/ops/discovery/items')
      legacy.push(r.url());
  });
  await signInQueue(page);
  await expect(cards(page)).toHaveCount(20);
  await expect(cards(page).first()).toContainText(entries[0]!.item.title);
  const next = queue(page).getByRole('button', {
    name: 'Next publishing page',
  });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(queue(page).getByRole('status')).toContainText(
    '20 shown on page 2',
  );
  await expect(cards(page).first()).toContainText(entries[20]!.item.title);
  await expect(
    queue(page).getByRole('heading', { name: 'Publishing queue', exact: true }),
  ).toBeFocused();
  await next.click();
  await expect(cards(page)).toHaveCount(5);
  await expect(next).toBeDisabled();
  await queue(page)
    .getByRole('button', { name: 'Previous publishing page' })
    .click();
  await expect(cards(page).first()).toContainText(entries[20]!.item.title);
  await queue(page)
    .getByLabel('Publishing source', { exact: true })
    .selectOption('bea');
  await queue(page)
    .getByLabel('Publication status', { exact: true })
    .selectOption('published');
  await queue(page)
    .getByRole('button', { name: 'Apply publishing filters' })
    .click();
  await expect(cards(page)).toHaveCount(2);
  await expect(queue(page).getByText(/^Applied filters:/)).toContainText(
    'BEA; published',
  );
  await queue(page)
    .getByLabel('Search publication titles and summaries')
    .fill('absent');
  await expect(queue(page)).toContainText(
    'Filters changed. Apply them to update results.',
  );
  await expect(queue(page).getByText(/^Applied filters:/)).toContainText(
    'any title or summary',
  );
  await queue(page)
    .getByRole('button', { name: 'Apply publishing filters' })
    .click();
  await expect(queue(page)).toContainText(
    'No publication heads match this page.',
  );
  await reset(page).click();
  await expect(cards(page)).toHaveCount(20);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  // Deliberate screenshot includes only controlled synthetic source rows; the
  // operator key form is absent and no saved/private receipt is displayed.
  await page.screenshot({
    path: testInfo.outputPath('publishing-queue.png'),
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Source registry', exact: true })
    .click();
  await page.getByRole('button', { name: 'Publishing', exact: true }).click();
  await expect(cards(page)).toHaveCount(20);
  await page.reload();
  await expect(cards(page)).toHaveCount(20);
  expect(legacy).toEqual([]);
});
test('E2E-WEB-561 actual failed second-page storage read retries the same page while retaining a filter draft @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox);
  await signInQueue(page);
  await page.waitForLoadState('networkidle');
  const pool = await queueDatabase(feedbackSandbox);
  let renamed = false;
  const queries: string[] = [];
  page.on('request', (r) => {
    if (pattern.test(r.url())) queries.push(new URL(r.url()).search);
  });
  try {
    await pool.query(
      'ALTER TABLE discovery_versions RENAME TO queue_browser_unavailable',
    );
    renamed = true;
    await queue(page)
      .getByRole('button', { name: 'Next publishing page' })
      .click();
    await expect(queue(page).getByRole('alert')).toContainText(
      'Publishing queue unavailable',
    );
    await expect(cards(page)).toHaveCount(0);
    await queue(page)
      .getByLabel('Search publication titles and summaries')
      .fill('unsent filter draft');
    await pool.query(
      'ALTER TABLE queue_browser_unavailable RENAME TO discovery_versions',
    );
    renamed = false;
    await queue(page)
      .getByRole('button', { name: 'Retry publishing page' })
      .click();
    await expect(cards(page).first()).toContainText(entries[20]!.item.title);
    await expect(
      queue(page).getByLabel('Search publication titles and summaries'),
    ).toHaveValue('unsent filter draft');
    await expect(queue(page)).toContainText(
      'Filters changed. Apply them to update results.',
    );
    await expect(queue(page).getByText(/^Applied filters:/)).toContainText(
      'any title or summary',
    );
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe(queries[1]);
  } finally {
    if (renamed)
      await pool.query(
        'ALTER TABLE queue_browser_unavailable RENAME TO discovery_versions',
      );
    await pool.end();
  }
});
test('E2E-WEB-562 exact-head review conflicts then preserves saved receipt through a failed queue refresh @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox, 1),
    item = entries[0]!.item;
  await loginQueueOperator(request);
  await signInQueue(page);
  await page
    .getByRole('button', { name: `Review ${item.title}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review publication' });
  await expect(
    dialog.getByText('Current head: edition 1', { exact: false }),
  ).toBeVisible();
  await reviewQueue(request, item, 'withdrawn');
  await dialog
    .getByLabel('Review note', { exact: true })
    .fill('Synthetic queue stale review');
  await dialog
    .getByRole('button', { name: 'Publish reviewed edition' })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await dialog.getByRole('button', { name: 'Reload current review' }).click();
  await expect(
    dialog.getByText('Current head: edition 2', { exact: false }),
  ).toBeVisible();
  let fail = true;
  const routes = trackedRoutes(async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic queue refresh outage' }),
      });
    else
      await route.fulfill({
        response: await actual(route, feedbackSandbox.apiOrigin),
      });
  });
  await page.route(pattern, routes.handler);
  try {
    await dialog
      .getByLabel('Review note', { exact: true })
      .fill('Synthetic exact updated review');
    await dialog
      .getByRole('button', { name: 'Publish reviewed edition' })
      .click();
    await expect(dialog.getByRole('status')).toContainText(
      'Saved published edition 3',
    );
    await expect(queue(page).getByRole('alert')).toContainText(
      'Synthetic queue refresh outage',
    );
    await expect(cards(page)).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: 'Publish reviewed edition' }),
    ).toHaveCount(0);
    fail = false;
    await page.keyboard.press('Escape');
    await expect(
      queue(page).getByRole('heading', {
        name: 'Publishing queue',
        exact: true,
      }),
    ).toBeFocused();
    await queue(page)
      .getByRole('button', { name: 'Retry publishing page' })
      .click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('published · v3');
    const pool = await queueDatabase(feedbackSandbox);
    try {
      expect(
        (
          await pool.query<{ version: number }>(
            'SELECT version FROM discovery_versions WHERE item_id=$1 ORDER BY version',
            [item.id],
          )
        ).rows,
      ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    } finally {
      await pool.end();
    }
  } finally {
    fail = false;
    await routes.close(page);
  }
});
test('E2E-WEB-563 held old successful page cannot restore changed filters and malformed page fails closed @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedQueue(feedbackSandbox);
  await signInQueue(page);
  await page.waitForLoadState('networkidle');
  const gate = deferred(),
    ready = deferred();
  let hold = true,
    malformed = false,
    invalidPage = false;
  const routes = trackedRoutes(async (route) => {
    if (invalidPage) {
      const response = await route.fetch({
        url:
          feedbackSandbox.apiOrigin +
          '/api/v1/ops/discovery/queue?cursor=invalid',
      });
      expect(response.status()).toBe(400);
      await route.fulfill({ response });
      return;
    }
    const shouldHold = hold;
    const response = await actual(route, feedbackSandbox.apiOrigin);
    expect(response.status()).toBe(200);
    if (shouldHold) {
      ready.release();
      await gate.promise;
    }
    if (malformed)
      await route.fulfill({
        response,
        json: {
          ...(await response.json()),
          unapprovedExtra: 'synthetic secret extra',
        },
      });
    else await route.fulfill({ response });
  });
  await page.route(pattern, routes.handler);
  try {
    await reset(page).click();
    await ready.promise;
    hold = false;
    await queue(page)
      .getByLabel('Publishing source', { exact: true })
      .selectOption('bea');
    await queue(page)
      .getByRole('button', { name: 'Apply publishing filters' })
      .click();
    await expect(cards(page)).toHaveCount(6);
    gate.release();
    await routes.idle();
    await expect(cards(page)).toHaveCount(6);
    malformed = true;
    await reset(page).click();
    await expect(queue(page).getByRole('alert')).toContainText(
      'The publishing page could not be read.',
    );
    await expect(cards(page)).toHaveCount(0);
    await expect(queue(page)).not.toContainText('synthetic secret extra');
    malformed = false;
    invalidPage = true;
    await reset(page).click();
    await expect(queue(page).getByRole('alert')).toContainText(
      'Reset the publishing queue',
    );
    await expect(
      queue(page).getByRole('button', { name: 'Retry publishing page' }),
    ).toHaveCount(0);
    invalidPage = false;
    await reset(page).click();
    await expect(cards(page)).toHaveCount(20);
  } finally {
    gate.release();
    await routes.close(page);
  }
});

for (const relogin of [false, true]) {
  test(`E2E-WEB-${relogin ? '565' : '564'} real late queue401 after leaving Publishing ${relogin ? 'cannot sign out a new session' : 'clears the same protected parent session'} @PUBLISHING-QUEUE-001 @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    await seedQueue(feedbackSandbox, 1);
    const ordinary = ordinaryReads(page);
    await signInQueue(page);
    await page.waitForLoadState('networkidle');
    const entered = deferred(),
      fetchGate = deferred(),
      denialReady = deferred(),
      release = deferred();
    const routes = trackedRoutes(async (route) => {
      entered.release();
      await fetchGate.promise;
      const response = await actual(route, feedbackSandbox.apiOrigin);
      expect(response.status()).toBe(401);
      denialReady.release();
      await release.promise;
      await route.fulfill({ response });
    });
    const pool = await queueDatabase(feedbackSandbox);
    await page.route(pattern, routes.handler);
    try {
      await reset(page).click();
      await entered.promise;
      await page
        .getByRole('button', { name: 'Audit activity', exact: true })
        .click();
      await expect(
        page
          .getByRole('region', { name: 'Audit activity', exact: true })
          .getByRole('button', { name: 'Back to Publishing' }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Audit activity', exact: true }),
      ).toContainText('No activity matches these filters.');
      await ordinary.idle();
      await pool.query(
        'UPDATE operator_sessions SET expires_at=clock_timestamp()',
      );
      fetchGate.release();
      await denialReady.promise;
      await expect(
        page.getByRole('button', { name: 'Sign out of operations' }),
      ).toBeVisible();
      if (relogin) {
        await page
          .getByRole('button', { name: 'Sign out of operations' })
          .click();
        await page
          .getByLabel('Operator key', { exact: true })
          .fill(await operatorKey());
        await page
          .getByRole('button', { name: 'Sign in to operations', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Sign out of operations' }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            async () =>
              (await (await fetch('/api/v1/ops/session')).json()).authenticated,
          ),
        ).toBe(true);
      }
      release.release();
      await routes.idle();
      if (relogin) {
        await expect(
          page.getByRole('button', { name: 'Sign out of operations' }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            async () =>
              (await (await fetch('/api/v1/ops/session')).json()).authenticated,
          ),
        ).toBe(true);
      } else {
        await expect(
          page.getByRole('button', {
            name: 'Sign in to operations',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('region', { name: 'Audit activity', exact: true }),
        ).toHaveCount(0);
        await expect(queue(page)).toHaveCount(0);
      }
    } finally {
      fetchGate.release();
      release.release();
      await routes.close(page);
      ordinary.close();
      await pool.end();
    }
  });
}
