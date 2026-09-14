import { randomUUID } from 'node:crypto';
import type { APIResponse } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  queueBase,
  queuePage,
  seedQueue,
  queueDatabase,
  queueDigests,
  queueHeaders,
  loginQueueOperator,
  reviewQueue,
  queueBlock,
  waitQueueBlock,
} from '../../helpers/publishing-queue';
import { auditBlock } from '../../helpers/operator-audit';
import { authGoal } from '../../helpers/auth-wait';
import {
  sourceIdFor,
  DiscoveryOperationsSchema,
} from '../../../../packages/contracts/src/index';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-560 protected bounded current heads preserve actual source and private records @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  expect((await request.get(queueBase)).status()).toBe(401);
  const entries = await seedQueue(feedbackSandbox);
  await loginQueueOperator(request);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers: queueHeaders,
        data: {
          username: `queue_${randomUUID().slice(0, 12)}`,
          password: 'Synthetic-queue-password-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/account/goals', {
        headers: queueHeaders,
        data: authGoal,
      })
    ).status(),
  ).toBe(201);
  const pool = await queueDatabase(feedbackSandbox);
  try {
    const before = await queueDigests(pool);
    const page = await queuePage(request);
    expect(page.items).toEqual(entries.slice(0, 20));
    expect(page.pageSize).toBe(20);
    expect(page.nextCursor).not.toBeNull();
    expect(page.latestRun).toBeNull();
    const legacy = DiscoveryOperationsSchema.parse(
      await (await request.get('/api/v1/ops/discovery/items')).json(),
    );
    expect(legacy.items).toHaveLength(45);
    expect(await queueDigests(pool)).toEqual(before);
  } finally {
    await pool.end();
  }
});
test('E2E-API-561 filters classify actual heads and reject repeated unknown mismatched and tampered cursors @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox);
  await loginQueueOperator(request);
  const first = await queuePage(request);
  for (const query of [
    'source=unknown',
    'source=fed&source=bea',
    'status=draft&status=published',
    'status=unknown',
    'limit=100',
    'offset=20',
    'unknown=true',
    'q=',
    'q=' + 'x'.repeat(121),
    'q=a%00b',
    'q=a%0Ab',
    'cursor=invalid',
    `cursor=${encodeURIComponent(first.nextCursor!)}&source=bea`,
  ])
    expect((await request.get(`${queueBase}?${query}`)).status()).toBe(400);
  const cursor = first.nextCursor!;
  const modified = `${cursor.slice(0, -2)}${cursor.at(-2) === 'a' ? 'b' : 'a'}${cursor.at(-1)}`;
  expect(
    (
      await request.get(`${queueBase}?cursor=${encodeURIComponent(modified)}`)
    ).status(),
  ).toBe(400);
  for (const source of [
    'fed',
    'ecb-press',
    'ecb-statistics',
    'pib',
    'bea',
    'world-bank',
    'glossary',
    'other',
  ])
    expect((await queuePage(request, `source=${source}`)).items).toEqual(
      entries.filter((e) => sourceIdFor(e.item) === source),
    );
  for (const status of ['draft', 'published', 'withdrawn'])
    expect((await queuePage(request, `status=${status}`)).items).toEqual(
      entries.filter((e) => e.item.status === status),
    );
  expect(
    (await queuePage(request, 'q=%25_')).items.map((e) => e.item.title),
  ).toEqual(['Synthetic queue item 003 literal %_']);
  expect((await queuePage(request, 'q=no-such-title')).items).toEqual([]);
});
test('E2E-API-562 microsecond ties traverse every original head and current changes require a new boundary @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox);
  await loginQueueOperator(request);
  const first = await queuePage(request);
  const query = `cursor=${encodeURIComponent(first.nextCursor!)}`;
  const second = await queuePage(request, query);
  const replay = await queuePage(request, query);
  expect(replay.items).toEqual(second.items);
  expect(replay.upper).toEqual(second.upper);
  expect(replay.openedAt).toBe(first.openedAt);
  const third = await queuePage(
    request,
    `cursor=${encodeURIComponent(second.nextCursor!)}`,
  );
  expect([...first.items, ...second.items, ...third.items]).toEqual(entries);
  expect(third.nextCursor).toBeNull();
  const changed = await reviewQueue(request, entries[23]!.item, 'published');
  const continued = await queuePage(request, query);
  expect(continued.items.some((e) => e.item.id === changed.id)).toBe(false);
  const reset = await queuePage(request);
  expect(reset.items[0]!.item).toEqual(changed);
  expect(reset.upper).not.toEqual(first.upper);
  expect(
    (
      await request.put(`/api/v1/ops/discovery/items/${changed.id}`, {
        headers: queueHeaders,
        data: {
          expectedVersion: 1,
          status: 'withdrawn',
          correctionNote: 'Synthetic stale queue row',
        },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-563 expiry after actual head or latest-run table wait denies all protected queue content @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedQueue(feedbackSandbox, 1);
  const pool = await queueDatabase(feedbackSandbox);
  try {
    for (const table of ['discovery_versions', 'discovery_runs'] as const) {
      await loginQueueOperator(request);
      const blocker = await queueBlock(feedbackSandbox, table);
      let pending: Promise<APIResponse> | undefined;
      try {
        pending = request.get(queueBase);
        await waitQueueBlock(pool, blocker.pid, table);
        await pool.query(
          'UPDATE operator_sessions SET expires_at=clock_timestamp()',
        );
        await blocker.release();
        const response = await pending;
        expect(response.status()).toBe(401);
        expect(await response.text()).not.toContain('Synthetic queue');
      } finally {
        await blocker.release();
        await pending?.catch(() => undefined);
      }
    }
  } finally {
    await pool.end();
  }
});
test('E2E-API-564 committed revoke or expiry ahead of final session SHARE denies an already-read page @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedQueue(feedbackSandbox, 1);
  const pool = await queueDatabase(feedbackSandbox);
  try {
    for (const kind of ['revoke', 'expire'] as const) {
      await loginQueueOperator(request);
      const blocker = await auditBlock(feedbackSandbox, kind);
      let pending: Promise<APIResponse> | undefined;
      try {
        pending = request.get(queueBase);
        await waitQueueBlock(pool, blocker.pid, 'operator_sessions%FOR SHARE');
        await blocker.release(true);
        const response = await pending;
        expect(response.status()).toBe(401);
        expect(await response.text()).not.toContain('Synthetic queue');
      } finally {
        await blocker.release();
        await pending?.catch(() => undefined);
      }
    }
  } finally {
    await pool.end();
  }
});
test('E2E-API-565 actual unavailable storage retries the same cursor without mutation or hidden refresh @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox);
  await loginQueueOperator(request);
  const first = await queuePage(request),
    pool = await queueDatabase(feedbackSandbox);
  let renamed = false;
  try {
    const before = await queueDigests(pool);
    await pool.query(
      'ALTER TABLE discovery_versions RENAME TO queue_unavailable_versions',
    );
    renamed = true;
    const query = `cursor=${encodeURIComponent(first.nextCursor!)}`;
    const response = await request.get(`${queueBase}?${query}`);
    expect(response.status()).toBe(503);
    expect(await response.text()).not.toContain('Synthetic queue');
    await pool.query(
      'ALTER TABLE queue_unavailable_versions RENAME TO discovery_versions',
    );
    renamed = false;
    expect((await queuePage(request, query)).items).toEqual(
      entries.slice(20, 40),
    );
    expect(await queueDigests(pool)).toEqual(before);
  } finally {
    if (renamed)
      await pool.query(
        'ALTER TABLE queue_unavailable_versions RENAME TO discovery_versions',
      );
    await pool.end();
  }
});
test('E2E-API-566 actual dated bundled source retains its exact edition provenance in the protected queue @PUBLISHING-QUEUE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await loginQueueOperator(request);
  const page = await queuePage(request, 'source=fed&status=published');
  expect(page.items).toHaveLength(1);
  expect(page.items[0]!.item).toEqual(source);
  expect(page.items[0]!.item.sourceHash).toBe(source.sourceHash);
  expect(page.items[0]!.item.source.retrievedAt).toBe(
    source.source.retrievedAt,
  );
  expect(page.items[0]!.item.publishedAt).toBe(source.publishedAt);
  const pool = await queueDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query(
          'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
          [source.id, source.version],
        )
      ).rows[0]!.data,
    ).toEqual(source);
    expect(
      (
        await pool.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM discovery_runs',
        )
      ).rows[0]!.n,
    ).toBe(0);
  } finally {
    await pool.end();
  }
});
test('E2E-API-567 combined source status and text filters page completely with valid stored ordering indexes @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const entries = await seedQueue(feedbackSandbox, 65, 'fed');
  const expected = entries.filter(({ item }) => item.status === 'draft');
  await loginQueueOperator(request);
  const filters = 'source=fed&status=draft&q=Synthetic%20queue';
  const first = await queuePage(request, filters);
  expect(first.items).toEqual(expected.slice(0, 20));
  expect(first.nextCursor).not.toBeNull();
  const continuation =
    filters + '&cursor=' + encodeURIComponent(first.nextCursor!);
  const second = await queuePage(request, continuation);
  expect([...first.items, ...second.items]).toEqual(expected);
  expect(second.items).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  expect((await queuePage(request, continuation)).items).toEqual(second.items);
  const pool = await queueDatabase(feedbackSandbox);
  try {
    const indexes = await pool.query<{
      name: string;
      valid: boolean;
      ready: boolean;
    }>(
      'SELECT c.relname AS name,x.indisvalid AS valid,x.indisready AS ready FROM pg_index x JOIN pg_class c ON c.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname=ANY($1::text[]) ORDER BY c.relname',
      [['discovery_versions_queue_order', 'discovery_runs_queue_latest']],
    );
    expect(indexes.rows).toEqual([
      { name: 'discovery_runs_queue_latest', valid: true, ready: true },
      { name: 'discovery_versions_queue_order', valid: true, ready: true },
    ]);
  } finally {
    await pool.end();
  }
});
