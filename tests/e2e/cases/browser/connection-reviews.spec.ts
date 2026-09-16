import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';
import {
  ConnectionReviewInboxSchema,
  ConnectionReviewReceiptSchema,
  type ConnectionReviewReceipt,
} from '../../../../packages/contracts/src/index';
import {
  seedConnectionSource,
  prepareConnectionBrowser,
  reviseConnectionSourceFixture,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';

const reviewBase = '/api/v1/account/connection-reviews';
const privateNote =
  'Synthetic inbox question for delayed private receipt testing.';

async function prepareReview(page: Page, sandbox: FeedbackSandbox) {
  const source = await seedConnectionSource(sandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const id = randomUUID();
  await page.evaluate(
    async ({ source, id, note }) => {
      const response = await fetch(
        `/api/v1/account/research-connections/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            requestId: crypto.randomUUID(),
            expectedVersion: 0,
            source: {
              itemId: source.id,
              version: source.version,
              sourceHash: source.sourceHash,
            },
            target: { kind: 'holding', id: 'INE002A01018', version: 1 },
            note,
            storageConsent: true,
          }),
        },
      );
      if (!response.ok) throw Error(`Connection fixture ${response.status}`);
    },
    { source, id, note: privateNote },
  );
  await reviseConnectionSourceFixture(sandbox, source, 'withdrawn');
  await page.goto('/#connection-reviews');
  await expect(
    page.getByRole('button', { name: 'Check for updates', exact: true }),
  ).toBeEnabled();
  return id;
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function paint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
test('E2E-WEB-310 manual review check acknowledge filters reload and failed refresh retain dated notice @CONNECTION-REVIEWS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const id = randomUUID();
  await page.evaluate(
    async ({ source, id }) => {
      const r = await fetch(`/api/v1/account/research-connections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          requestId: crypto.randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: { kind: 'holding', id: 'INE002A01018', version: 1 },
          note: 'Synthetic inbox question.',
          storageConsent: true,
        }),
      });
      if (!r.ok) throw Error(`Connection fixture ${r.status}`);
    },
    { source, id },
  );
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  await page.goto('/#connections');
  const inboxLink = page.getByRole('link', {
    name: 'Review inbox',
    exact: true,
  });
  await inboxLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#connection-reviews$/);
  await page
    .getByRole('button', { name: 'Check for updates', exact: true })
    .click();
  const notices = page.getByRole('region', { name: 'Review notices' });
  await expect(notices).toContainText('withdrawn');
  await page
    .getByRole('button', {
      name: 'Open connection receipt for INE002A01018',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Connection receipt' }),
  ).toContainText('Synthetic inbox question.');
  await page
    .getByRole('button', {
      name: 'Acknowledge notice for INE002A01018',
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Connection review inbox' })
      .getByRole('status'),
  ).toContainText('Acknowledgement recorded');
  await page
    .getByLabel('Show notices', { exact: true })
    .selectOption('acknowledged');
  await expect(notices).toContainText('does not reaffirm');
  await page.reload();
  await page
    .getByLabel('Show notices', { exact: true })
    .selectOption('acknowledged');
  await expect(notices).toContainText('acknowledged');
  await page.screenshot({
    path: test.info().outputPath('connection-review-inbox.png'),
    fullPage: false,
  });
  await page.route('**/api/v1/account/connection-reviews', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic inbox refresh outage.' }),
    }),
  );
  await page
    .getByRole('button', { name: 'Reload saved inbox', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic inbox refresh outage',
  );
  await expect(notices).toContainText('acknowledged');
  await expect(page.getByRole('note')).toContainText(
    'Current saved inbox status is unavailable',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Show notices', { exact: true }).focus();
  await expect(page.getByLabel('Show notices', { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

// Faults below affect delivery/status only. Every successful response comes from
// the isolated real API and each mutation commits against the owned schema.
test('E2E-WEB-311 lost check and acknowledgement replay retain historical receipts through failed refresh and TTL reuse @CONNECTION-REVIEWS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const id = await prepareReview(page, feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  let failRefresh = false;
  const duplicateKeyErrors: string[] = [];
  page.on('console', (message) => {
    if (/same key|unique.*key/i.test(message.text()))
      duplicateKeyErrors.push(message.text());
  });
  const refreshPattern = '**/api/v1/account/connection-reviews';
  await page.route(refreshPattern, (route) =>
    failRefresh
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message:
              'Synthetic inbox refresh outage after committed operation.',
          }),
        })
      : route.fallback(),
  );
  const writes = new Map<string, string[]>();
  const receipts = new Map<string, ConnectionReviewReceipt[]>();
  const mutationPattern =
    /\/api\/v1\/account\/connection-reviews\/(?:check|[^/]+\/acknowledge)$/;
  await page.route(mutationPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const requests = writes.get(path) ?? [];
    requests.push(route.request().postData()!);
    writes.set(path, requests);
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}${path}`,
    });
    expect(response.ok()).toBe(true);
    const receipt = ConnectionReviewReceiptSchema.parse(await response.json());
    receipts.set(path, [...(receipts.get(path) ?? []), receipt]);
    if (requests.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  const inbox = page.getByRole('region', {
    name: 'Connection review inbox',
    exact: true,
  });
  const notices = page.getByRole('region', {
    name: 'Review notices',
    exact: true,
  });
  try {
    for (const action of [
      {
        path: `${reviewBase}/check`,
        button: 'Check for updates',
        label: 'Update check',
      },
      {
        path: `${reviewBase}/${id}/acknowledge`,
        button: 'Acknowledge notice for INE002A01018',
        label: 'Acknowledgement',
      },
    ]) {
      await page
        .getByRole('button', { name: action.button, exact: true })
        .click();
      await expect(inbox.getByRole('alert')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Retry last operation', exact: true }),
      ).toBeEnabled();
      const committed = receipts.get(action.path)![0]!;
      const saved = await pool.query(
        'SELECT * FROM app_connection_review_requests WHERE request_id=$1 AND user_id=(SELECT user_id FROM app_research_connections WHERE id=$2)',
        [committed.requestId, id],
      );
      const cryptoUrl = new URL(
        '../../../../apps/api/dist/private-data-crypto.js',
        import.meta.url,
      ).href;
      const { openPrivateJson } = await import(cryptoUrl);
      expect(saved.rows[0].payload).toBeNull();
      expect(
        openPrivateJson(
          'connection-review',
          saved.rows[0].user_id,
          committed.requestId,
          saved.rows[0].encrypted_payload,
          feedbackSandbox.privateDataKeys,
        ),
      ).toEqual(committed);
      failRefresh = true;
      await page
        .getByRole('button', { name: 'Retry last operation', exact: true })
        .click();
      await expect(inbox.getByRole('status')).toContainText(
        `${action.label} recorded`,
      );
      await expect(inbox.getByRole('status')).toContainText(
        'historical operation receipt does not establish current inbox status',
      );
      await expect(inbox.getByRole('alert')).toContainText(
        'Synthetic inbox refresh outage',
      );
      await expect(inbox.getByRole('note')).toContainText(
        'Current saved inbox status is unavailable',
      );
      expect(writes.get(action.path)).toHaveLength(2);
      expect(writes.get(action.path)![1]).toBe(writes.get(action.path)![0]);
      expect(receipts.get(action.path)).toEqual([committed, committed]);
      if (committed.action === 'acknowledge') {
        // The server has acknowledged it, but the old open notice remains dated
        // and disabled until an independent current inbox read succeeds.
        await expect(notices).toContainText('Status: open');
        await expect(
          page.getByRole('button', { name: action.button, exact: true }),
        ).toBeDisabled();
      }
      failRefresh = false;
      await page
        .getByRole('button', { name: 'Reload saved inbox', exact: true })
        .click();
      await expect(inbox.getByRole('note')).toHaveCount(0);
      await expect(inbox.getByRole('alert')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Retry last operation', exact: true }),
      ).toHaveCount(0);
    }
    await page
      .getByLabel('Show notices', { exact: true })
      .selectOption('acknowledged');
    await expect(notices).toContainText('Status: acknowledged');
    const check = receipts.get(`${reviewBase}/check`)![0]!;
    // Expire only the owned idempotency row. Its retained evaluation remains,
    // and the same ID legitimately creates a second, differently dated check.
    await pool.query(
      "UPDATE app_connection_review_requests SET created_at=clock_timestamp()-interval '31 days' WHERE request_id=$1 AND user_id=(SELECT user_id FROM app_research_connections WHERE id=$2)",
      [check.requestId, id],
    );
    await page.unroute(mutationPattern);
    const fresh = ConnectionReviewReceiptSchema.parse(
      await page.evaluate(
        async ({ base, requestId }) => {
          const response = await fetch(`${base}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId }),
          });
          if (!response.ok)
            throw Error(`Fresh expired-ID check ${response.status}`);
          return response.json();
        },
        { base: reviewBase, requestId: check.requestId },
      ),
    );
    expect(fresh.recordedAt).not.toBe(check.recordedAt);
    await page
      .getByRole('button', { name: 'Reload saved inbox', exact: true })
      .click();
    await expect(inbox.getByRole('note')).toHaveCount(0);
    await page
      .getByText('Recent checks and retention', { exact: true })
      .click();
    await expect(
      inbox.locator('details > p').filter({ hasText: /notices changed/ }),
    ).toHaveCount(2);
    expect(duplicateKeyErrors).toEqual([]);
    const persisted = await pool.query(
      'SELECT * FROM app_connection_review_inboxes WHERE user_id=(SELECT user_id FROM app_research_connections WHERE id=$1)',
      [id],
    );
    const cryptoUrl = new URL(
      '../../../../apps/api/dist/private-data-crypto.js',
      import.meta.url,
    ).href;
    const { openPrivateJson } = await import(cryptoUrl);
    expect(persisted.rows[0].payload).toBeNull();
    const state = ConnectionReviewInboxSchema.parse(
      openPrivateJson(
        'connection-inbox',
        persisted.rows[0].user_id,
        persisted.rows[0].user_id,
        persisted.rows[0].encrypted_payload,
        feedbackSandbox.privateDataKeys,
      ),
    );
    expect(state.evaluations.map((evaluation) => evaluation.requestId)).toEqual(
      [check.requestId, check.requestId],
    );
    expect(state.notices[0]?.status).toBe('acknowledged');
  } finally {
    await page.unroute(refreshPattern);
    await page.unroute(mutationPattern);
    await pool.end();
  }
});

