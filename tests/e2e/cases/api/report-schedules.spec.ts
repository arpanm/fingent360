import { setSyntheticScheduleDue } from '../../helpers/private-schedule-fixture';
import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  connectionDatabase,
  prepareConnectionAccount,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import {
  ReportSchedulesSchema,
  ScheduleReceiptSchema,
  PrivacyExportSchema,
  ReportJobSchema,
} from '../../../../packages/contracts/src/index';
const base = '/api/v1/account/report-schedules';
const config = {
  label: 'Synthetic recurring records',
  frequency: 'daily',
  time: '09:00',
  timezone: 'Asia/Kolkata',
  weekday: 1,
  policy: 'saved-record-review-v1',
};
function work(sandbox: { databaseUrl: string; schema: string }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL('../../helpers/schedule-work-process.mjs', import.meta.url),
        ),
      ],
      { stdio: ['pipe', 'ignore', 'ignore'] },
    );
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Owned schedule worker timed out.'));
    }, 15000);
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('Owned schedule worker failed.'));
    });
    child.stdin.end(JSON.stringify(sandbox));
  });
}
test('E2E-API-330 opted-in editions replay pause resume ownership and account export @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID(),
    input = {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config,
      consent: true,
    };
  const saved = await request.post(`${base}/${id}`, { headers, data: input });
  expect(saved.status()).toBe(201);
  const receipt = ScheduleReceiptSchema.parse(await saved.json());
  expect(Date.parse(receipt.schedule.nextDueAt!)).toBeGreaterThan(Date.now());
  expect(
    await (
      await request.post(`${base}/${id}`, { headers, data: input })
    ).json(),
  ).toEqual(receipt);
  expect(
    (
      await request.post(`${base}/${id}`, {
        headers,
        data: { ...input, config: { ...config, label: 'Different' } },
      })
    ).status(),
  ).toBe(409);
  const pause = await request.post(`${base}/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: 'pause',
      consent: true,
    },
  });
  expect(pause.status()).toBe(201);
  expect(
    ScheduleReceiptSchema.parse(await pause.json()).schedule.nextDueAt,
  ).toBeNull();
  expect(
    (
      await request.post(`${base}/${id}`, {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          action: 'resume',
          consent: true,
        },
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
        await stranger.post(`${base}/${id}`, {
          headers,
          data: { ...input, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await stranger.dispose();
  }
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.reportSchedules.editions).toHaveLength(2);
  expect(exported.reportSchedules.receipts).toHaveLength(2);
  const scheduleConsent = exported.consents.current.purposes.find(
    (value) => value.record.purpose === 'scheduled-record-reviews',
  );
  expect(scheduleConsent?.status).toBe('active');
  expect(scheduleConsent?.record.basis?.kind).toBe('schedule-opt-in');
  expect(
    exported.consents.history.events.filter(
      (value) => value.receipt.state.purpose === 'scheduled-record-reviews',
    ),
  ).toHaveLength(1);
});
test('E2E-API-331 concurrent actual workers capture latest due once and preserve deleted report tombstone @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.post(`${base}/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config,
      consent: true,
    },
  });
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const due = new Date(Date.now() - 3 * 86400000).toISOString();
    await setSyntheticScheduleDue(pool, feedbackSandbox, id, due);
    await Promise.all([work(feedbackSandbox), work(feedbackSandbox)]);
    const current = ReportSchedulesSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(current.occurrences).toHaveLength(1);
    const occurrence = current.occurrences[0]!;
    expect(occurrence.skipped).toBeGreaterThanOrEqual(2);
    expect(occurrence.status).toBe('queued');
    const job = ReportJobSchema.parse(
      await (
        await request.get(`/api/v1/account/reports/${occurrence.reportId}`)
      ).json(),
    );
    expect(job.snapshot.holdings.totalCostMinor).toBe('10000');
    expect(job.snapshot.capturedAt).toBe(occurrence.capturedAt);
    expect(Date.parse(job.snapshot.capturedAt)).toBeGreaterThan(
      Date.parse(occurrence.dueAt),
    );
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${job.id}`)
            ).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('succeeded');
    const issued = ReportJobSchema.parse(
      await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
    );
    expect(
      (
        await request.delete(`/api/v1/account/reports/${job.id}`, {
          headers,
          data: { expectedVersion: issued.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    await work(feedbackSandbox);
    expect(
      ReportSchedulesSchema.parse(await (await request.get(base)).json())
        .occurrences,
    ).toHaveLength(1);
    expect(
      (await request.get(`/api/v1/account/reports/${job.id}`)).status(),
    ).toBe(404);
  } finally {
    await pool.end();
  }
});
test('E2E-API-332 full report budget records capacity outcome without snapshot or catch-up retry @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.post(`${base}/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config,
      consent: true,
    },
  });
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      'INSERT INTO record_report_request_limits(user_id,window_start,used) VALUES($1,clock_timestamp(),100)',
      [owner],
    );
    const due = new Date(Date.now() - 86400000).toISOString();
    await setSyntheticScheduleDue(pool, feedbackSandbox, id, due);
    await work(feedbackSandbox);
    const current = ReportSchedulesSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(current.occurrences[0]?.status).toBe('capacity');
    expect(current.occurrences[0]?.reportId).toBeNull();
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM record_report_jobs WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    await work(feedbackSandbox);
    expect(
      ReportSchedulesSchema.parse(await (await request.get(base)).json())
        .occurrences,
    ).toHaveLength(1);
    await pool.query(
      "UPDATE record_report_request_limits SET window_start=clock_timestamp()-interval '2 hours' WHERE user_id=$1",
      [owner],
    );
    expect(
      (
        await request.post(`${base}/${id}`, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            action: 'save',
            config: { ...config, label: 'Synthetic recovered capacity' },
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    await setSyntheticScheduleDue(
      pool,
      feedbackSandbox,
      id,
      new Date(Date.now() - 3 * 86400000).toISOString(),
    );
    await work(feedbackSandbox);
    const recovered = ReportSchedulesSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(recovered.occurrences).toHaveLength(2);
    expect(recovered.occurrences.some((o) => o.status === 'queued')).toBe(true);
  } finally {
    await pool.end();
  }
});
test('E2E-API-333 expired session after account-lock wait cannot edit a schedule @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.post(`${base}/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config,
      consent: true,
    },
  });
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const pool = await connectionDatabase(feedbackSandbox),
    blocker = await pool.connect();
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    await blocker.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
      owner,
    ]);
    pending = request.post(`${base}/${id}`, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        action: 'pause',
        consent: true,
      },
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
      .toBeGreaterThan(0);
    await blocker.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [owner],
    );
    await blocker.query('COMMIT');
    const result = await pending;
    expect(result.status()).toBe(401);
    await result.body();
    expect(
      (
        await blocker.query(
          'SELECT version,status FROM report_schedules WHERE id=$1',
          [id],
        )
      ).rows[0],
    ).toEqual({ version: 1, status: 'active' });
    expect(
      Number(
        (
          await blocker.query(
            'SELECT count(*) FROM report_schedule_editions WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    if (pending) await pending.catch(() => undefined);
    await pool.end();
  }
});
test('E2E-API-334 thousand-occurrence history continues generation pause and complete bounded export @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.post(`${base}/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config,
      consent: true,
    },
  });
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const history = Array.from({ length: 1000 }, (_, i) => {
      const at = new Date(Date.UTC(2020, 0, 1 + i)).toISOString();
      return {
        id: randomUUID(),
        scheduleId: id,
        scheduleVersion: 1,
        dueAt: at,
        capturedAt: at,
        skipped: 0,
        status: 'capacity',
        reportId: null,
        message: 'Synthetic historical capacity fixture.',
      };
    });
    await pool.query(
      `INSERT INTO report_schedule_occurrences(id,schedule_id,user_id,schedule_version,due_at,payload) SELECT (r->>'id')::uuid,$1,$2,1,(r->>'dueAt')::timestamptz,r FROM jsonb_array_elements($3::jsonb) r`,
      [id, owner, JSON.stringify(history)],
    );
    const due = new Date(Date.now() - 86400000).toISOString();
    await setSyntheticScheduleDue(pool, feedbackSandbox, id, due);
    await work(feedbackSandbox);
    const list = ReportSchedulesSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(list.occurrences).toHaveLength(100);
    expect(list.schedules[0]?.status).toBe('active');
    expect(
      (
        await request.post(`${base}/${id}`, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            action: 'pause',
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    let next: Record<string, number> | null = {},
      count = 0,
      pages = 0;
    while (next) {
      const page = await (
        await request.get(`${base}/export`, { params: next })
      ).json();
      expect(page.ownerId).toBe(owner);
      expect(page.occurrences.length).toBeLessThanOrEqual(100);
      count += page.occurrences.length;
      next = page.next;
      pages++;
      expect(pages).toBeLessThan(20);
    }
    expect(count).toBe(1001);
    expect(
      (
        await request.post(`${base}/${id}`, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 2,
            action: 'delete',
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
  } finally {
    await pool.end();
  }
});
test('E2E-API-335 edition history beyond one page still permits edit pause resume and immutable replay @REPORT-SCHEDULES-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  const first = ScheduleReceiptSchema.parse(
    await (
      await request.post(`${base}/${id}`, {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: 'save',
          config,
          consent: true,
        },
      })
    ).json(),
  );
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account.id;
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const editions = Array.from({ length: 100 }, (_, i) => ({
      ...first.schedule,
      version: i + 2,
      config: { ...config, label: `Synthetic edition ${i + 2}` },
    }));
    await pool.query(
      `INSERT INTO report_schedule_editions(schedule_id,user_id,version,payload) SELECT $1,$2,(r->>'version')::int,r FROM jsonb_array_elements($3::jsonb) r`,
      [id, owner, JSON.stringify(editions)],
    );
    await pool.query(
      'UPDATE report_schedules SET version=101,payload=$2,encrypted_payload=NULL,content_hash=NULL WHERE id=$1',
      [id, editions.at(-1)],
    );
    const input = {
      requestId: randomUUID(),
      expectedVersion: 101,
      action: 'pause',
      consent: true,
    };
    const paused = await request.post(`${base}/${id}`, {
      headers,
      data: input,
    });
    expect(paused.status()).toBe(201);
    const receipt = await paused.json();
    expect(
      (
        await request.post(`${base}/${id}`, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 102,
            action: 'resume',
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      await (
        await request.post(`${base}/${id}`, { headers, data: input })
      ).json(),
    ).toEqual(receipt);
    expect(
      ReportSchedulesSchema.parse(await (await request.get(base)).json())
        .schedules[0]?.status,
    ).toBe('active');
    const page = await (await request.get(`${base}/export`)).json();
    expect(page.editions).toHaveLength(100);
    const rest = await (
      await request.get(`${base}/export`, { params: page.next })
    ).json();
    expect(rest.editions).toHaveLength(3);
    expect(rest.next).toBeNull();
  } finally {
    await pool.end();
  }
});
