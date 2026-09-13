import { test, expect, type Page } from '@playwright/test';
import {
  FeedSchema,
  FeedItemSchema,
  LibrarySchema,
  LibraryReminderSchema,
  LearningCatalogSchema,
  LearningStateSchema,
  AssistanceResultSchema,
} from '../../../../packages/contracts/src/index';
async function local(page: Page, path: string, method = 'GET', body?: unknown) {
  // Also wait after reload before calling the real local API transport.
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  return page.evaluate(
    async (args) => {
      const response = await fetch(`/api/v1${args.path}`, {
        method: args.method,
        headers: { 'Content-Type': 'application/json' },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body },
  );
}
const password = 'Offline-test-passphrase-2026';
test('E2E-OFFLINE-201 dated reading persists saves, reminders and private learning without server @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const feed = FeedSchema.parse((await local(page, '/discovery/feed')).body);
  expect(feed.items.length).toBeGreaterThan(0);
  const item = feed.items.find((v) => v.kind === 'term')!;
  expect(item).toBeTruthy();
  expect(
    FeedItemSchema.parse(
      (await local(page, `/discovery/items/${item.id}`)).body,
    ).version,
  ).toBe(item.version);
  expect((await local(page, '/account/library')).status).toBe(401);
  const username = `offline_${Date.now()}`;
  expect(
    (
      await local(page, '/account/register', 'POST', {
        username,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await local(page, `/account/library/items/${item.id}/save`, 'PUT', {
        version: item.version,
      })
    ).status,
  ).toBe(200);
  await local(page, `/account/library/items/${item.id}/position`, 'PUT', {
    version: item.version,
    percent: 37,
  });
  await local(page, '/account/library/preferences', 'PUT', {
    topics: item.topics,
    mutedTopics: [],
    mode: 'for_you',
  });
  const input = {
    itemId: item.id,
    dueAt: new Date(Date.now() + 2000).toISOString(),
    timeZone: 'Asia/Kolkata',
    idempotencyKey: crypto.randomUUID(),
  };
  const reminder = LibraryReminderSchema.parse(
    (await local(page, '/account/library/reminders', 'POST', input)).body,
  );
  expect(
    LibraryReminderSchema.parse(
      (await local(page, '/account/library/reminders', 'POST', input)).body,
    ).id,
  ).toBe(reminder.id);
  expect(
    (
      await local(page, '/account/library/reminders', 'POST', {
        ...input,
        timeZone: 'UTC',
      })
    ).status,
  ).toBe(409);
  await page.reload();
  const stored = LibrarySchema.parse(
    (await local(page, '/account/library')).body,
  );
  expect(stored.saved[0]?.itemId).toBe(item.id);
  expect(stored.positions[0]?.percent).toBe(37);
  expect(stored.preferences.mode).toBe('for_you');
  await expect
    .poll(
      async () =>
        LibrarySchema.parse(
          (await local(page, '/account/library')).body,
        ).notifications.filter((v) => v.reminderId === reminder.id).length,
    )
    .toBe(1);
  const catalog = LearningCatalogSchema.parse(
    (await local(page, '/learning/catalog')).body,
  );
  const quiz = catalog.items.find((v) => v.kind === 'quiz')!;
  const attempt = {
    questionId: quiz.id,
    version: quiz.version,
    choiceId: quiz.choices[0]!.id,
    requestId: crypto.randomUUID(),
    consent: true,
  };
  expect(
    (await local(page, '/account/learning/attempts', 'POST', attempt)).status,
  ).toBe(201);
  await local(page, '/account/learning/attempts', 'POST', attempt);
  expect(
    LearningStateSchema.parse(
      (await local(page, '/account/learning/state')).body,
    ).attempts,
  ).toHaveLength(1);
  const help = AssistanceResultSchema.parse(
    (
      await local(page, '/account/assistance', 'POST', {
        query: item.title,
        provider: 'openai',
        scope: 'learning',
        useHistory: false,
      })
    ).body,
  );
  expect(help.provider).toBe('query');
  expect(help.fallback).toBe(true);
  expect(help.model).toBeNull();
  await page.goto('/#saved');
  await expect(
    page
      .getByRole('region', { name: 'Saved reading' })
      .getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await local(page, '/account/logout', 'POST', {});
  await local(page, '/account/register', 'POST', {
    username: `other_${Date.now()}`,
    password,
    consent: true,
  });
  expect(
    LibrarySchema.parse((await local(page, '/account/library')).body).saved,
  ).toHaveLength(0);
  expect(
    LearningStateSchema.parse(
      (await local(page, '/account/learning/state')).body,
    ).attempts,
  ).toHaveLength(0);
  await local(page, '/account', 'DELETE', { password });
  await local(page, '/account/login', 'POST', { username, password });
  expect(
    LibrarySchema.parse(
      (await local(page, '/account/library')).body,
    ).notifications.filter((v) => v.reminderId === reminder.id),
  ).toHaveLength(1);
  await local(page, '/account', 'DELETE', { password });
});

test('E2E-OFFLINE-202 search filters validate inputs and never claim source refresh @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await local(page, '/discovery/feed?kind=invalid')).status).toBe(400);
  expect((await local(page, '/discovery/feed?cursor=123')).status).toBe(400);
  expect((await local(page, '/macro/refresh', 'POST', {})).status).toBe(503);
  const all = FeedSchema.parse((await local(page, '/discovery/feed')).body);
  const term = all.items.find((v) => v.kind === 'term')!;
  const found = FeedSchema.parse(
    (
      await local(
        page,
        `/discovery/feed?kind=term&q=${encodeURIComponent(term.title)}`,
      )
    ).body,
  );
  expect(found.items.some((v) => v.id === term.id)).toBe(true);
  expect(found.evaluatedAt).toBe(all.evaluatedAt);
});

test('E2E-OFFLINE-204 reader actions and navigation work with no API network @ANDROID-001', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await local(page, '/account/register', 'POST', {
    username: `reader_${Date.now()}`,
    password,
    consent: true,
  });
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const feed = FeedSchema.parse((await local(page, '/discovery/feed')).body);
  const item = feed.items.find((v) => v.kind === 'term')!;
  await page.locator(`a[data-item-id="${item.id}"]`).click();
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Original source' }),
  ).toHaveAttribute('href', item.source.url);
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  const history = page.getByRole('dialog', { name: 'Version history' });
  await expect(history).toBeVisible();
  await expect(
    history.getByRole('heading', {
      name: `Version ${item.version} · published`,
      exact: true,
    }),
  ).toBeVisible();
  await history.getByRole('button', { name: 'Close', exact: true }).click();
  const media = await local(page, `/discovery/items/${item.id}/media`);
  if (media.status === 200) {
    await expect(
      page.getByRole('region', { name: 'Reviewed visual summary' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Play captions', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Pause captions', exact: true }),
    ).toBeVisible();
  } else expect(media.status).toBe(404);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Less like this', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        LibrarySchema.parse(
          (await local(page, '/account/library')).body,
        ).reactions.find((v) => v.itemId === item.id)?.reaction,
    )
    .toBe('less');
  await page
    .getByRole('button', { name: 'More item actions', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Keep this perspective' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /A little wiser/ }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Saved', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reading preferences', exact: true })
    .click();
  await page.getByLabel('Feed order', { exact: true }).selectOption('for_you');
  await page
    .getByRole('button', { name: 'Save reading preferences', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        LibrarySchema.parse((await local(page, '/account/library')).body)
          .preferences.mode,
    )
    .toBe('for_you');
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'More', exact: true })
    .click();
  await page.getByRole('link', { name: /App settings/ }).click();
  await expect(
    page.getByRole('heading', {
      name: 'A workspace that travels with you.',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    LibrarySchema.parse(
      (await local(page, '/account/library')).body,
    ).saved.some((v) => v.itemId === item.id),
  ).toBe(true);
  expect(apiRequests).toEqual([]);
  await local(page, '/account', 'DELETE', { password });
});