test('E2E-WEB-312 actual receipt401 immediately clears private inbox despite held earlier successful GET @CONNECTION-REVIEWS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const id = await prepareReview(page, feedbackSandbox);
  await page
    .getByRole('button', { name: 'Check for updates', exact: true })
    .click();
  const trigger = page.getByRole('button', {
    name: 'Open connection receipt for INE002A01018',
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole('region', { name: 'Connection receipt', exact: true }),
  ).toContainText(privateNote);
  const pool = await connectionDatabase(feedbackSandbox);
  const gate = deferred(),
    completed = deferred();
  let started = false,
    held = false;
  const pattern = '**/api/v1/account/connection-reviews';
  const handler = async (route: Route) => {
    started = true;
    try {
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}${reviewBase}`,
        timeout: 15000,
      });
      expect(response.status()).toBe(200);
      held = true;
      await gate.promise;
      await route.fulfill({ response });
    } finally {
      completed.release();
    }
  };
  await page.route(pattern, handler);
  try {
    await page
      .getByRole('button', { name: 'Reload saved inbox', exact: true })
      .click();
    await expect.poll(() => held).toBe(true);
    await pool.query(
      'UPDATE app_sessions SET expires_at=clock_timestamp() WHERE user_id=(SELECT user_id FROM app_research_connections WHERE id=$1)',
      [id],
    );
    const denial = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/v1/account/research-connections/${id}/history`,
    );
    await trigger.click();
    expect((await denial).status()).toBe(401);
    const signIn = page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    });
    await expect(signIn).toBeVisible();
    await expect(
      page.getByRole('region', {
        name: 'Connection review inbox',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Connection receipt', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(privateNote, { exact: true })).toHaveCount(0);
    const late = page.waitForResponse(
      (response) => new URL(response.url()).pathname === reviewBase,
    );
    gate.release();
    expect((await late).status()).toBe(200);
    await (await late).finished();
    await completed.promise;
    await paint(page);
    await expect(signIn).toBeVisible();
    await expect(
      page.getByRole('region', {
        name: 'Connection review inbox',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.getByText(privateNote, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Update check recorded/)).toHaveCount(0);
    await signIn.click();
    await expect(page).toHaveURL(/#account\?next=connection-reviews$/);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  } finally {
    gate.release();
    if (started) await completed.promise;
    await page.unroute(pattern, handler);
    await pool.end();
  }
});

test('E2E-WEB-313 keyboard Close during a real pending receipt read prevents late reopening and restores focus @CONNECTION-REVIEWS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await prepareReview(page, feedbackSandbox);
  await page
    .getByRole('button', { name: 'Check for updates', exact: true })
    .click();
  const pattern = `**/api/v1/account/research-connections/${id}/history`;
  const gate = deferred(),
    completed = deferred();
  let started = false,
    held = false;
  const handler = async (route: Route) => {
    started = true;
    try {
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}/api/v1/account/research-connections/${id}/history`,
        timeout: 15000,
      });
      expect(response.status()).toBe(200);
      held = true;
      await gate.promise;
      await route.fulfill({ response });
    } finally {
      completed.release();
    }
  };
  await page.route(pattern, handler);
  const trigger = page.getByRole('button', {
    name: 'Open connection receipt for INE002A01018',
    exact: true,
  });
  const reader = page.getByRole('region', {
    name: 'Connection receipt',
    exact: true,
  });
  try {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => held).toBe(true);
    await expect(reader.getByRole('status')).toContainText(
      'Loading saved connection receipt',
    );
    const close = reader.getByRole('button', {
      name: 'Close receipt',
      exact: true,
    });
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(reader).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const late = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/v1/account/research-connections/${id}/history`,
    );
    gate.release();
    expect((await late).status()).toBe(200);
    await (await late).finished();
    await completed.promise;
    await paint(page);
    await expect(reader).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.unroute(pattern, handler);
    // A new deliberate open still reads and displays the actual owned receipt.
    await page.keyboard.press('Enter');
    await expect(reader).toContainText(privateNote);
    await expect(
      reader.getByRole('heading', {
        name: 'Saved connection receipt',
        exact: true,
      }),
    ).toBeFocused();
    await expect(reader).toContainText(
      'does not establish current publication or financial impact',
    );
    await reader
      .getByRole('button', { name: 'Close receipt', exact: true })
      .click();
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  } finally {
    gate.release();
    if (started) await completed.promise;
    await page.unroute(pattern, handler);
  }
});
