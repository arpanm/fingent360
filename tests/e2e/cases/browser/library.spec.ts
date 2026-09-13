import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { FeedSchema } from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-120 saved reading reminders preferences and removal @UX-002D', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/#saved');
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toBeVisible();
  const feed = FeedSchema.parse(
    await (await page.request.get('/api/v1/discovery/feed')).json(),
  );
  const item = feed.items.find((value) => value.kind === 'term');
  expect(item).toBeTruthy();
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `e2e_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    expect(
      (
        await page.request.put(
          `/api/v1/account/library/items/${item!.id}/save`,
          { headers, data: { version: item!.version } },
        )
      ).status(),
    ).toBe(200);
    await page.reload();
    const saved = page.getByRole('region', { name: 'Saved reading' });
    await expect(
      saved.getByRole('heading', { name: item!.title, exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Search saved items', { exact: true })
      .fill('no-match-synthetic-text');
    await expect(
      page.getByText('No saved items match these filters.', { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Search saved items', { exact: true })
      .fill(item!.title);
    await expect(
      saved.getByRole('heading', { name: item!.title, exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Availability', { exact: true })
      .selectOption('unavailable');
    await expect(
      page.getByText('No saved items match these filters.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Availability', { exact: true }).selectOption('all');
    await saved.getByRole('button', { name: 'Remind me', exact: true }).click();
    await page
      .getByRole('button', { name: 'Tomorrow at 9 am', exact: true })
      .click();
    await expect(page.getByLabel('Remind me on', { exact: true })).toHaveValue(
      /T09:00$/,
    );
    const local = await page.evaluate(() => {
      const date = new Date(Date.now() + 86400000);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    });
    await page.getByLabel('Remind me on', { exact: true }).fill(local);
    await page
      .getByRole('button', { name: 'Confirm reminder', exact: true })
      .click();
    await expect(
      page.getByText('Reminder scheduled.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Reminders', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Edit reminder', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Cancel reminder', exact: true })
      .click();
    await expect(
      page.getByText('Reminder cancelled.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Reading preferences', exact: true })
      .click();
    await page
      .getByLabel('Feed order', { exact: true })
      .selectOption('for_you');
    await page
      .getByRole('button', { name: 'Save reading preferences', exact: true })
      .click();
    await expect(
      page.getByText('Reading preferences saved.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole('button', { name: 'Reading preferences', exact: true })
      .click();
    await expect(page.getByLabel('Feed order', { exact: true })).toHaveValue(
      'for_you',
    );
    await page
      .getByRole('button', { name: 'Saved items', exact: true })
      .click();
    await saved
      .getByRole('button', { name: 'Remove saved item', exact: true })
      .click();
    await expect(
      page.getByText('Something worth returning to?', { exact: true }),
    ).toBeVisible();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-121 incoming reminders preserve unsaved preferences and snooze once @UX-002D', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/#saved');
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `e2e_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    const feed = FeedSchema.parse(
      await (await page.request.get('/api/v1/discovery/feed')).json(),
    );
    const item = feed.items.find((value) => value.kind === 'term')!;
    expect(item).toBeTruthy();
    expect(
      (
        await page.request.post('/api/v1/account/library/reminders', {
          headers,
          data: {
            itemId: item.id,
            dueAt: new Date(Date.now() + 7000).toISOString(),
            timeZone: 'UTC',
            idempotencyKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
    await page.reload();
    await page
      .getByRole('button', { name: 'Reading preferences', exact: true })
      .click();
    await page
      .getByLabel('Feed order', { exact: true })
      .selectOption('for_you');
    await expect(
      page.getByRole('region', { name: 'Reading reminders' }),
    ).toContainText(item.title, { timeout: 35000 });
    await expect(page.getByLabel('Feed order', { exact: true })).toHaveValue(
      'for_you',
    );
    await page.getByRole('button', { name: 'Reminders', exact: true }).click();
    await page
      .getByLabel('Reminder status', { exact: true })
      .selectOption('delivered');
    await page
      .getByRole('button', { name: 'Snooze until tomorrow', exact: true })
      .click();
    await expect(
      page.getByText(
        'New reminder scheduled for tomorrow. The original reminder stays in your history.',
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByLabel('Reminder status', { exact: true })
      .selectOption('pending');
    await expect(
      page.getByRole('button', { name: 'Edit reminder', exact: true }),
    ).toHaveCount(1);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
