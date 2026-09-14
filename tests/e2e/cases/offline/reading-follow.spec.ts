import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ReadingFollowViewSchema,
  ReadingFollowExportSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
import type {
  LocalState,
  OfflineBundle,
  OfflineRequest,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-450 actual serialized subscriptions checks replay reload export deletion and zero network @READING-FOLLOW-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) traffic.push(r.url());
  });
  await page.goto('/#reading-follow');
  await expect(
    page
      .locator('nav[aria-label] a[aria-current=page]:visible')
      .filter({ hasText: 'Saved' })
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const call = async (path: string, method = 'GET', body?: unknown) =>
    page.evaluate(
      async ({ path, method, body }) => {
        const r = await fetch('/api/v1/account' + path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: r.status, body: await r.json() };
      },
      { path, method, body },
    );
  const password = 'Synthetic-offline-follow-2026';
  expect(
    (
      await call('/register', 'POST', {
        username: `follow_${Date.now()}`,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Choose sources and topics', exact: true })
    .click();
  const followed = page
    .getByRole('group', { name: 'Sources', exact: true })
    .getByRole('checkbox', { name: /Federal Reserve/ });
  await followed.focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('checkbox', {
      name: /I agree to store my reading subscriptions/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(followed).toBeChecked();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm subscription baseline', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading updates', exact: true }),
  ).toContainText('settings revision 1');
  const check = { requestId: randomUUID(), expectedVersion: 1 };
  const receipt = await call('/reading-follow/check', 'POST', check);
  expect(receipt.status).toBe(201);
  expect((await call('/reading-follow/check', 'POST', check)).body).toEqual(
    receipt.body,
  );
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Reading updates', exact: true }),
  ).toContainText('settings revision 1');
  const view = ReadingFollowViewSchema.parse(
    (await call('/reading-follow')).body,
  );
  expect(view.bundleGeneratedAt).toBeTruthy();
  expect(view.items).toEqual([]);
  expect(
    ReadingFollowExportSchema.parse((await call('/reading-follow/export')).body)
      .events.length,
  ).toBeGreaterThan(1);
  expect((await call('', 'DELETE', { password })).status).toBe(200);
  expect((await call('/reading-follow')).status).toBe(401);
  await call('/register', 'POST', {
    username: `empty_${Date.now()}`,
    password,
    consent: true,
  });
  expect(
    ReadingFollowExportSchema.parse((await call('/reading-follow/export')).body)
      .events,
  ).toEqual([]);
  expect(traffic).toEqual([]);
});
test('E2E-OFFLINE-451 real local handler observes later synthetic bundle editions with coalescing ack mute and complete history @READING-FOLLOW-001 @TEST-SIMULATION', async () => {
  const { handleReadingFollow } =
    await import('../../../../apps/web/src/offline/reading-follow');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const source = bundle.feed.find(
    (i) => i.id.startsWith('fed-') && i.status === 'published',
  )!;
  expect(source).toBeTruthy();
  const id = randomUUID(),
    at = new Date().toISOString();
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: id,
    users: {
      [id]: {
        id,
        username: 'synthetic-follow',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic-handler-fixture',
        passwordSalt: 'synthetic-handler-fixture',
      },
    },
    data: {},
  };
  const call = async (path: string, method = 'GET', body: unknown = {}) => {
    const url = new URL(
      '/api/v1/account/reading-follow' + path,
      'https://offline.invalid',
    );
    const req: OfflineRequest = {
      path: url.pathname,
      method,
      body,
      query: url.searchParams,
      headers: new Headers(),
    };
    return (await handleReadingFollow(req, state, bundle))!;
  };
  await call('', 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 0,
    sources: ['fed'],
    topics: [],
    muted: false,
    consent: true,
  });
  expect(ReadingFollowViewSchema.parse((await call('')).body).items).toEqual(
    [],
  );
  bundle.histories[source.id] = [
    source,
    {
      ...source,
      version: source.version + 1,
      correctionNote: 'Synthetic test-only later edition.',
    },
  ];
  const check = { requestId: randomUUID(), expectedVersion: 1 };
  await call('/check', 'POST', check);
  let view = ReadingFollowViewSchema.parse((await call('')).body);
  expect(view.items).toHaveLength(1);
  expect(view.publishedReading[0]).toEqual({
    id: source.id,
    edition: source.version + 1,
    title: source.title,
    sourceName: source.source.name,
  });
  await call(`/notices/${source.id}/acknowledge`, 'POST', {
    requestId: randomUUID(),
    expectedVersion: view.items[0]!.version,
  });
  await call('/check', 'POST', { requestId: randomUUID(), expectedVersion: 1 });
  expect(
    ReadingFollowViewSchema.parse((await call('')).body).items[0]?.status,
  ).toBe('acknowledged');
  bundle.histories[source.id]!.push({
    ...source,
    version: source.version + 2,
    status: 'withdrawn',
    correctionNote: 'Synthetic withdrawal fixture.',
  });
  await call('/check', 'POST', { requestId: randomUUID(), expectedVersion: 1 });
  view = ReadingFollowViewSchema.parse((await call('')).body);
  expect(view.items[0]?.reason).toBe('withdrawn');
  expect(view.availableIds).not.toContain(source.id);
  expect(view.publishedReading).toEqual([]);
  expect(JSON.stringify(state.data.localReadingFollow)).not.toContain(
    source.title,
  );
  const snapshot = JSON.stringify(state);
  await expect(
    call('/check', 'POST', { ...check, expectedVersion: 0 }),
  ).rejects.toThrow();
  expect(JSON.stringify(state)).toBe(snapshot);
  const beforeMute = ReadingFollowViewSchema.parse((await call('')).body)
    .items[0];
  await call('', 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 1,
    sources: ['fed', 'world-bank'],
    topics: [],
    muted: false,
    consent: true,
  });
  expect(ReadingFollowViewSchema.parse((await call('')).body).items[0]).toEqual(
    beforeMute,
  );
  const ackAfterEdit = await call(`/notices/${source.id}/acknowledge`, 'POST', {
    requestId: randomUUID(),
    expectedVersion: beforeMute!.version,
  });
  expect((ackAfterEdit.body as { configVersion: number }).configVersion).toBe(
    beforeMute!.configVersion,
  );
  const acknowledged = ReadingFollowViewSchema.parse((await call('')).body)
    .items[0];
  await call('', 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 2,
    sources: ['fed', 'world-bank'],
    topics: [],
    muted: true,
    consent: true,
  });
  expect(ReadingFollowViewSchema.parse((await call('')).body).items[0]).toEqual(
    acknowledged,
  );
  bundle.histories[source.id]!.push({
    ...source,
    version: source.version + 3,
    status: 'published',
    correctionNote: 'Synthetic republished fixture.',
  });
  await call('', 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 3,
    sources: ['fed', 'world-bank'],
    topics: [],
    muted: false,
    consent: true,
  });
  expect(
    ReadingFollowViewSchema.parse((await call('')).body).items[0]?.status,
  ).toBe('resolved');
  for (let i = 0; i < 101; i++)
    await call('/check', 'POST', {
      requestId: randomUUID(),
      expectedVersion: 4,
    });
  let exported = ReadingFollowExportSchema.parse((await call('/export')).body);
  expect(exported.next).not.toBeNull();
  const upper = exported.upper,
    sequences = exported.events.map((e) => e.sequence);
  expect(JSON.stringify(exported)).not.toContain(source.title);
  while (exported.next) {
    exported = ReadingFollowExportSchema.parse(
      (
        await call(
          '/export?' + new URLSearchParams({ after: exported.next, upper }),
        )
      ).body,
    );
    expect(exported.upper).toBe(upper);
    sequences.push(...exported.events.map((e) => e.sequence));
  }
  expect(new Set(sequences).size).toBe(sequences.length);
  expect(sequences.length).toBeGreaterThan(101);
});
