import { test, expect } from '../../helpers/app-fixture';
import {
  withdrawalFixture,
  withdrawReview,
} from '../../helpers/withdrawal-fixture';
import { operatorKey } from '../../helpers/operator';
import { createHash } from 'node:crypto';
import type { Request, Route } from '@playwright/test';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-460 protected comparison evidence Back and exact-head publication @SOURCE-REVIEW-DIFF-001', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      const r = await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!r.ok) throw Error('Operator login failed');
    },
    await operatorKey(),
  );
  await page.reload();
  await page
    .getByRole('button', { name: `Review ${first.title}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review publication' });
  await expect(
    dialog.getByText('No prior public-state edition.', { exact: false }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Current retained evidence' })
    .click();
  await expect(
    dialog.getByRole('heading', { name: 'Retained evidence' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to comparison' }).click();
  // Deliberate safe visual artifact: this owned fixture contains controlled
  // synthetic source text, with no operator credential or saved receipt shown.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('source-review-before-publication.png'),
    fullPage: false,
  });
  await withdrawReview(request, first, 'withdrawn');
  await dialog
    .getByLabel('Review note', { exact: true })
    .fill('Synthetic reviewed correction');
  await dialog
    .getByRole('button', { name: 'Publish reviewed edition' })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await dialog.getByRole('button', { name: 'Reload current review' }).click();
  await expect(
    dialog.getByText(`Current head: edition ${first.version + 1}`, {
      exact: false,
    }),
  ).toBeVisible();
  await dialog
    .getByLabel('Review note', { exact: true })
    .fill('Synthetic confirmed republication');
  await dialog
    .getByRole('button', { name: 'Publish reviewed edition' })
    .click();
  await expect(dialog.getByRole('status')).toContainText(
    `Saved published edition ${first.version + 2}`,
  );
  await expect(
    dialog.getByRole('button', { name: 'Publish reviewed edition' }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
test('E2E-WEB-461 actual denied evidence clears protected review @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  await page
    .getByRole('button', { name: `Review ${first.title}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review publication' });
  await expect(dialog.getByLabel('Review note')).toBeVisible();
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
  } finally {
    await pool.end();
  }
  const denied = page.waitForResponse(
    (r) =>
      r.url().includes(`/items/${first.id}/evidence`) && r.status() === 401,
  );
  await dialog
    .getByRole('button', { name: 'Current retained evidence' })
    .click();
  await denied;
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(first.title, { exact: true })).toHaveCount(0);
});
test('E2E-WEB-462 closing a held real comparison cannot reopen protected reader @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  let release!: () => void,
    finish!: () => void,
    started = false,
    active = 0;
  const gate = new Promise<void>((r) => (release = r)),
    drained = new Promise<void>((r) => (finish = r));
  const statuses: number[] = [];
  await page.route(
    `**/ops/discovery/items/${first.id}/comparison?*`,
    async (route) => {
      started = true;
      active++;
      try {
        const url = new URL(route.request().url());
        const actual = await route.fetch({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
        statuses.push(actual.status());
        await gate;
        await route.fulfill({ response: actual }).catch(() => {});
      } finally {
        active--;
        finish();
      }
    },
  );
  try {
    await page
      .getByRole('button', { name: `Review ${first.title}`, exact: true })
      .click();
    await expect.poll(() => statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 200)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('dialog', { name: 'Review publication' }),
    ).toHaveCount(0);
    release();
    await drained;
    await expect.poll(() => active).toBe(0);
    await expect(
      page.getByRole('dialog', { name: 'Review publication' }),
    ).toHaveCount(0);
  } finally {
    release();
    if (started) {
      await drained;
      await expect.poll(() => active).toBe(0);
    }
    await page.unroute(`**/ops/discovery/items/${first.id}/comparison?*`);
  }
});

