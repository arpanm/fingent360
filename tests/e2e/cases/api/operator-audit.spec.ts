import { randomUUID } from 'node:crypto';
import type { APIResponse } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  auditBase as base,
  auditHeaders as headers,
  auditDatabase,
  loginAuditOperator,
  auditPage,
  seedAudit,
  auditBlock,
  waitAuditBlock,
  syntheticSource,
} from '../../helpers/operator-audit';
import { authGoal } from '../../helpers/auth-wait';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-480 actual successful and invalid source requests remain request-only with no private body disclosure @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  expect((await request.get(base)).status()).toBe(401);
  await loginAuditOperator(request);
  const source = syntheticSource();
  expect(
    (
      await request.post('/api/v1/ops/sources', { headers, data: source })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/sources', {
        headers,
        data: { privateBody: 'synthetic secret holdings note' },
      })
    ).status(),
  ).toBe(400);
  const page = await auditPage(request);
  expect(page.items).toHaveLength(2);
  expect(page.items.map((row) => row.event)).toEqual([
    'source.create.requested',
    'source.create.requested',
  ]);
  expect(JSON.stringify(page)).not.toMatch(
    /actor_hash|privateBody|secret holdings|target|example.invalid|completed/,
  );
  const pool = await auditDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query<{ n: number }>(
          'SELECT count(*)::integer AS n FROM operator_audit',
        )
      ).rows[0]?.n,
    ).toBe(2);
    expect(
      (
        await pool.query<{ n: number }>(
          'SELECT count(*)::integer AS n FROM research_sources',
        )
      ).rows[0]?.n,
    ).toBe(1);
  } finally {
    await pool.end();
  }
});

test('E2E-API-481 strict UTC filters event compatibility repeated inputs and altered cursor reject without changing rows @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  await seedAudit(feedbackSandbox);
  const first = await auditPage(request);
  for (const query of [
    'unknown=true',
    'module=sources&module=macro',
    'from=2026-02-31',
    'from=2026-01-03&through=2026-01-02',
    'module=sources&event=retention-completed',
    'event=constructor',
    'limit=1000',
    'offset=50',
    'cursor=malformed',
    `cursor=${encodeURIComponent(first.nextCursor!)}&from=2026-01-01`,
  ])
    expect((await request.get(`${base}?${query}`)).status()).toBe(400);
  const cursor = first.nextCursor!;
  const modified = `${cursor.slice(0, -2)}${cursor.at(-2) === 'a' ? 'b' : 'a'}${cursor.at(-1)}`;
  expect(
    (
      await request.get(`${base}?cursor=${encodeURIComponent(modified)}`)
    ).status(),
  ).toBe(400);
  const filtered = await auditPage(
    request,
    'module=sources&event=source.create.requested&from=2026-01-02&through=2026-01-02',
  );
  expect(
    filtered.items.every((row) => row.event === 'source.create.requested'),
  ).toBe(true);
  expect(filtered.items).toHaveLength(50);
  expect((await auditPage(request, 'through=2026-01-01')).items).toEqual([]);
  expect((await auditPage(request, 'from=2026-01-03')).items).toEqual([]);
  expect((await auditPage(request)).items).toEqual(first.items);
});

test('E2E-API-482 exact microsecond and UUID keyset pagination fixes upper boundary across new real activity and replay @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  const rows = await seedAudit(feedbackSandbox);
  const first = await auditPage(request);
  expect(
    first.items.map((row) => ({ id: row.id, recordedAt: row.recordedAt })),
  ).toEqual(rows.slice(0, 50));
  expect(
    (
      await request.post('/api/v1/ops/sources', {
        headers,
        data: syntheticSource(),
      })
    ).status(),
  ).toBe(201);
  const query = `cursor=${encodeURIComponent(first.nextCursor!)}`;
  const second = await auditPage(request, query);
  expect(await auditPage(request, query)).toEqual(second);
  const third = await auditPage(
    request,
    `cursor=${encodeURIComponent(second.nextCursor!)}`,
  );
  expect(third.nextCursor).toBeNull();
  expect(second.upper).toEqual(first.upper);
  expect(third.upper).toEqual(first.upper);
  expect(
    [...first.items, ...second.items, ...third.items].map((row) => ({
      id: row.id,
      recordedAt: row.recordedAt,
    })),
  ).toEqual(rows);
  const latest = await auditPage(request);
  expect(latest.items[0]!.event).toBe('source.create.requested');
  expect(latest.upper).not.toEqual(first.upper);
});

