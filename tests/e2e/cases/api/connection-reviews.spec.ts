import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  connectionDatabase,
  seedConnectionSource,
  prepareConnectionAccount,
  reviseConnectionSourceFixture,
  connectionHeaders as headers,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import {
  ResearchConnectionRevisionSchema,
  connectionSource,
  ConnectionReviewInboxSchema,
  ConnectionReviewReceiptSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const base = '/api/v1/account/connection-reviews';
test('E2E-API-310 durable review check coalesces acknowledge reopens resolves and preserves finances @CONNECTION-REVIEWS-001', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.put(`/api/v1/account/research-connections/${id}`, {
    headers,
    data: {
      action: 'create',
      requestId: randomUUID(),
      expectedVersion: 0,
      source: {
        itemId: source.id,
        version: source.version,
        sourceHash: source.sourceHash,
      },
      target: { kind: 'holding', id: 'INE002A01018', version: 1 },
      note: 'My synthetic review question.',
      storageConsent: true,
    },
  });
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const check = async (requestId = randomUUID()) => {
    const r = await request.post(`${base}/check`, {
      headers,
      data: { requestId },
    });
    expect(r.status()).toBe(201);
    return ConnectionReviewReceiptSchema.parse(await r.json());
  };
  const state = async () =>
    ConnectionReviewInboxSchema.parse(await (await request.get(base)).json());
  await check();
  expect((await state()).notices).toEqual([]);
  const newer = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  const requestId = randomUUID(),
    receipt = await check(requestId);
  expect(receipt.evaluation?.changedCount).toBe(1);
  const notice = (await state()).notices[0]!;
  const ack = { requestId: randomUUID(), expectedVersion: notice.version };
  const a = await request.post(`${base}/${id}/acknowledge`, {
    headers,
    data: ack,
  });
  expect(a.status()).toBe(201);
  const acknowledgement = await a.json();
  expect(
    await (
      await request.post(`${base}/${id}/acknowledge`, { headers, data: ack })
    ).json(),
  ).toEqual(acknowledgement);
  expect(await check(requestId)).toEqual(receipt);
  expect((await state()).notices[0]?.status).toBe('acknowledged');
  await check();
  expect((await state()).notices).toHaveLength(1);
  expect((await state()).notices[0]?.status).toBe('acknowledged');
  await reviseConnectionSourceFixture(feedbackSandbox, newer, 'withdrawn');
  await check();
  expect((await state()).notices[0]?.status).toBe('open');
  expect((await state()).notices[0]?.reasons.join(' ')).toContain('withdrawn');
  expect(
    (
      await request.post(`${base}/${id}/acknowledge`, {
        headers,
        data: { ...ack, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const stranger = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(stranger);
    expect(
      (
        await stranger.post(`${base}/${id}/acknowledge`, {
          headers,
          data: { requestId: randomUUID(), expectedVersion: 3 },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await stranger.dispose();
  }
  await request.put(`/api/v1/account/research-connections/${id}`, {
    headers,
    data: { action: 'remove', requestId: randomUUID(), expectedVersion: 1 },
  });
  await check();
  expect((await state()).notices[0]?.status).toBe('resolved');
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.goals).toEqual(before.goals);
  expect(after.holdings).toEqual(before.holdings);
  expect(after.connectionReviews.notices).toHaveLength(1);
  expect(JSON.stringify(after.connectionReviews)).not.toContain(source.title);
  await request.delete('/api/v1/account', {
    headers,
    data: { password: connectionPassword },
  });
  expect((await request.get(base)).status()).toBe(401);
});
test('E2E-API-311 concurrent same check and acknowledgements preserve one coalesced version @CONNECTION-REVIEWS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.put(`/api/v1/account/research-connections/${id}`, {
    headers,
    data: {
      action: 'create',
      requestId: randomUUID(),
      expectedVersion: 0,
      source: {
        itemId: source.id,
        version: source.version,
        sourceHash: source.sourceHash,
      },
      target: { kind: 'holding', id: 'INE002A01018', version: 1 },
      note: 'Synthetic concurrency test.',
      storageConsent: true,
    },
  });
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  const data = { requestId: randomUUID() };
  const replies = await Promise.all(
    [0, 1].map(() => request.post(`${base}/check`, { headers, data })),
  );
  expect(await replies[0]!.json()).toEqual(await replies[1]!.json());
  const inbox = ConnectionReviewInboxSchema.parse(
    await (await request.get(base)).json(),
  );
  expect(inbox.evaluations).toHaveLength(1);
  const results = await Promise.all(
    [0, 1].map(() =>
      request.post(`${base}/${id}/acknowledge`, {
        headers,
        data: { requestId: randomUUID(), expectedVersion: 1 },
      }),
    ),
  );
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
});

test('E2E-API-312 removed-history turnover cannot block a bounded current review @CONNECTION-REVIEWS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const pool = await connectionDatabase(feedbackSandbox);
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 200 }, () => randomUUID()),
  );
  try {
    const old = '2026-01-01T00:00:00.000Z';
    const revisions = groups.flatMap((ids, group) =>
      ids.map((id) =>
        ResearchConnectionRevisionSchema.parse({
          id,
          version: group < 2 ? 2 : 1,
          action: group < 2 ? 'remove' : 'create',
          removed: group < 2,
          source: connectionSource(source),
          target: {
            binding: { kind: 'holding', id: 'INE002A01018', version: 1 },
            label: 'INE002A01018',
          },
          note: 'Synthetic bounded turnover fixture.',
          savedAt: old,
          consentedAt: old,
        }),
      ),
    );
    await pool.query(
      `INSERT INTO app_research_connections(id,user_id,version,removed) SELECT (r->>'id')::uuid,$1,(r->>'version')::integer,(r->>'removed')::boolean FROM jsonb_array_elements($2::jsonb) r`,
      [before.account.id, JSON.stringify(revisions)],
    );
    await pool.query(
      `INSERT INTO app_research_connection_revisions(connection_id,user_id,version,payload) SELECT (r->>'id')::uuid,$1,(r->>'version')::integer,r FROM jsonb_array_elements($2::jsonb) r`,
      [
        before.account.id,
        JSON.stringify(
          revisions.flatMap((r) =>
            r.removed
              ? [{ ...r, version: 1, action: 'create', removed: false }, r]
              : [r],
          ),
        ),
      ],
    );
    const inbox = ConnectionReviewInboxSchema.parse({
      notices: groups.slice(0, 2).flatMap((ids, group) =>
        ids.map((connectionId) => ({
          connectionId,
          version: 1,
          status: group === 0 ? 'resolved' : 'open',
          targetLabel: 'INE002A01018',
          fingerprint: 'synthetic-prior-evaluation',
          reasons: group === 0 ? [] : ['A newer source edition is published.'],
          checkedAt: old,
          acknowledgedAt: null,
          bundleGeneratedAt: null,
        })),
      ),
      evaluations: [],
      lastCheckedAt: old,
      bundleGeneratedAt: null,
    });
    await pool.query(
      'INSERT INTO app_connection_review_inboxes(user_id,payload) VALUES($1,$2)',
      [before.account.id, inbox],
    );
    await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
    const reply = await request.post(`${base}/check`, {
      headers,
      data: { requestId: randomUUID() },
    });
    expect(reply.status()).toBe(201);
    const current = ConnectionReviewInboxSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(current.notices).toHaveLength(400);
    expect(
      current.notices
        .filter((n) => n.status === 'open')
        .map((n) => n.connectionId)
        .sort(),
    ).toEqual([...groups[2]!].sort());
    expect(
      current.notices
        .filter((n) => n.status === 'resolved')
        .map((n) => n.connectionId)
        .sort(),
    ).toEqual([...groups[1]!].sort());
    const after = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(after.goals).toEqual(before.goals);
    expect(after.holdings).toEqual(before.holdings);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM app_research_connection_revisions WHERE user_id=$1',
            [before.account.id],
          )
        ).rows[0].count,
      ),
    ).toBe(1000);
  } finally {
    await pool.end();
  }
});

