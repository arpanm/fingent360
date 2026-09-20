import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, expectReceived } from '../../helpers/feedback-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  FeedbackReceiptSchema,
  type FeedbackReceipt,
} from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const simulatedFailureHeaders = { 'access-control-allow-origin': '*' };
type Entry = {
  submission: { id: string; text: string; receiptToken: string };
  state: string;
  receipt: FeedbackReceipt | null;
  destination: string | null;
  attempts: number;
  nextAttemptAt: number | null;
  leaseId?: string;
  leaseUntil?: number;
};
async function owned(page: Page, text: string) {
  return page.evaluate(
    (text) =>
      new Promise<Entry>((resolve, reject) => {
        const open = indexedDB.open('fingent360-feedback');
        open.onerror = () =>
          reject(Error('Owned feedback storage did not open.'));
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction('outbox', 'readonly');
          const read = transaction.objectStore('outbox').get('state');
          read.onsuccess = () => {
            const record = (read.result?.records as Entry[] | undefined)?.find(
              (entry) => entry.submission.text === text,
            );
            if (record) resolve(record);
            else reject(Error('Owned feedback entry missing.'));
          };
          transaction.oncomplete = () => db.close();
          transaction.onerror = () => {
            db.close();
            reject(Error('Owned feedback read failed.'));
          };
        };
      }),
    text,
  );
}
async function settings(page: Page, origin: string, enabled: boolean) {
  await page.getByLabel('Feedback API URL', { exact: true }).fill(origin);
  await page
    .getByLabel('Automatically deliver submitted feedback', { exact: true })
    .setChecked(enabled);
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      enabled
        ? 'Feedback delivery enabled. Submitted reports will retry while the app is open.'
        : 'Feedback delivery paused. Reports remain on this device.',
      { exact: true },
    ),
  ).toBeVisible();
}
async function submit(page: Page, text: string) {
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer.getByLabel('Your feedback', { exact: true }).fill(text);
  await composer
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await composer
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Saved on this device' })
    .getByRole('link', { name: 'View feedback', exact: true })
    .click();
  return page.getByRole('article').filter({ hasText: text });
}
async function check(page: Page) {
  await page
    .getByRole('button', { name: 'Check delivery', exact: true })
    .click();
  await expect(
    page.getByText(
      'Delivery checked. Pending reports stay saved until acknowledged.',
      { exact: true },
    ),
  ).toBeVisible();
}