test('E2E-WEB-463 evidence401 arriving after review Close clears the still-authenticated parent @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const evidencePath = `/api/v1/ops/discovery/items/${first.id}/evidence`;
  const pattern = `**${evidencePath}?*`;
  const ordinary = new Set<Request>();
  const began = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && url.pathname !== evidencePath)
      ordinary.add(request);
  };
  const ended = (request: Request) => {
    ordinary.delete(request);
  };
  page.on('request', began);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  let releaseFetch!: () => void, releaseDenial!: () => void;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  const denialGate = new Promise<void>((resolve) => {
    releaseDenial = resolve;
  });
  let active = 0,
    started = false,
    routeFailed = false;
  const statuses: number[] = [];
  const handler = async (route: Route) => {
    active++;
    started = true;
    try {
      // Closing the review happens before this request reaches its actual API.
      await fetchGate;
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
      statuses.push(response.status());
      // The parent must remain signed in until this genuine denial is delivered.
      await denialGate;
      await route.fulfill({ response });
    } catch {
      routeFailed = true;
      await route.abort('failed').catch(() => {});
    } finally {
      active--;
    }
  };
  await page.route(pattern, handler);
  try {
    await page.goto('/#ops');
    await page.evaluate(
      async (key) => {
        const response = await fetch('/api/v1/ops/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        if (!response.ok) throw Error('Owned operator sign-in failed.');
      },
      await operatorKey(),
    );
    await page.reload();
    const review = page.getByRole('button', {
      name: `Review ${first.title}`,
      exact: true,
    });
    await review.click();
    const dialog = page.getByRole('dialog', {
      name: 'Review publication',
      exact: true,
    });
    await expect(
      dialog.getByLabel('Review note', { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole('button', { name: 'Current retained evidence', exact: true })
      .click();
    await expect.poll(() => started).toBe(true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(review).toBeVisible();
    await expect.poll(() => ordinary.size).toBe(0);
    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'f360_ops',
    );
    if (!session) throw Error('Owned browser operator session is missing.');
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      const expired = await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
        [createHash('sha256').update(session.value).digest('hex')],
      );
      expect(expired.rowCount).toBe(1);
    } finally {
      await pool.end();
    }
    releaseFetch();
    await expect.poll(() => statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 401)).toBe(true);
    await expect.poll(() => ordinary.size).toBe(0);
    await expect(review).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toHaveCount(0);
    releaseDenial();
    await expect.poll(() => active).toBe(0);
    expect(routeFailed).toBe(false);
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toBeVisible();
    await expect(review).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(first.title, { exact: true })).toHaveCount(0);
  } finally {
    releaseFetch();
    releaseDenial();
    await page.unroute(pattern, handler);
    await expect.poll(() => active).toBe(0);
    page.off('request', began);
    page.off('requestfinished', ended);
    page.off('requestfailed', ended);
  }
});

test('E2E-WEB-464 held denial from a closed reader cannot sign out a later real operations session @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const evidencePath = `/api/v1/ops/discovery/items/${first.id}/evidence`;
  const pattern = `**${evidencePath}?*`;
  const ordinary = new Set<Request>();
  const began = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && url.pathname !== evidencePath)
      ordinary.add(request);
  };
  const ended = (request: Request) => {
    ordinary.delete(request);
  };
  page.on('request', began);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  let releaseFetch!: () => void, releaseDenial!: () => void;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  const denialGate = new Promise<void>((resolve) => {
    releaseDenial = resolve;
  });
  let active = 0,
    started = false,
    routeFailed = false;
  const statuses: number[] = [];
  const handler = async (route: Route) => {
    active++;
    started = true;
    try {
      await fetchGate;
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
      statuses.push(response.status());
      await denialGate;
      await route.fulfill({ response });
    } catch {
      routeFailed = true;
      await route.abort('failed').catch(() => {});
    } finally {
      active--;
    }
  };
  await page.route(pattern, handler);
  const serverAuthenticated = async () =>
    page.evaluate(async () => {
      const response = await fetch('/api/v1/ops/session');
      if (!response.ok) return false;
      const session = await response.json();
      return session.authenticated === true;
    });
  try {
    await page.goto('/#ops');
    await page.evaluate(
      async (key) => {
        const response = await fetch('/api/v1/ops/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        if (!response.ok) throw Error('Owned operator sign-in failed.');
      },
      await operatorKey(),
    );
    await page.reload();
    const review = page.getByRole('button', {
      name: `Review ${first.title}`,
      exact: true,
    });
    await review.click();
    const dialog = page.getByRole('dialog', {
      name: 'Review publication',
      exact: true,
    });
    await expect(
      dialog.getByLabel('Review note', { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole('button', { name: 'Current retained evidence', exact: true })
      .click();
    await expect.poll(() => started).toBe(true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(review).toBeVisible();
    await expect.poll(() => ordinary.size).toBe(0);
    const previous = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'f360_ops',
    );
    if (!previous) throw Error('Owned browser operator session is missing.');
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      const expired = await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
        [createHash('sha256').update(previous.value).digest('hex')],
      );
      expect(expired.rowCount).toBe(1);
    } finally {
      await pool.end();
    }
    releaseFetch();
    await expect.poll(() => statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 401)).toBe(true);
    // The genuine old denial is already captured and still withheld.
    await page
      .getByRole('button', { name: 'Sign out of operations', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Operator key', { exact: true })
      .fill(await operatorKey());
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await expect(review).toBeVisible();
    await expect.poll(() => ordinary.size).toBe(0);
    const current = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'f360_ops',
    );
    expect(Boolean(current && current.value !== previous.value)).toBe(true);
    expect(await serverAuthenticated()).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toHaveCount(0);
    releaseDenial();
    await expect.poll(() => active).toBe(0);
    expect(routeFailed).toBe(false);
    await expect.poll(() => ordinary.size).toBe(0);
    await expect(review).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toHaveCount(0);
    expect(await serverAuthenticated()).toBe(true);
  } finally {
    releaseFetch();
    releaseDenial();
    await page.unroute(pattern, handler);
    await expect.poll(() => active).toBe(0);
    page.off('request', began);
    page.off('requestfinished', ended);
    page.off('requestfailed', ended);
  }
});
