import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  FeedSchema,
  FeedItemSchema,
  FeedRankingSchema,
  LibrarySchema,
  LibraryReminderSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-121 library saves preferences isolation and durable in-app reminders @UX-002D', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(90000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  const read = async () => {
    const response = await request.get('/api/v1/account/library');
    expect(response.status()).toBe(200);
    return LibrarySchema.parse(await response.json());
  };
  try {
    expect((await request.get('/api/v1/account/library')).status()).toBe(401);
    expect((await request.get('/api/v1/account/library/feed')).status()).toBe(
      401,
    );
    const feedResponse = await request.get('/api/v1/discovery/feed');
    expect(feedResponse.status()).toBe(200);
    const item = FeedSchema.parse(await feedResponse.json()).items.find(
      (value) => value.kind === 'term',
    );
    expect(item, 'Published glossary prerequisite').toBeTruthy();
    const id = item!.id;
    const path = `/api/v1/account/library/items/${id}`;
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await other.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put(`${path}/save`, {
          headers: { Origin: 'https://evil.example' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put(`${path}/save`, {
          headers,
          data: { version: item!.version, userId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.put(`${path}/save`, {
          headers,
          data: { version: item!.version },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.put(`${path}/save`, {
          headers,
          data: { version: item!.version },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.put(`${path}/reaction`, {
          headers,
          data: { reaction: 'more' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.put(`${path}/position`, {
          headers,
          data: { version: item!.version, percent: 65 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.put('/api/v1/account/library/preferences', {
          headers,
          data: { topics: item!.topics, mutedTopics: [], mode: 'for_you' },
        })
      ).status(),
    ).toBe(200);
    const saved = await read();
    expect(saved.saved).toHaveLength(1);
    expect(saved.saved[0]?.title).toBe(item!.title);
    expect(saved.positions[0]?.percent).toBe(65);
    expect(saved.reactions[0]?.reaction).toBe('more');
    expect(
      LibrarySchema.parse(
        await (await other.get('/api/v1/account/library')).json(),
      ).saved,
    ).toEqual([]);
    expect(
      (await request.get('/api/v1/account/library/feed?cursor=20')).status(),
    ).toBe(400);
    expect(
      (
        await request.get(
          '/api/v1/account/library/feed?cursor=not-a-valid-cursor',
        )
      ).status(),
    ).toBe(400);
    expect(
      (await request.get('/api/v1/account/library/feed?kind=unknown')).status(),
    ).toBe(400);
    expect(
      (
        await request.get(`/api/v1/account/library/feed?q=${'x'.repeat(201)}`)
      ).status(),
    ).toBe(400);
    const searched = FeedRankingSchema.parse(
      await (
        await request.get(
          `/api/v1/account/library/feed?kind=term&q=${encodeURIComponent(item!.title)}`,
        )
      ).json(),
    );
    expect(searched.items.some((value) => value.id === id)).toBe(true);
    expect(searched.items.every((value) => value.kind === 'term')).toBe(true);
    const ranked = FeedRankingSchema.parse(
      await (await request.get('/api/v1/account/library/feed')).json(),
    );
    expect(ranked.policyVersion).toBe('explicit-v1');
    expect(ranked.whyShown[id]).toContain('more');
    expect(
      (
        await request.put('/api/v1/account/library/preferences', {
          headers,
          data: {
            topics: [],
            mutedTopics: item!.topics,
            mode: 'chronological',
          },
        })
      ).status(),
    ).toBe(200);
    const muted = FeedRankingSchema.parse(
      await (await request.get('/api/v1/account/library/feed')).json(),
    );
    expect(muted.items.some((value) => value.id === id)).toBe(false);
    expect(
      (
        await request.post('/api/v1/account/library/preferences/reset', {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(200);
    expect((await read()).reactions).toEqual([]);
    expect((await read()).positions).toEqual([]);
    expect((await read()).saved).toHaveLength(1);
    const dueAt = new Date(Date.now() + 10000).toISOString();
    const data = {
      itemId: id,
      dueAt,
      timeZone: 'Asia/Kolkata',
      idempotencyKey: randomUUID(),
    };
    const created = await request.post('/api/v1/account/library/reminders', {
      headers,
      data,
    });
    expect(created.status()).toBe(201);
    const reminder = LibraryReminderSchema.parse(await created.json());
    const retry = await request.post('/api/v1/account/library/reminders', {
      headers,
      data,
    });
    expect(retry.status()).toBe(201);
    expect(LibraryReminderSchema.parse(await retry.json()).id).toBe(
      reminder.id,
    );
    expect(
      (
        await request.post('/api/v1/account/library/reminders', {
          headers,
          data: { ...data, dueAt: new Date(Date.now() + 60000).toISOString() },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await other.delete(`/api/v1/account/library/reminders/${reminder.id}`, {
          headers,
          data: { expectedVersion: 1 },
        })
      ).status(),
    ).toBe(409);
    await expect
      .poll(
        async () =>
          (await read()).notifications.filter(
            (value) => value.reminderId === reminder.id,
          ).length,
        { timeout: 25000 },
      )
      .toBe(1);
    const delivered = await read();
    expect(
      delivered.reminders.find((value) => value.id === reminder.id)?.status,
    ).toBe('delivered');
    const notification = delivered.notifications.find(
      (value) => value.reminderId === reminder.id,
    )!;
    expect(
      (
        await request.put(
          `/api/v1/account/library/notifications/${notification.id}/read`,
          { headers, data: {} },
        )
      ).status(),
    ).toBe(200);
    expect((await read()).notifications[0]?.readAt).not.toBeNull();
    const future = LibraryReminderSchema.parse(
      await (
        await request.post('/api/v1/account/library/reminders', {
          headers,
          data: {
            ...data,
            dueAt: new Date(Date.now() + 60000).toISOString(),
            idempotencyKey: randomUUID(),
          },
        })
      ).json(),
    );
    expect(
      (
        await request.patch(`/api/v1/account/library/reminders/${future.id}`, {
          headers,
          data: {
            expectedVersion: 1,
            dueAt: new Date(Date.now() + 120000).toISOString(),
            timeZone: 'UTC',
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.delete(`/api/v1/account/library/reminders/${future.id}`, {
          headers,
          data: { expectedVersion: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.delete(`/api/v1/account/library/reminders/${future.id}`, {
          headers,
          data: { expectedVersion: 2 },
        })
      ).status(),
    ).toBe(200);
    const exported = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(exported.library.available).toBe(true);
    expect(exported.library.data?.saved[0]?.itemId).toBe(id);
    expect(exported.library.data?.reminders).toHaveLength(2);
    expect(
      (await request.get('/api/v1/account/library')).headers()['cache-control'],
    ).toContain('no-store');
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});

test('E2E-API-122 saved versions survive correction and withdrawn reminders cancel @UX-002D', async ({
  request,
}) => {
  test.setTimeout(60000);
  let itemId = '';
  let version = 0;
  try {
    const publicFeed = FeedSchema.parse(
      await (await request.get('/api/v1/discovery/feed')).json(),
    );
    const item = publicFeed.items.find((value) => value.kind === 'term');
    expect(item).toBeTruthy();
    itemId = item!.id;
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put(`/api/v1/account/library/items/${itemId}/save`, {
          headers,
          data: { version: item!.version },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers,
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    const correctedResponse = await request.put(
      `/api/v1/ops/discovery/items/${itemId}`,
      {
        headers,
        data: {
          expectedVersion: item!.version,
          status: 'published',
          correctionNote:
            'Acceptance revision: original glossary explanation remains unchanged.',
        },
      },
    );
    expect(correctedResponse.status()).toBe(200);
    const corrected = FeedItemSchema.parse(await correctedResponse.json());
    version = corrected.version;
    const after = LibrarySchema.parse(
      await (await request.get('/api/v1/account/library')).json(),
    );
    expect(after.saved[0]?.version).toBe(item!.version);
    expect(after.saved[0]?.currentVersion).toBe(corrected.version);
    expect(after.saved[0]?.summary).toBe(item!.summary);
    const reminderResponse = await request.post(
      '/api/v1/account/library/reminders',
      {
        headers,
        data: {
          itemId,
          dueAt: new Date(Date.now() + 10000).toISOString(),
          timeZone: 'UTC',
          idempotencyKey: randomUUID(),
        },
      },
    );
    expect(reminderResponse.status()).toBe(201);
    const reminder = LibraryReminderSchema.parse(await reminderResponse.json());
    const withdrawn = await request.put(
      `/api/v1/ops/discovery/items/${itemId}`,
      {
        headers,
        data: {
          expectedVersion: version,
          status: 'withdrawn',
          correctionNote:
            'Acceptance withdrawal to verify reminder cancellation.',
        },
      },
    );
    expect(withdrawn.status()).toBe(200);
    version = FeedItemSchema.parse(await withdrawn.json()).version;
    await expect
      .poll(
        async () =>
          LibrarySchema.parse(
            await (await request.get('/api/v1/account/library')).json(),
          ).reminders.find((value) => value.id === reminder.id)?.status,
        { timeout: 25000 },
      )
      .toBe('cancelled');
    const cancelled = LibrarySchema.parse(
      await (await request.get('/api/v1/account/library')).json(),
    );
    expect(cancelled.notifications).toEqual([]);
    expect(cancelled.saved[0]?.currentStatus).toBe('withdrawn');
    expect(cancelled.saved[0]?.summary).toBe(item!.summary);
    const exported = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(exported.library.data?.saved[0]?.currentStatus).toBe('withdrawn');
  } finally {
    if (itemId && version)
      expect(
        (
          await request.put(`/api/v1/ops/discovery/items/${itemId}`, {
            headers,
            data: {
              expectedVersion: version,
              status: 'published',
              correctionNote:
                'Acceptance cleanup: republish the unchanged educational glossary entry.',
            },
          })
        ).status(),
      ).toBe(200);
    await request.delete('/api/v1/ops/session', { headers });
    await request.delete('/api/v1/account', { headers, data: { password } });
  }
});