test('E2E-WEB-1123 attempted feedback stays at original destination and pause preserves an actual in-flight receipt @FEEDBACK-001 @TEST-SIMULATION', async ({
  page,
  context,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const text = 'TEST-SIMULATION original destination ' + randomUUID();
  const secondText = 'TEST-SIMULATION queued while paused ' + randomUUID();
  const alternate = 'https://feedback.invalid';
  let wrongDestination = 0;
  await context.route(alternate + '/**', async (route) => {
    wrongDestination++;
    await route.abort('failed');
  });
  let posts = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let committed: FeedbackReceipt | undefined;
  await context.route('**/api/v1/feedback', async (route) => {
    if (new URL(route.request().url()).origin === alternate) {
      wrongDestination++;
      return route.abort('failed');
    }
    if (route.request().method() !== 'POST') return route.fallback();
    posts++;
    if (posts === 1)
      return route.fulfill({
        status: 503,
        headers: simulatedFailureHeaders,
        json: { message: 'TEST-SIMULATION temporary unavailability' },
      });
    const actual = await route.fetch({
      url: feedbackSandbox.apiOrigin + '/api/v1/feedback',
    });
    expect(actual.status()).toBe(201);
    if (route.request().postDataJSON().text === text) {
      committed = FeedbackReceiptSchema.parse(await actual.json());
      await gate;
    }
    await route.fulfill({ response: actual });
  });
  try {
    await page.goto('/#feedback');
    await settings(page, feedbackSandbox.apiOrigin, true);
    const card = await submit(page, text);
    await expect(
      card.getByText('Needs attention', { exact: true }),
    ).toBeVisible();
    const attempted = await owned(page, text);
    expect(attempted.destination).toBe(feedbackSandbox.apiOrigin);
    await settings(page, alternate, true);
    await check(page);
    expect(posts).toBe(1);
    expect(wrongDestination).toBe(0);
    await expect(card).toContainText('Waiting for the original destination:');
    expect((await owned(page, text)).submission).toEqual(attempted.submission);
    await settings(page, feedbackSandbox.apiOrigin, true);
    // Retry deliberately starts the original destination; hold its real receipt.
    const retry = card
      .getByRole('button', { name: 'Retry delivery', exact: true })
      .click();
    await expect.poll(() => committed?.id).toBe(attempted.submission.id);
    // The initiating page is busy until its retry completes. Another actual
    // tab can pause the shared durable settings without cancelling that request.
    const controls = await context.newPage();
    await controls.goto('/#feedback');
    await settings(controls, feedbackSandbox.apiOrigin, false);
    const pending = await submit(controls, secondText);
    expect((await owned(controls, secondText)).attempts).toBe(0);
    release();
    await retry;
    await expectReceived(card);
    expect((await owned(page, text)).receipt?.receivedAt).toBe(
      committed!.receivedAt,
    );
    await check(controls);
    await expect(
      pending.getByText('Pending delivery', { exact: true }),
    ).toBeVisible();
    expect(posts).toBe(2);
    expect(wrongDestination).toBe(0);
    await settings(controls, feedbackSandbox.apiOrigin, true);
    await check(controls);
    await expectReceived(pending);
    expect(posts).toBe(3);
    await controls.close();
  } finally {
    release();
  }
});

test('E2E-WEB-1124 abandoned persisted lease blocks two tabs until expiry then one retry recovers the real receipt @FEEDBACK-001 @TEST-SIMULATION', async ({
  page,
  context,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const text = 'TEST-SIMULATION abandoned sender ' + randomUUID();
  let posts = 0;
  let committed: FeedbackReceipt | undefined;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/v1/feedback', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts++;
    const actual = await route.fetch({
      url: feedbackSandbox.apiOrigin + '/api/v1/feedback',
    });
    expect(actual.status()).toBe(201);
    if (posts === 1) {
      committed = FeedbackReceiptSchema.parse(await actual.json());
      await gate;
      // The deliberately closed first sender cannot process its real receipt.
      if (route.request().frame().page().isClosed()) return;
    }
    await route.fulfill({ response: actual });
  });
  try {
    await page.goto('/#feedback');
    await settings(page, feedbackSandbox.apiOrigin, true);
    await submit(page, text);
    await expect.poll(() => !!committed).toBe(true);
    const leased = await owned(page, text);
    expect(leased.state).toBe('sending');
    expect(leased.leaseId).toBeTruthy();
    expect(leased.leaseUntil).toBeGreaterThan(Date.now());
    await page.close();
    release();
    const tabs = await Promise.all([context.newPage(), context.newPage()]);
    for (const tab of tabs) {
      await tab.clock.setFixedTime(new Date(leased.leaseUntil! - 1));
      await tab.goto('/#feedback');
    }
    await Promise.all(tabs.map(check));
    expect(posts).toBe(1);
    expect((await owned(tabs[0]!, text)).leaseId).toBe(leased.leaseId);
    for (const tab of tabs)
      await tab.clock.setFixedTime(new Date(leased.leaseUntil! + 1));
    await Promise.all(tabs.map(check));
    for (const tab of tabs)
      await expectReceived(tab.getByRole('article').filter({ hasText: text }));
    const recovered = await owned(tabs[0]!, text);
    expect(posts).toBe(2);
    expect(recovered.submission).toEqual(leased.submission);
    expect(recovered.attempts).toBe(2);
    expect(recovered.receipt?.receivedAt).toBe(committed!.receivedAt);
    expect(recovered.leaseId).toBeUndefined();
    expect(recovered.leaseUntil).toBeUndefined();
    await Promise.all(tabs.map((tab) => tab.close()));
  } finally {
    release();
  }
});

