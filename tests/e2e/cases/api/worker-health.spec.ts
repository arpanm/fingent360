import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  workerBase as base,
  workerHeaders as headers,
  loginWorkerOperator,
  workerDatabase,
  workerOverview,
  workerControl,
  startWorker,
  workerBlock,
} from '../../helpers/worker-health';
import {
  WorkerControlHistorySchema,
  ReportJobSchema,
} from '../../../../packages/contracts/src/index';
import {
  seedConnectionSource,
  prepareConnectionAccount,
} from '../../helpers/research-connection-fixture';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
async function account(request: APIRequestContext) {
  const response = await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `worker_${randomUUID().slice(0, 12)}`,
      password: 'Synthetic-worker-password-2026',
      consent: true,
    },
  });
  expect(response.status()).toBe(201);
}
async function report(request: APIRequestContext) {
  const response = await request.post('/api/v1/account/reports', {
    headers,
    data: {
      requestId: randomUUID(),
      label: 'Synthetic private report must never appear in worker health',
      consent: true,
    },
  });
  expect(response.status()).toBe(201);
  return ReportJobSchema.parse(await response.json());
}

test('E2E-API-350 guest Origin strict input and count-only initial health boundaries @WORKER-HEALTH-001', async ({
  request,
  feedbackSandbox,
}) => {
  expect((await request.get(base)).status()).toBe(401);
  await loginWorkerOperator(request);
  const state = await workerOverview(request);
  expect(state.workers.map((w) => w.worker)).toEqual(['reports', 'reminders']);
  for (const row of state.workers) {
    expect(row.freshness).toBe('not-observed');
    expect(row.queued).toEqual({ count: 0, moreAvailable: false });
    expect(row.lastFailureAt).toBeNull();
  }
  expect(state.workers[1]!.activeLeases).toBeNull();
  const pool = await workerDatabase(feedbackSandbox);
  try {
    const enabled = (
      await pool.query(
        "SELECT to_regclass(format('%I.report_schedules',current_schema())) IS NOT NULL AS enabled",
      )
    ).rows[0]?.enabled;
    expect(state.workers[0]!.dueSchedules).toEqual(
      enabled ? { count: 0, moreAvailable: false } : null,
    );
  } finally {
    await pool.end();
  }
  const input = {
    requestId: randomUUID(),
    expectedVersion: 1,
    paused: true,
    confirm: true,
  };
  expect(
    (
      await request.post(`${base}/reports/control`, {
        headers: { Origin: 'https://unrelated.invalid' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/reports/control`, {
        headers,
        data: { ...input, unknown: true },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`${base}/reports/control`, {
        headers,
        data: { ...input, confirm: false },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`${base}/other/control`, { headers, data: input })
    ).status(),
  ).toBe(400);
  expect(
    (await request.get(`${base}/reports/history?unknown=true`)).status(),
  ).toBe(400);
  expect((await workerOverview(request)).workers[0]!.version).toBe(1);
});

test('E2E-API-351 immutable control replay remains historical after later resume and conflicts preserve state @WORKER-HEALTH-001', async ({
  request,
}) => {
  await loginWorkerOperator(request);
  const paused = await workerControl(request, 'reports', true, 1);
  await workerControl(request, 'reports', false, 2);
  expect(
    await workerControl(request, 'reports', true, 1, paused.requestId),
  ).toEqual(paused);
  const current = (await workerOverview(request)).workers[0]!;
  expect(current.version).toBe(3);
  expect(current.paused).toBe(false);
  for (const data of [
    {
      requestId: randomUUID(),
      expectedVersion: 1,
      paused: true,
      confirm: true,
    },
    {
      requestId: paused.requestId,
      expectedVersion: 3,
      paused: true,
      confirm: true,
    },
    {
      requestId: randomUUID(),
      expectedVersion: 3,
      paused: false,
      confirm: true,
    },
  ])
    expect(
      (
        await request.post(`${base}/reports/control`, { headers, data })
      ).status(),
    ).toBe(409);
  const history = WorkerControlHistorySchema.parse(
    await (await request.get(`${base}/reports/history`)).json(),
  );
  expect(history.receipts.map((r) => r.version)).toEqual([3, 2]);
  expect(JSON.stringify(history)).not.toMatch(
    /actor_hash|token|snapshot|username/,
  );
});

test('E2E-API-352 committed pause fences two real claimants restart and new work while existing leases finish once @WORKER-HEALTH-001', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await workerControl(request, 'reports', true, 1);
  await account(request);
  const first = await report(request);
  const one = await startWorker(feedbackSandbox),
    two = await startWorker(feedbackSandbox);
  try {
    expect(await one.run('claim')).toBe(false);
    expect(await two.run('claim')).toBe(false);
    await workerControl(request, 'reports', false, 2);
    expect(await one.run('claim')).toBe(true);
    expect(await two.run('claim')).toBe(false);
    await workerControl(request, 'reports', true, 3);
    const second = await report(request);
    expect(await two.run('work')).toBe(false);
    await one.run('finish');
    expect(
      ReportJobSchema.parse(
        await (await request.get(`/api/v1/account/reports/${first.id}`)).json(),
      ).status,
    ).toBe('succeeded');
    expect(
      ReportJobSchema.parse(
        await (
          await request.get(`/api/v1/account/reports/${second.id}`)
        ).json(),
      ).status,
    ).toBe('queued');
    const restarted = await startWorker(feedbackSandbox);
    try {
      expect(await restarted.run('claim')).toBe(false);
      await workerControl(request, 'reports', false, 4);
      expect(await restarted.run('work')).toBe(true);
      expect(await restarted.run('work')).toBe(false);
    } finally {
      await restarted.close();
    }
    const state = await workerOverview(request);
    expect(state.workers[0]!.lastSuccessAt).not.toBeNull();
    expect(JSON.stringify(state)).not.toContain(first.id);
    expect(JSON.stringify(state)).not.toContain('Synthetic private report');
  } finally {
    await one.close();
    await two.close();
  }
});

test('E2E-API-353 paused reminder batches preserve due records then concurrent real delivery remains unique @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await workerControl(request, 'reminders', true, 1);
  await account(request);
  const source = await seedConnectionSource(feedbackSandbox),
    pool = await workerDatabase(feedbackSandbox);
  const one = await startWorker(feedbackSandbox),
    two = await startWorker(feedbackSandbox);
  try {
    const response = await request.post('/api/v1/account/library/reminders', {
      headers,
      data: {
        itemId: source.id,
        dueAt: new Date(Date.now() + 3600000).toISOString(),
        timeZone: 'Asia/Kolkata',
        idempotencyKey: randomUUID(),
      },
    });
    expect(response.status()).toBe(201);
    const reminder = await response.json();
    await pool.query(
      "UPDATE library_reminders SET due_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
      [reminder.id],
    );
    await Promise.all([one.run('reminders'), two.run('reminders')]);
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM library_notifications',
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect((await workerOverview(request)).workers[1]!.due.count).toBe(1);
    await workerControl(request, 'reminders', false, 2);
    await Promise.all([one.run('reminders'), two.run('reminders')]);
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM library_notifications WHERE reminder_id=$1',
          [reminder.id],
        )
      ).rows[0]?.n,
    ).toBe(1);
    expect(
      (
        await pool.query('SELECT status FROM library_reminders WHERE id=$1', [
          reminder.id,
        ])
      ).rows[0]?.status,
    ).toBe('delivered');
    expect(
      (await workerOverview(request)).workers[1]!.lastSuccessAt,
    ).not.toBeNull();
  } finally {
    await one.close();
    await two.close();
    await pool.end();
  }
});

test('E2E-API-354 real storage failure records safe category stale observation and recovery without private errors @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  const worker = await startWorker(feedbackSandbox),
    pool = await workerDatabase(feedbackSandbox);
  let renamed = false;
  try {
    await worker.run('tick-report');
    expect((await workerOverview(request)).workers[0]!.freshness).toBe('fresh');
    await pool.query(
      'ALTER TABLE record_report_jobs RENAME TO worker_test_unavailable_jobs',
    );
    renamed = true;
    await worker.run('tick-report');
    const unavailable = await request.get(base);
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.text()).not.toContain(
      'worker_test_unavailable_jobs',
    );
    await pool.query(
      'ALTER TABLE worker_test_unavailable_jobs RENAME TO record_report_jobs',
    );
    renamed = false;
    await pool.query(
      "UPDATE worker_observations SET heartbeat_at=clock_timestamp()-interval '31 seconds' WHERE worker='reports'",
    );
    const stale = (await workerOverview(request)).workers[0]!;
    expect(stale.freshness).toBe('stale');
    expect(stale.failureCategory).toBe('storage');
    expect(stale.lastFailureAt).not.toBeNull();
    await worker.run('tick-report');
    expect((await workerOverview(request)).workers[0]!.freshness).toBe('fresh');
  } finally {
    if (renamed)
      await pool.query(
        'ALTER TABLE worker_test_unavailable_jobs RENAME TO record_report_jobs',
      );
    await worker.close();
    await pool.end();
  }
});

test('E2E-API-355 actual expired report lease is visible and reclaimed without late-worker overwrite @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await account(request);
  const job = await report(request);
  const pool = await workerDatabase(feedbackSandbox),
    one = await startWorker(feedbackSandbox),
    two = await startWorker(feedbackSandbox);
  try {
    expect(await one.run('claim')).toBe(true);
    expect(
      (await workerOverview(request)).workers[0]!.activeLeases?.count,
    ).toBe(1);
    await pool.query(
      "UPDATE record_report_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [job.id],
    );
    const expired = (await workerOverview(request)).workers[0]!;
    expect(expired.expiredLeases?.count).toBe(1);
    expect(expired.due.count).toBe(1);
    expect(await two.run('work')).toBe(true);
    const before = await (
      await request.get(`/api/v1/account/reports/${job.id}/download`)
    ).json();
    await one.run('finish');
    expect(
      await (
        await request.get(`/api/v1/account/reports/${job.id}/download`)
      ).json(),
    ).toEqual(before);
    expect(
      (
        await pool.query(
          'SELECT attempts FROM record_report_jobs WHERE id=$1',
          [job.id],
        )
      ).rows[0]?.attempts,
    ).toBe(2);
  } finally {
    await one.close();
    await two.close();
    await pool.end();
  }
});

test('E2E-API-356 operator expiring during observed admission-lock wait cannot commit a control @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  const pool = await workerDatabase(feedbackSandbox),
    blocker = await workerBlock(feedbackSandbox);
  let response: Promise<import('@playwright/test').APIResponse> | undefined;
  try {
    response = request.post(`${base}/reports/control`, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        paused: true,
        confirm: true,
      },
    });
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'SELECT count(*)::integer AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
              [blocker.pid],
            )
          ).rows[0]?.n,
      )
      .toBe(1);
    await pool.query(
      'UPDATE operator_sessions SET expires_at=clock_timestamp()',
    );
    await blocker.release();
    expect((await response).status()).toBe(401);
    expect(
      (
        await pool.query(
          "SELECT version,paused FROM worker_controls WHERE worker='reports'",
        )
      ).rows,
    ).toEqual([{ version: 1, paused: false }]);
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM worker_control_receipts',
        )
      ).rows[0]?.n,
    ).toBe(0);
  } finally {
    await blocker.release();
    await response?.catch(() => undefined);
    await pool.end();
  }
});

test('E2E-API-357 audit failure rolls back worker control and same request safely retries @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  const pool = await workerDatabase(feedbackSandbox),
    id = randomUUID();
  try {
    await pool.query(
      "CREATE FUNCTION worker_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER worker_test_reject BEFORE INSERT ON worker_control_receipts FOR EACH ROW EXECUTE FUNCTION worker_test_reject()',
    );
    expect(
      (
        await request.post(`${base}/reports/control`, {
          headers,
          data: {
            requestId: id,
            expectedVersion: 1,
            paused: true,
            confirm: true,
          },
        })
      ).status(),
    ).toBe(503);
    expect((await workerOverview(request)).workers[0]!.version).toBe(1);
    await pool.query(
      'DROP TRIGGER worker_test_reject ON worker_control_receipts',
    );
    const saved = await workerControl(request, 'reports', true, 1, id);
    expect(await workerControl(request, 'reports', true, 1, id)).toEqual(saved);
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM worker_control_receipts',
        )
      ).rows[0]?.n,
    ).toBe(1);
  } finally {
    await pool.end();
  }
});

test('E2E-API-358 capped queue counts and bounded receipt eviction never resurrect old controls @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  const old = await workerControl(request, 'reports', true, 1);
  await account(request);
  const job = await report(request);
  const pool = await workerDatabase(feedbackSandbox);
  try {
    // Explicit load fixture copies one actual accepted snapshot only inside the
    // owned database; these rows are not invented user or provider successes.
    await pool.query(
      "INSERT INTO record_report_jobs(id,user_id,label,snapshot,requested_at,next_attempt_at) SELECT gen_random_uuid(),j.user_id,'Synthetic aggregate load',j.snapshot,clock_timestamp()-interval '2 hours',clock_timestamp()+interval '1 day' FROM record_report_jobs j CROSS JOIN generate_series(1,10000) n WHERE j.id=$1",
      [job.id],
    );
    const state = (await workerOverview(request)).workers[0]!;
    expect(state.queued).toEqual({ count: 10000, moreAvailable: true });
    expect(state.due).toEqual({ count: 1, moreAvailable: false });
    expect(state.oldestOutstandingAgeSeconds).toBeGreaterThanOrEqual(7200);
    await pool.query(
      "INSERT INTO worker_control_receipts(request_id,worker,version,paused,actor_hash,expected_version) SELECT gen_random_uuid(),'reports',n,(n%2=0),s.token_hash,n-1 FROM generate_series(3,1001) n CROSS JOIN (SELECT token_hash FROM operator_sessions LIMIT 1) s",
    );
    await pool.query(
      "UPDATE worker_controls SET version=1001,paused=false WHERE worker='reports'",
    );
    await workerControl(request, 'reports', true, 1001);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS n FROM worker_control_receipts WHERE worker='reports'",
        )
      ).rows[0]?.n,
    ).toBe(1000);
    const historyResponse = await request.get(`${base}/reports/history`);
    expect(historyResponse.status(), await historyResponse.text()).toBe(200);
    const history = WorkerControlHistorySchema.parse(
      await historyResponse.json(),
    );
    expect(history.moreAvailable).toBe(true);
    expect(history.receipts).toHaveLength(100);
    expect(history.receipts[0]?.version).toBe(1002);
    const older = WorkerControlHistorySchema.parse(
      await (
        await request.get(
          `${base}/reports/history?before=${history.receipts.at(-1)!.version}`,
        )
      ).json(),
    );
    expect(older.receipts[0]!.version).toBe(
      history.receipts.at(-1)!.version - 1,
    );
    expect(
      (
        await request.post(`${base}/reports/control`, {
          headers,
          data: {
            requestId: old.requestId,
            expectedVersion: 1,
            paused: true,
            confirm: true,
          },
        })
      ).status(),
    ).toBe(409);
    expect((await workerOverview(request)).workers[0]!.version).toBe(1002);
  } finally {
    await pool.end();
  }
});

test('E2E-API-359 actual preparation failure retains bounded category then original valid snapshot succeeds @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await account(request);
  const job = await report(request);
  const pool = await workerDatabase(feedbackSandbox),
    worker = await startWorker(feedbackSandbox);
  try {
    const original = (
      await pool.query('SELECT snapshot FROM record_report_jobs WHERE id=$1', [
        job.id,
      ])
    ).rows[0]!.snapshot;
    await pool.query(
      "UPDATE record_report_jobs SET snapshot='{}'::jsonb WHERE id=$1",
      [job.id],
    );
    expect(await worker.run('work')).toBe(true);
    const failed = (await workerOverview(request)).workers[0]!;
    expect(failed.failureCategory).toBe('preparation');
    expect(failed.lastSuccessAt).toBeNull();
    await pool.query(
      'UPDATE record_report_jobs SET snapshot=$2,next_attempt_at=clock_timestamp() WHERE id=$1',
      [job.id, original],
    );
    expect(await worker.run('work')).toBe(true);
    expect(
      (await workerOverview(request)).workers[0]!.lastSuccessAt,
    ).not.toBeNull();
    expect(
      ReportJobSchema.parse(
        await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
      ).status,
    ).toBe('succeeded');
  } finally {
    await worker.close();
    await pool.end();
  }
});

test('E2E-API-360 actual report finish storage failure is distinguished from preparation and safely retried @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await account(request);
  const job = await report(request);
  const pool = await workerDatabase(feedbackSandbox),
    worker = await startWorker(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION worker_test_report_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic report-write storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER worker_test_report_write BEFORE INSERT ON record_reports FOR EACH ROW EXECUTE FUNCTION worker_test_report_write()',
    );
    expect(await worker.run('work')).toBe(true);
    const failed = (await workerOverview(request)).workers[0]!;
    expect(failed.failureCategory).toBe('storage');
    expect(failed.lastSuccessAt).toBeNull();
    expect(
      (await pool.query('SELECT count(*)::integer AS n FROM record_reports'))
        .rows[0]?.n,
    ).toBe(0);
    await pool.query('DROP TRIGGER worker_test_report_write ON record_reports');
    await pool.query(
      'UPDATE record_report_jobs SET next_attempt_at=clock_timestamp() WHERE id=$1',
      [job.id],
    );
    expect(await worker.run('work')).toBe(true);
    expect(
      (await workerOverview(request)).workers[0]!.lastSuccessAt,
    ).not.toBeNull();
    expect(
      ReportJobSchema.parse(
        await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
      ).status,
    ).toBe('succeeded');
  } finally {
    await worker.close();
    await pool.end();
  }
});

test('E2E-API-361 pause and resume preserve exact owned financial revisions queued snapshots and source evidence @WORKER-HEALTH-001', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await prepareConnectionAccount(request);
  await report(request);
  await seedConnectionSource(feedbackSandbox);
  const pool = await workerDatabase(feedbackSandbox);
  const digest = async () =>
    (
      await pool.query(
        'SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id,version) FROM app_holdings_revisions t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY goal_id,version) FROM app_goal_revisions t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM record_report_jobs t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY item_id,version) FROM discovery_versions t))::text) AS digest',
      )
    ).rows[0]?.digest;
  try {
    const before = await digest();
    for (const worker of ['reports', 'reminders'] as const) {
      await workerControl(request, worker, true, 1);
      await workerControl(request, worker, false, 2);
    }
    expect(await digest()).toBe(before);
  } finally {
    await pool.end();
  }
});

test('E2E-API-362 lease expiring during actual finish row-lock wait cannot issue until a fresh claimant recovers @WORKER-HEALTH-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  await account(request);
  const job = await report(request);
  const pool = await workerDatabase(feedbackSandbox),
    one = await startWorker(feedbackSandbox),
    two = await startWorker(feedbackSandbox);
  let blocker: Awaited<ReturnType<typeof workerBlock>> | undefined;
  let finishing: Promise<boolean> | undefined;
  try {
    expect(await one.run('claim')).toBe(true);
    blocker = await workerBlock(feedbackSandbox, job.id);
    finishing = one.run('finish');
    let waiterPid = 0;
    await expect
      .poll(async () => {
        const waiting = await pool.query(
          'SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
          [blocker!.pid],
        );
        waiterPid = Number(waiting.rows[0]?.pid ?? 0);
        return waiterPid;
      })
      .toBeGreaterThan(0);
    // This is after the waiting transaction's now(), but before wall-clock time.
    // It exposes a transaction-start expiry check without sleeping or fake output.
    await blocker.expireLease(waiterPid);
    await blocker.release(true);
    await finishing;
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM record_reports WHERE job_id=$1',
          [job.id],
        )
      ).rows[0]?.n,
    ).toBe(0);
    const stale = (await workerOverview(request)).workers[0]!;
    expect(stale.expiredLeases?.count).toBe(1);
    expect(stale.lastSuccessAt).toBeNull();
    expect(await two.run('work')).toBe(true);
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM record_reports WHERE job_id=$1',
          [job.id],
        )
      ).rows[0]?.n,
    ).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT attempts FROM record_report_jobs WHERE id=$1',
          [job.id],
        )
      ).rows[0]?.attempts,
    ).toBe(2);
    expect(
      (await workerOverview(request)).workers[0]!.lastSuccessAt,
    ).not.toBeNull();
  } finally {
    await blocker?.release();
    await finishing?.catch(() => undefined);
    await one.close();
    await two.close();
    await pool.end();
  }
});
