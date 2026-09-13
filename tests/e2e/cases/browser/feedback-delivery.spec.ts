import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import {
  FeedbackReceiptSchema,
  type FeedbackReceipt,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
interface OwnedEntry {
  submission: { id: string; receiptToken: string; text: string };
  receipt: FeedbackReceipt | null;
}
async function owned(page: Page, text: string): Promise<OwnedEntry[]> {
  return page.evaluate(async (text) => {
    const names = await indexedDB.databases();
    if (!names.some((v) => v.name === 'fingent360-feedback')) return [];
    return new Promise<OwnedEntry[]>((resolve, reject) => {
      const open = indexedDB.open('fingent360-feedback');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const request = database
          .transaction('outbox', 'readonly')
          .objectStore('outbox')
          .get('state');
        request.onsuccess = () => {
          const data = request.result as { records?: OwnedEntry[] } | undefined;
          resolve(
            (data?.records ?? []).filter((v) => v.submission.text === text),
          );
          database.close();
        };
        request.onerror = () => {
          reject(request.error);
          database.close();
        };
      };
    });
  }, text);
}
async function cleanup(page: Page, text: string) {
  for (const record of await owned(page, text)) {
    const response = await page.request.delete(
      `/api/v1/feedback/${record.submission.id}`,
      {
        headers: {
          'X-Feedback-Token': record.submission.receiptToken,
          Origin: process.env.E2E_WEB_URL!,
        },
      },
    );
    expect([200, 204, 410]).toContain(response.status());
  }
}
async function submit(page: Page, text: string) {
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Share feedback' });
  await dialog.getByLabel('Your feedback', { exact: true }).fill(text);
  await dialog
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await dialog
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Saved on this device' })
    .getByRole('link', { name: 'View feedback', exact: true })
    .click();
  return page.getByRole('article').filter({ hasText: text });
}
async function remove(page: Page, text: string) {
  const card = page.getByRole('article').filter({ hasText: text });
  await card
    .getByRole('button', { name: 'Delete feedback', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete this feedback?' })
    .getByRole('button', { name: 'Confirm deletion', exact: true })
    .click();
  await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(
    0,
    { timeout: 30000 },
  );
}

test('E2E-WEB-194 simulated lost acknowledgment retries one actual server report without duplicate POST after receipt @FEEDBACK-001 @simulated', async ({
  page,
}) => {
  test.setTimeout(90000);
  const text = `E2E delivery fixture ${randomUUID()} lost acknowledgment`;
  let firstReceipt: FeedbackReceipt | undefined;
  let intercepted = false;
  let posts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/feedback'
    )
      posts++;
  });
  await page.goto('/#feedback');
  const delivery = page.getByLabel('Automatically deliver submitted feedback', {
    exact: true,
  });
  await expect(delivery).toBeEnabled();
  await delivery.uncheck();
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(
    page.getByText('Feedback delivery paused. Reports remain on this device.', {
      exact: true,
    }),
  ).toBeVisible();
  // Fault only the first acknowledgment after route.fetch has committed the real report.
  await page.route('**/api/v1/feedback', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) {
      await route.continue();
      return;
    }
    intercepted = true;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    firstReceipt = FeedbackReceiptSchema.parse(await response.json());
    await route.abort('failed');
  });
  try {
    await page.goto('/#today');
    const card = await submit(page, text);
    await expect(
      card.getByText('Pending delivery', { exact: true }),
    ).toBeVisible();
    expect(posts).toBe(0);
    const original = (await owned(page, text))[0]!;
    await page
      .getByLabel('Automatically deliver submitted feedback', { exact: true })
      .check();
    await page
      .getByRole('button', {
        name: 'Save feedback delivery settings',
        exact: true,
      })
      .click();
    await expect(
      card.getByText('Needs attention', { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect(firstReceipt?.id).toBe(original.submission.id);
    await page.unroute('**/api/v1/feedback');
    await page.reload();
    await page
      .getByRole('button', { name: 'Check delivery', exact: true })
      .click();
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: text })
        .getByText('Received', { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const retried = (await owned(page, text))[0]!;
    expect(retried.submission.id).toBe(original.submission.id);
    expect(retried.receipt?.receivedAt).toBe(firstReceipt!.receivedAt);
    const receivedPosts = posts;
    await page
      .getByRole('button', { name: 'Check delivery', exact: true })
      .click();
    await expect(
      page.getByText(
        'Delivery checked. Pending reports stay saved until acknowledged.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(posts).toBe(receivedPosts);
    await remove(page, text);
  } finally {
    await page.unroute('**/api/v1/feedback');
    await cleanup(page, text);
  }
});

test('E2E-WEB-195 operator review reaches the original user receipt through actual status check @FEEDBACK-001', async ({
  page,
}) => {
  test.setTimeout(90000);
  const text = `E2E delivery fixture ${randomUUID()} operator review`;
  const origin = process.env.E2E_WEB_URL || 'http://localhost:5173';
  await page.goto('/#today');
  try {
    const card = await submit(page, text);
    await expect(card.getByText('Received', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    const entry = (await owned(page, text))[0]!;
    expect(
      (
        await page.request.post('/api/v1/ops/session', {
          headers: { Origin: origin },
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    await page.goto('/#ops');
    await page
      .getByRole('button', { name: 'Feedback inbox', exact: true })
      .click();
    const inbox = page.getByRole('region', { name: 'Feedback inbox' });
    const report = inbox.getByRole('article').filter({ hasText: text });
    await report
      .getByRole('button', {
        name: `Review feedback ${entry.submission.id.slice(0, 8)}`,
        exact: true,
      })
      .click();
    const review = page.getByRole('dialog', {
      name: 'Review feedback',
      exact: true,
    });
    await review
      .getByLabel('Review status', { exact: true })
      .selectOption('reviewing');
    await review
      .getByRole('button', { name: 'Save review status', exact: true })
      .click();
    await expect(
      review.getByText('Feedback status saved.', { exact: true }),
    ).toBeVisible();
    await review.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(review).toHaveCount(0);
    await page.goto('/#feedback');
    await page
      .getByRole('button', { name: 'Check delivery', exact: true })
      .click();
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: text })
        .getByText('Being reviewed', { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect((await owned(page, text))[0]!.receipt?.version).toBeGreaterThan(
      entry.receipt!.version,
    );
    await remove(page, text);
  } finally {
    await cleanup(page, text);
    await page.request.delete('/api/v1/ops/session', {
      headers: { Origin: origin },
    });
  }
});