test('E2E-API-313 expiry while waiting for the final source lock prevents review writes @CONNECTION-REVIEWS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  expect(
    (
      await request.put(`/api/v1/account/research-connections/${id}`, {
        headers,
        data: {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: { kind: 'holding', id: 'INE002A01018', version: 1 },
          note: 'Synthetic source lock expiry.',
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(200);
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const pool = await connectionDatabase(feedbackSandbox);
  const blocker = await pool.connect();
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [source.id],
    );
    pending = request.post(`${base}/check`, {
      headers,
      data: { requestId: randomUUID() },
    });
    void pending.catch(() => undefined);
    await expect
      .poll(async () =>
        Number(
          (
            await blocker.query(
              'SELECT count(*) FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
              [pid],
            )
          ).rows[0].count,
        ),
      )
      .toBe(1);
    await blocker.query(
      `UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1`,
      [owner],
    );
    await blocker.query('COMMIT');
    const result = await pending;
    expect(result.status()).toBe(401);
    await result.body();
    expect(
      Number(
        (
          await blocker.query(
            'SELECT count(*) FROM app_connection_review_requests WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await blocker.query(
            'SELECT count(*) FROM app_connection_review_inboxes WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    if (pending) await pending.catch(() => undefined);
    await pool.end();
  }
});

test('E2E-API-314 retained request capacity preserves replay and expires IDs explicitly @CONNECTION-REVIEWS-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const id = randomUUID();
  const first = await request.post(`${base}/check`, {
    headers,
    data: { requestId: id },
  });
  expect(first.status()).toBe(201);
  const receipt = ConnectionReviewReceiptSchema.parse(await first.json());
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const synthetic = Array.from({ length: 999 }, () => {
      const requestId = randomUUID();
      return {
        ...receipt,
        requestId,
        evaluation: receipt.evaluation
          ? { ...receipt.evaluation, requestId }
          : null,
      };
    });
    await pool.query(
      `INSERT INTO app_connection_review_requests(user_id,request_id,fingerprint,payload) SELECT $1,(r->>'requestId')::uuid,'synthetic-capacity-fixture',r FROM jsonb_array_elements($2::jsonb) r`,
      [owner, JSON.stringify(synthetic)],
    );
    const replay = await request.post(`${base}/check`, {
      headers,
      data: { requestId: id },
    });
    expect(replay.status()).toBe(201);
    expect(await replay.json()).toEqual(receipt);
    const full = await request.post(`${base}/check`, {
      headers,
      data: { requestId: randomUUID() },
    });
    expect(full.status()).toBe(400);
    expect((await full.json()).message).toContain('limit');
    expect(
      ConnectionReviewInboxSchema.parse(await (await request.get(base)).json())
        .evaluations,
    ).toHaveLength(1);
    await pool.query(
      `UPDATE app_connection_review_requests SET created_at=clock_timestamp()-interval '31 days' WHERE user_id=$1 AND request_id=$2`,
      [owner, synthetic[0]!.requestId],
    );
    expect(
      (
        await request.post(`${base}/check`, {
          headers,
          data: { requestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    await pool.query(
      `UPDATE app_connection_review_requests SET created_at=clock_timestamp()-interval '31 days' WHERE user_id=$1 AND request_id=$2`,
      [owner, id],
    );
    const reused = await request.post(`${base}/check`, {
      headers,
      data: { requestId: id },
    });
    expect(reused.status()).toBe(201);
    const newReceipt = ConnectionReviewReceiptSchema.parse(await reused.json());
    expect(newReceipt.recordedAt).not.toBe(receipt.recordedAt);
    const state = ConnectionReviewInboxSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(state.evaluations.filter((e) => e.requestId === id)).toHaveLength(2);
    expect(
      (
        await request.post(`${base}/${randomUUID()}/acknowledge`, {
          headers,
          data: { requestId: id, expectedVersion: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM app_connection_review_requests WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(1000);
  } finally {
    await pool.end();
  }
});