test('E2E-WEB-1125 persisted 429 and server-error deadlines enforce exponential automatic retry capped at one hour before real delivery @FEEDBACK-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const text = 'TEST-SIMULATION bounded retries ' + randomUUID();
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));
  let posts = 0;
  const statuses = [429, 500, 503, 502, 429, 503, 500, 503, 429, 503];
  await page.route('**/api/v1/feedback', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const status = statuses[posts++];
    if (status)
      return route.fulfill({
        status,
        headers: simulatedFailureHeaders,
        json: { message: 'TEST-SIMULATION retryable response' },
      });
    const actual = await route.fetch({
      url: feedbackSandbox.apiOrigin + '/api/v1/feedback',
    });
    expect(actual.status()).toBe(201);
    await route.fulfill({ response: actual });
  });
  await page.goto('/#feedback');
  await settings(page, feedbackSandbox.apiOrigin, false);
  const card = await submit(page, text);
  const original = await owned(page, text);
  await settings(page, feedbackSandbox.apiOrigin, true);
  for (let attempt = 1; attempt <= statuses.length; attempt++) {
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(500);
    await expect
      .poll(async () => {
        const entry = await owned(page, text);
        return `${entry.attempts}:${entry.state}`;
      })
      .toBe(`${attempt}:failed`);
    const failed = await owned(page, text);
    expect(failed.attempts).toBe(attempt);
    expect(posts).toBe(attempt);
    const current = await page.evaluate(() => Date.now());
    const expectedDelay = Math.min(3600000, 15000 * 2 ** (attempt - 1));
    // Response completion can occur anywhere in the controlled 500ms tick.
    expect(failed.nextAttemptAt! - current).toBeGreaterThanOrEqual(
      expectedDelay - 500,
    );
    expect(failed.nextAttemptAt! - current).toBeLessThanOrEqual(expectedDelay);
    expect(failed.submission).toEqual(original.submission);
    await page.clock.setSystemTime(new Date(failed.nextAttemptAt! - 1000));
    if (attempt === 2) {
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Your feedback', exact: true }),
      ).toBeVisible();
      expect((await owned(page, text)).nextAttemptAt).toBe(
        failed.nextAttemptAt,
      );
    }
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(500);
    expect((await owned(page, text)).attempts).toBe(attempt);
    expect(posts).toBe(attempt);
    await page.clock.setSystemTime(new Date(failed.nextAttemptAt! + 1));
  }
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.clock.runFor(500);
  await expectReceived(card);
  expect(posts).toBe(statuses.length + 1);
  expect((await owned(page, text)).submission).toEqual(original.submission);
});

test('E2E-WEB-1126 failed support-history refresh preserves its dated receipt across reload and recovers actual later access @FEEDBACK-001 @DEV-017 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const text = 'TEST-SIMULATION retained support history ' + randomUUID();
  await page.goto('/#feedback');
  await settings(page, feedbackSandbox.apiOrigin, true);
  const card = await submit(page, text);
  await expectReceived(card);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/v1/ops/feedback')).status()).toBe(200);
  await check(page);
  const prior = await owned(page, text);
  expect(prior.receipt?.supportAccess?.total).toBe(1);
  await card
    .getByRole('button', { name: 'View attachments & details', exact: true })
    .click();
  const history = card.getByRole('region', { name: 'Support access history' });
  const priorText = await history.innerText();
  expect(priorText).toContain('Last checked:');
  const path = '**/api/v1/feedback/' + prior.submission.id;
  await page.route(path, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 503,
      headers: simulatedFailureHeaders,
      json: { message: 'TEST-SIMULATION history unavailable' },
    });
  });
  await check(page);
  await expect(card).toContainText(
    'Delivery status could not be checked (503). Your previous receipt is retained.',
  );
  expect((await owned(page, text)).receipt).toEqual(prior.receipt);
  expect(await history.innerText()).toBe(priorText);
  await page.reload();
  await card
    .getByRole('button', { name: 'View attachments & details', exact: true })
    .click();
  expect(await history.innerText()).toBe(priorText);
  expect((await owned(page, text)).receipt).toEqual(prior.receipt);
  expect(
    (await request.get('/api/v1/ops/feedback/' + prior.submission.id)).status(),
  ).toBe(200);
  await page.unroute(path);
  await check(page);
  await expect(history).toContainText('2 recorded support accesses.');
  await expect(history).toContainText(
    'Administrator opened your full feedback and attachments',
  );
  const recovered = (await owned(page, text)).receipt!;
  expect(recovered.supportAccess?.total).toBe(2);
  expect(Date.parse(recovered.supportAccess!.checkedAt)).toBeGreaterThanOrEqual(
    Date.parse(prior.receipt!.supportAccess!.checkedAt),
  );
  expect(recovered.id).toBe(prior.receipt!.id);
});
