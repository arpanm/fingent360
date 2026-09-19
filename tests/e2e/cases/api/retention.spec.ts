import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  loginRetentionOperator,
  ownedRetentionDatabase,
  retentionHeaders as headers,
  retentionPreview,
  retentionExecute,
  seedRetentionRows,
  retainedRowDigests,
  retentionCsv,
} from '../../helpers/retention';
import {
  RetentionRecordSchema,
  RetentionHistorySchema,
  HoldingsSnapshotSchema,
  ReportJobSchema,
  retentionScopes,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-API-250 fixed expiry cleanup preserves current data receipts issued reports and count-only history @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    const report = ReportJobSchema.parse(
      await (
        await request.post('/api/v1/account/reports', {
          headers,
          data: {
            requestId: randomUUID(),
            label: 'Synthetic retention preservation',
            consent: true,
          },
        })
      ).json(),
    );
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${report.id}`)
            ).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('succeeded');
    const issuedBefore = await (
      await request.get(`/api/v1/account/reports/${report.id}/download`)
    ).json();
    const before = await retainedRowDigests(pool);
    const receiptDigest = () =>
      pool.query(
        'SELECT md5(row_to_json(receipt)::text) AS digest FROM (SELECT id,token_hash,payload_hash,version,status,received_at,expires_at FROM feedback_reports WHERE id=$1) receipt',
        [fixture.expiredFeedback.id],
      );
    const feedbackReceipt = await receiptDigest();
    const preservedFresh = async () =>
      (
        await pool.query<{ digest: string }>(
          `
      SELECT md5(row_to_json(t)::text) AS digest FROM feedback_reports t WHERE id=$1
      UNION ALL SELECT md5(row_to_json(t)::text) FROM app_holdings_previews t WHERE id=$2
      UNION ALL SELECT md5(row_to_json(t)::text) FROM app_sessions t WHERE token_hash=$3
      UNION ALL SELECT md5(row_to_json(t)::text) FROM operator_sessions t WHERE token_hash=$3
      UNION ALL SELECT md5(row_to_json(t)::text) FROM app_login_limits t WHERE username=$3
      UNION ALL SELECT md5(row_to_json(t)::text) FROM operator_login_limits t WHERE client_hash=$3
      UNION ALL SELECT md5(row_to_json(t)::text) FROM app_recovery_limits t WHERE key_hash=$3
      UNION ALL SELECT md5(row_to_json(t)::text) FROM feedback_rate_limits t WHERE bucket=$3 ORDER BY 1
    `,
          [
            fixture.freshFeedback.id,
            fixture.freshPreview.previewId,
            fixture.fresh,
          ],
        )
      ).rows;
    const freshBefore = await preservedFresh();
    const preview = await retentionPreview(request);
    expect(preview.preview.map((row) => row.count)).toEqual(Array(8).fill(1));
    expect(preview.preview.every((row) => !row.moreAvailable)).toBe(true);
    expect(preview.status).toBe('ready');
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND encrypted_payload IS NOT NULL AND text IS NULL AND deleted_at IS NULL',
          [fixture.expiredFeedback.id],
        )
      ).rows,
    ).toHaveLength(1);
    const saved = RetentionRecordSchema.parse(
      await (
        await request.get(`/api/v1/ops/retention/runs/${preview.id}`)
      ).json(),
    );
    expect(saved).toEqual(preview);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND deleted_at IS NULL',
          [fixture.expiredFeedback.id],
        )
      ).rows,
    ).toHaveLength(1);
    const result = await retentionExecute(request, preview.id);
    expect(result.status).toBe('completed');
    expect(result.result).toEqual(preview.preview);
    expect(result.attempts).toBe(1);
    expect(await retentionExecute(request, preview.id)).toEqual(result);
    expect(await retentionPreview(request, preview.id)).toEqual(result);
    expect(await retainedRowDigests(pool)).toEqual(before);
    expect(await preservedFresh()).toEqual(freshBefore);
    expect((await receiptDigest()).rows).toEqual(feedbackReceipt.rows);
    expect(
      (
        await pool.query<{ scrubbed: boolean }>(
          'SELECT deleted_at IS NOT NULL AND text IS NULL AND context IS NULL AND image_meta IS NULL AND image_bytes IS NULL AND audio_meta IS NULL AND audio_bytes IS NULL AND encrypted_payload IS NULL AS scrubbed FROM feedback_reports WHERE id=$1',
          [fixture.expiredFeedback.id],
        )
      ).rows[0]?.scrubbed,
    ).toBe(true);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers,
          data: fixture.expiredFeedback,
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND deleted_at IS NULL',
          [fixture.expiredFeedback.id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      await (
        await request.get(`/api/v1/account/reports/${report.id}/download`)
      ).json(),
    ).toEqual(issuedBefore);
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ),
    ).toEqual(fixture.snapshot);
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv: retentionCsv, expectedVersion: 1, storageConsent: true },
        })
      ).status(),
    ).toBe(201);
    expect(
      HoldingsSnapshotSchema.parse(
        await (
          await request.post('/api/v1/account/holdings/confirm', {
            headers,
            data: fixture.confirmation,
          })
        ).json(),
      ),
    ).toEqual(fixture.snapshot);
    const history = RetentionHistorySchema.parse(
      await (await request.get('/api/v1/ops/retention/runs')).json(),
    );
    expect(history.records).toEqual([result]);
    const serialized = JSON.stringify(history);
    for (const privateValue of [
      fixture.username,
      fixture.userId,
      fixture.expired,
      fixture.expiredFeedback.text,
      fixture.expiredFeedback.receiptToken,
    ])
      expect(
        serialized.includes(privateValue),
        'Count-only history excludes fixture private values.',
      ).toBe(false);
    const audits = await pool.query(
      "SELECT action,target FROM operator_audit WHERE action LIKE 'retention-%' ORDER BY recorded_at",
    );
    expect(audits.rows).toEqual([
      { action: 'retention-preview', target: preview.id },
      { action: 'retention-completed', target: preview.id },
    ]);
    await expect(
      pool.query(
        "UPDATE retention_runs SET payload=jsonb_set(payload,'{attempts}','9') WHERE id=$1",
        [preview.id],
      ),
    ).rejects.toThrow('immutable');
    await expect(
      pool.query('DELETE FROM retention_runs WHERE id=$1', [preview.id]),
    ).rejects.toThrow('preserved');
  } finally {
    await pool.end();
  }
});

test('E2E-API-251 operator authorization Origin strict fields and server cutoff protect cleanup @RETENTION-001', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  const unknown = randomUUID();
  expect((await request.get('/api/v1/ops/retention/runs')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/retention/previews', {
        headers,
        data: { requestId: unknown },
      })
    ).status(),
  ).toBe(401);
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `plain_${unknown.slice(0, 12)}`,
      password: 'Synthetic-retention-access-2026',
      consent: true,
    },
  });
  expect(
    (await request.get(`/api/v1/ops/retention/runs/${unknown}`)).status(),
  ).toBe(401);
  await loginRetentionOperator(request);
  expect(
    (
      await request.post('/api/v1/ops/retention/previews', {
        data: { requestId: unknown },
      })
    ).status(),
  ).toBe(403);
  for (const extra of [
    { cutoffAt: '9999-01-01T00:00:00.000Z' },
    { table: 'app_users' },
    { userId: unknown },
    { limit: 9999 },
  ])
    expect(
      (
        await request.post('/api/v1/ops/retention/previews', {
          headers,
          data: { requestId: unknown, ...extra },
        })
      ).status(),
    ).toBe(400);
  expect(
    (await request.get('/api/v1/ops/retention/runs?table=app_users')).status(),
  ).toBe(400);
  expect(
    (
      await request.get('/api/v1/ops/retention/runs?cursor=not-a-cursor')
    ).status(),
  ).toBe(400);
  expect(
    (await request.get(`/api/v1/ops/retention/runs/${unknown}`)).status(),
  ).toBe(404);
  const preview = await retentionPreview(request);
  for (const body of [
    { confirm: false },
    {},
    { confirm: true, cutoffAt: preview.cutoffAt },
  ])
    expect(
      (
        await request.post(`/api/v1/ops/retention/runs/${preview.id}/execute`, {
          headers,
          data: body,
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post(`/api/v1/ops/retention/runs/${preview.id}/execute`, {
        headers: { Origin: 'https://untrusted.invalid' },
        data: { confirm: true },
      })
    ).status(),
  ).toBe(403);
  const outsider = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    expect(
      (
        await outsider.post(
          `/api/v1/ops/retention/runs/${preview.id}/execute`,
          { headers, data: { confirm: true } },
        )
      ).status(),
    ).toBe(401);
  } finally {
    await outsider.dispose();
  }
  expect(
    (await retentionExecute(request, preview.id)).result?.every(
      (row) => row.count === 0,
    ),
  ).toBe(true);
});

test('E2E-API-252 bounded batches replay across concurrent operators and preserve records expiring after the saved cutoff @RETENTION-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    await loginRetentionOperator(request);
    await loginRetentionOperator(other);
    await pool.query(
      "INSERT INTO app_login_limits(username,attempts,reset_at) SELECT 'synthetic-cap-'||n,1,now()-interval '1 day' FROM generate_series(1,105) n",
    );
    const id = randomUUID();
    const [first, duplicate] = await Promise.all([
      retentionPreview(request, id),
      retentionPreview(other, id),
    ]);
    expect(duplicate).toEqual(first);
    const count = first.preview.find(
      (row) => row.scope === 'account-login-attempts',
    );
    expect(count).toEqual({
      scope: 'account-login-attempts',
      count: 100,
      moreAvailable: true,
    });
    const next = await retentionPreview(other);
    // This row expires after both saved cutoffs; even though it is expired at
    // execution time, these previews cannot authorize deleting it.
    await pool.query(
      "INSERT INTO app_login_limits(username,attempts,reset_at) VALUES('synthetic-later',1,clock_timestamp())",
    );
    const [completed, replay] = await Promise.all([
      retentionExecute(request, id),
      retentionExecute(other, id),
    ]);
    expect(replay).toEqual(completed);
    expect(completed.result?.find((row) => row.scope === count?.scope)).toEqual(
      count,
    );
    const remainder = await retentionExecute(other, next.id);
    expect(remainder.result?.find((row) => row.scope === count?.scope)).toEqual(
      { scope: 'account-login-attempts', count: 5, moreAvailable: false },
    );
    expect(
      (await pool.query('SELECT username FROM app_login_limits')).rows,
    ).toEqual([{ username: 'synthetic-later' }]);
    expect(await retentionExecute(other, id)).toEqual(completed);
    const final = await retentionExecute(
      request,
      (await retentionPreview(request)).id,
    );
    expect(final.result?.find((row) => row.scope === count?.scope)?.count).toBe(
      1,
    );
    expect(
      (
        await pool.query(
          "SELECT 1 FROM operator_audit WHERE action='retention-completed' AND target=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await other.dispose();
    await pool.end();
  }
});

test('E2E-API-253 later-category failure rolls the complete batch back and retries the durable preview without private error text @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    const preview = await retentionPreview(request);
    await pool.query(
      "CREATE FUNCTION fixture_retention_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic-private-driver-error'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER fixture_retention_failure BEFORE DELETE ON app_recovery_limits FOR EACH ROW EXECUTE FUNCTION fixture_retention_failure()',
    );
    const failed = await retentionExecute(request, preview.id);
    expect(failed.status).toBe('failed');
    expect(failed.result).toBeNull();
    expect(failed.attempts).toBe(1);
    expect(JSON.stringify(failed)).not.toContain(
      'Synthetic-private-driver-error',
    );
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await pool.query('SELECT 1 FROM app_login_limits WHERE username=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND deleted_at IS NULL',
          [fixture.expiredFeedback.id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      RetentionRecordSchema.parse(
        await (
          await request.get(`/api/v1/ops/retention/runs/${preview.id}`)
        ).json(),
      ),
    ).toEqual(failed);
    await pool.query(
      'DROP TRIGGER fixture_retention_failure ON app_recovery_limits',
    );
    const retry = await retentionExecute(request, preview.id);
    expect(retry.status).toBe('completed');
    expect(retry.attempts).toBe(2);
    expect(retry.result).toEqual(preview.preview);
    expect(
      (
        await pool.query(
          'SELECT action FROM operator_audit WHERE target=$1 ORDER BY recorded_at',
          [preview.id],
        )
      ).rows,
    ).toEqual([
      { action: 'retention-preview' },
      { action: 'retention-failed' },
      { action: 'retention-completed' },
    ]);
  } finally {
    await pool.end();
  }
});

test('E2E-API-254 confirmed receipts survive ordinary preview expiry and draft capacity while history pagination remains bounded @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    // Synthetic duplicate confirmed receipts test the pending-capacity boundary.
    await pool.query(
      'INSERT INTO app_holdings_previews(id,user_id,expected_version,payload,expires_at,confirmed_version) SELECT gen_random_uuid(),user_id,expected_version,$2::jsonb,expires_at,confirmed_version FROM app_holdings_previews CROSS JOIN generate_series(1,20) WHERE id=$1',
      [
        fixture.confirmed.previewId,
        JSON.stringify({
          holdings: fixture.confirmed.holdings,
          import: fixture.confirmed.import,
          reconciliation: fixture.confirmed.reconciliation,
        }),
      ],
    );
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv: retentionCsv, expectedVersion: 1, storageConsent: true },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await pool.query('SELECT 1 FROM app_holdings_previews WHERE id=$1', [
          fixture.expiredPreview.previewId,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM app_holdings_previews WHERE confirmed_version=1',
        )
      ).rows,
    ).toHaveLength(21);
    expect(
      HoldingsSnapshotSchema.parse(
        await (
          await request.post('/api/v1/account/holdings/confirm', {
            headers,
            data: fixture.confirmation,
          })
        ).json(),
      ),
    ).toEqual(fixture.snapshot);
    const ids = [];
    for (let index = 0; index < 21; index++)
      ids.push((await retentionPreview(request)).id);
    const page = RetentionHistorySchema.parse(
      await (await request.get('/api/v1/ops/retention/runs')).json(),
    );
    expect(page.records).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
    const older = RetentionHistorySchema.parse(
      await (
        await request.get(
          `/api/v1/ops/retention/runs?cursor=${encodeURIComponent(page.nextCursor!)}`,
        )
      ).json(),
    );
    expect(older.records).toHaveLength(1);
    expect(older.nextCursor).toBeNull();
    expect(
      [...page.records, ...older.records].map((row) => row.id).sort(),
    ).toEqual(ids.sort());
    for (const row of page.records)
      expect(row.preview.map((value) => value.scope)).toEqual(
        retentionScopes.map((value) => value.id),
      );
  } finally {
    await pool.end();
  }
});

test('E2E-API-255 owned backend interruption rolls back unfinished cleanup and preserves its original preview for retry @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    const preview = await retentionPreview(request);
    await pool.query(
      'CREATE FUNCTION fixture_retention_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(20); RETURN OLD; END; $$',
    );
    await pool.query(
      'CREATE TRIGGER fixture_retention_pause BEFORE DELETE ON app_recovery_limits FOR EACH ROW EXECUTE FUNCTION fixture_retention_pause()',
    );
    const pending = request.post(
      `/api/v1/ops/retention/runs/${preview.id}/execute`,
      { headers, data: { confirm: true } },
    );
    // Select/terminate only a sleeping cleanup holding a relation lock in this
    // exact owned schema. Never stop the shared application or another backend.
    const paused = `SELECT a.pid FROM pg_stat_activity a WHERE a.wait_event='PgSleep' AND a.query LIKE 'WITH eligible AS%DELETE FROM app_recovery_limits%' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.relation='app_recovery_limits'::regclass)`;
    await expect
      .poll(async () => (await pool.query(paused)).rows.length, {
        timeout: 5000,
      })
      .toBe(1);
    const terminated = await pool.query<{ stopped: boolean }>(
      `SELECT pg_terminate_backend(pid) AS stopped FROM (${paused}) owned`,
    );
    expect(terminated.rows).toEqual([{ stopped: true }]);
    expect((await pending).status()).toBe(503);
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await pool.query('SELECT 1 FROM app_login_limits WHERE username=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      RetentionRecordSchema.parse(
        await (
          await request.get(`/api/v1/ops/retention/runs/${preview.id}`)
        ).json(),
      ),
    ).toEqual(preview);
    await pool.query(
      'DROP TRIGGER fixture_retention_pause ON app_recovery_limits',
    );
    expect((await retentionExecute(request, preview.id)).status).toBe(
      'completed',
    );
  } finally {
    await pool.end();
  }
});

test('E2E-API-256 concurrent normal feedback expiry keeps tombstones and reports only actual cleanup changes @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    const preview = await retentionPreview(request);
    const [result, expiry] = await Promise.all([
      retentionExecute(request, preview.id),
      request.get(`/api/v1/feedback/${fixture.expiredFeedback.id}`, {
        headers: { 'X-Feedback-Token': fixture.expiredFeedback.receiptToken },
      }),
    ]);
    expect(expiry.status()).toBe(410);
    expect(result.status).toBe('completed');
    expect([0, 1]).toContain(
      result.result?.find((row) => row.scope === 'feedback-content')?.count,
    );
    expect(
      result.result?.find((row) => row.scope === 'feedback-content')
        ?.moreAvailable,
    ).toBe(false);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers,
          data: fixture.expiredFeedback,
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND deleted_at IS NOT NULL AND text IS NULL AND image_bytes IS NULL AND audio_bytes IS NULL AND encrypted_payload IS NULL',
          [fixture.expiredFeedback.id],
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await pool.end();
  }
});

test('E2E-API-257 every allowlisted category caps truthful counts including the smaller attachment batch @RETENTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  await loginRetentionOperator(request);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    const fixture = await seedRetentionRows(request, pool);
    // Simulated aged rows live only in the owned schema; these do not represent
    // real users, provider evidence or invented successful API submissions.
    await pool.query(
      "INSERT INTO app_sessions(token_hash,user_id,expires_at) SELECT 'synthetic-cap-'||n,$1,now()-interval '1 day' FROM generate_series(1,100) n",
      [fixture.userId],
    );
    await pool.query(
      "INSERT INTO operator_sessions(token_hash,expires_at) SELECT 'synthetic-cap-'||n,now()-interval '1 day' FROM generate_series(1,100) n",
    );
    await pool.query(
      "INSERT INTO app_login_limits(username,attempts,reset_at) SELECT 'synthetic-cap-'||n,1,now()-interval '1 day' FROM generate_series(1,100) n",
    );
    await pool.query(
      "INSERT INTO operator_login_limits(client_hash,attempts,reset_at) SELECT 'synthetic-cap-'||n,1,now()-interval '1 day' FROM generate_series(1,100) n",
    );
    await pool.query(
      "INSERT INTO app_recovery_limits(key_hash,attempts,reset_at) SELECT md5('synthetic-cap-'||n)||md5('synthetic-cap-'||n),1,now()-interval '1 day' FROM generate_series(1,100) n",
    );
    await pool.query(
      "INSERT INTO feedback_rate_limits(bucket,count,window_start) SELECT 'synthetic-cap-'||n,1,now()-interval '3 days' FROM generate_series(1,100) n",
    );
    await pool.query(
      'INSERT INTO app_holdings_previews(id,user_id,expected_version,payload,expires_at,confirmed_version) SELECT gen_random_uuid(),user_id,expected_version,$2::jsonb,expires_at,confirmed_version FROM app_holdings_previews CROSS JOIN generate_series(1,100) WHERE id=$1',
      [
        fixture.expiredPreview.previewId,
        JSON.stringify({
          holdings: fixture.expiredPreview.holdings,
          import: fixture.expiredPreview.import,
          reconciliation: fixture.expiredPreview.reconciliation,
        }),
      ],
    );
    await pool.query(
      // Explicit legacy synthetic copies exercise cleanup without copying an
      // encrypted envelope to an ID outside its authenticated binding.
      "INSERT INTO feedback_reports(id,token_hash,payload_hash,expires_at,text) SELECT gen_random_uuid(),token_hash,payload_hash,expires_at,'Synthetic legacy cap fixture' FROM feedback_reports CROSS JOIN generate_series(1,20) WHERE id=$1",
      [fixture.expiredFeedback.id],
    );
    const preview = await retentionPreview(request);
    const expected = retentionScopes.map((scope) => ({
      scope: scope.id,
      count: scope.limit,
      moreAvailable: true,
    }));
    expect(preview.preview).toEqual(expected);
    expect((await retentionExecute(request, preview.id)).result).toEqual(
      expected,
    );
    expect(
      (await retentionExecute(request, (await retentionPreview(request)).id))
        .result,
    ).toEqual(
      retentionScopes.map((scope) => ({
        scope: scope.id,
        count: 1,
        moreAvailable: false,
      })),
    );
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.fresh,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM feedback_reports WHERE id=$1 AND deleted_at IS NULL',
          [fixture.freshFeedback.id],
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await pool.end();
  }
});