test('E2E-API-483 unknown stored actions and all target formats stay private while explicit cleanup event labels remain historical @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  const pool = await auditDatabase(feedbackSandbox);
  try {
    for (const action of [
      '<script>synthetic-private-action</script>',
      'constructor',
      'retention-preview',
      'retention-completed',
      'retention-failed',
    ])
      await pool.query(
        'INSERT INTO operator_audit(id,actor_hash,action,target) VALUES($1,$2,$3,$4)',
        [
          randomUUID(),
          'synthetic-actor-secret',
          action,
          'https://private.invalid/?password=synthetic-secret-feedback',
        ],
      );
    const page = await auditPage(request);
    expect(page.items.filter((row) => row.event === 'other')).toHaveLength(2);
    expect(
      page.items
        .filter((row) => row.module === 'retention')
        .map((row) => row.event)
        .sort(),
    ).toEqual(['retention-completed', 'retention-failed', 'retention-preview']);
    expect(JSON.stringify(page)).not.toMatch(
      /synthetic|script|constructor|actor|target|password|feedback|private.invalid/,
    );
    expect((await auditPage(request, 'module=other')).items).toHaveLength(2);
  } finally {
    await pool.end();
  }
});

test('E2E-API-484 actual table wait followed by wall-clock expiry denies projected audit disclosure @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  await seedAudit(feedbackSandbox, 1);
  const pool = await auditDatabase(feedbackSandbox),
    blocker = await auditBlock(feedbackSandbox, 'audit');
  let waiting: Promise<APIResponse> | undefined;
  try {
    waiting = request.get(base);
    await waitAuditBlock(pool, blocker.pid, 'operator_audit');
    await pool.query(
      'UPDATE operator_sessions SET expires_at=clock_timestamp()',
    );
    await blocker.release();
    const response = await waiting;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('source.create');
  } finally {
    await blocker.release();
    await waiting?.catch(() => undefined);
    await pool.end();
  }
});

test('E2E-API-485 committed revocation or expiry ahead of final session lock denies an already-read audit page @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedAudit(feedbackSandbox, 1);
  const pool = await auditDatabase(feedbackSandbox);
  try {
    for (const kind of ['revoke', 'expire'] as const) {
      await loginAuditOperator(request);
      const blocker = await auditBlock(feedbackSandbox, kind);
      let waiting: Promise<APIResponse> | undefined;
      try {
        waiting = request.get(base);
        await waitAuditBlock(pool, blocker.pid, 'operator_sessions');
        await blocker.release(true);
        const response = await waiting;
        expect(response.status()).toBe(401);
        expect(await response.text()).not.toContain('discovery.review');
      } finally {
        await blocker.release();
        await waiting?.catch(() => undefined);
      }
    }
  } finally {
    await pool.end();
  }
});

test('E2E-API-486 actual storage failure is safe and the same cursor recovers without audit writes @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  await seedAudit(feedbackSandbox, 55);
  const first = await auditPage(request),
    pool = await auditDatabase(feedbackSandbox);
  let renamed = false;
  try {
    await pool.query(
      'ALTER TABLE operator_audit RENAME TO synthetic_unavailable_audit',
    );
    renamed = true;
    const failed = await request.get(
      `${base}?cursor=${encodeURIComponent(first.nextCursor!)}`,
    );
    expect(failed.status()).toBe(503);
    expect(await failed.text()).not.toMatch(
      /synthetic_unavailable|SELECT|actor_hash/,
    );
    await pool.query(
      'ALTER TABLE synthetic_unavailable_audit RENAME TO operator_audit',
    );
    renamed = false;
    expect(
      (
        await auditPage(
          request,
          `cursor=${encodeURIComponent(first.nextCursor!)}`,
        )
      ).items,
    ).toHaveLength(5);
    expect(
      (
        await pool.query<{ n: number }>(
          'SELECT count(*)::integer AS n FROM operator_audit',
        )
      ).rows[0]?.n,
    ).toBe(55);
  } finally {
    if (renamed)
      await pool.query(
        'ALTER TABLE synthetic_unavailable_audit RENAME TO operator_audit',
      );
    await pool.end();
  }
});

test('E2E-API-487 audit browser preserves immutable rows and actual owned financial records @OPS-AUDIT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginAuditOperator(request);
  await seedAudit(feedbackSandbox, 2);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `audit_${randomUUID().slice(0, 12)}`,
          password: 'Synthetic-audit-account-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/account/watchlist', {
        headers,
        data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/v1/account/goals', { headers, data: authGoal })
    ).status(),
  ).toBe(201);
  const before = await (await request.get('/api/v1/account/goals')).json(),
    pool = await auditDatabase(feedbackSandbox);
  try {
    const ledger = (
      await pool.query('SELECT * FROM operator_audit ORDER BY id')
    ).rows;
    await auditPage(request);
    await auditPage(request, 'module=other');
    expect((await request.post(base, { headers, data: {} })).status()).toBe(
      404,
    );
    expect((await request.delete(base, { headers })).status()).toBe(404);
    await expect(
      pool.query("UPDATE operator_audit SET action='other'"),
    ).rejects.toThrow();
    await expect(pool.query('DELETE FROM operator_audit')).rejects.toThrow();
    expect(
      (await pool.query('SELECT * FROM operator_audit ORDER BY id')).rows,
    ).toEqual(ledger);
    expect(await (await request.get('/api/v1/account/goals')).json()).toEqual(
      before,
    );
  } finally {
    await pool.end();
  }
});
