import { test, expect } from '../../helpers/app-fixture';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  ReportJobSchema,
  ReportJobsSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-report-deletion-2026';
type DatabaseClient = {
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};
const pg = createRequire(
  new URL('../../../../apps/api/package.json', import.meta.url),
)('pg') as {
  Pool: new (options: { connectionString: string; max: number }) => {
    query: DatabaseClient['query'];
    connect: () => Promise<DatabaseClient>;
    end: () => Promise<void>;
  };
};

test('E2E-API-224 owned deletion scrubs bytes reclaims capacity and blocks replay @REPORTS-002', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `del_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const goalResponse = await request.post('/api/v1/account/goals', {
    headers,
    data: {
      name: 'Synthetic retained goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '10001',
      monthlyMinor: '25002',
      horizonMonths: 3,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    },
  });
  expect(goalResponse.status()).toBe(201);
  const goal = await goalResponse.json();
  const previewResponse = await request.post(
    '/api/v1/account/holdings/preview',
    {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    },
  );
  expect(previewResponse.status()).toBe(201);
  const preview = await previewResponse.json();
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: preview.previewId, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: {
          expectedVersion: 0,
          expectedHoldingsVersion: 1,
          storageConsent: true,
          rows: [
            {
              goalId: goal.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1',
            },
          ],
        },
      })
    ).status(),
  ).toBe(200);
  const allocationsBefore = await (
    await request.get('/api/v1/account/allocations')
  ).json();
  const goalsBefore = await (await request.get('/api/v1/account/goals')).json();
  const holdingsBefore = await (
    await request.get('/api/v1/account/holdings')
  ).json();
  const input = {
    requestId: randomUUID(),
    label: 'Synthetic private label',
    consent: true,
  };
  await request.post('/api/v1/account/reports', { headers, data: input });
  await expect
    .poll(
      async () =>
        ReportJobSchema.parse(
          await (
            await request.get(`/api/v1/account/reports/${input.requestId}`)
          ).json(),
        ).status,
    )
    .toBe('succeeded');
  const job = ReportJobSchema.parse(
    await (
      await request.get(`/api/v1/account/reports/${input.requestId}`)
    ).json(),
  );
  const body = { expectedVersion: job.version, confirm: true };
  expect(
    (
      await request.delete(`/api/v1/account/reports/${job.id}`, {
        headers,
        data: { ...body, expectedVersion: job.version + 1 },
      })
    ).status(),
  ).toBe(409);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await other.post('/api/v1/account/register', {
      headers,
      data: {
        username: `other_${randomUUID().slice(0, 12)}`,
        password,
        consent: true,
      },
    });
    expect(
      (
        await other.delete(`/api/v1/account/reports/${job.id}`, {
          headers,
          data: body,
        })
      ).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect(
    (
      await request.delete(`/api/v1/account/reports/${job.id}`, {
        headers: { Origin: 'https://untrusted.example' },
        data: body,
      })
    ).status(),
  ).toBe(403);
  const deleted = await request.delete(`/api/v1/account/reports/${job.id}`, {
    headers,
    data: body,
  });
  expect(deleted.status()).toBe(200);
  expect(
    await (
      await request.delete(`/api/v1/account/reports/${job.id}`, {
        headers,
        data: body,
      })
    ).json(),
  ).toEqual(await deleted.json());
  expect(
    (
      await request.post('/api/v1/account/reports', { headers, data: input })
    ).status(),
  ).toBe(410);
  expect(
    (await request.get(`/api/v1/account/reports/${job.id}/download`)).status(),
  ).toBe(404);
  const list = ReportJobsSchema.parse(
    await (await request.get('/api/v1/account/reports')).json(),
  );
  expect(list.capacity.used).toBe(0);
  expect(list.deletions).toHaveLength(0);
  const exported = await (
    await request.get('/api/v1/account/privacy/export')
  ).json();
  expect(exported.reports.deletions).toEqual([await deleted.json()]);
  expect(JSON.stringify(exported.reports)).not.toContain(input.label);
  expect(await (await request.get('/api/v1/account/goals')).json()).toEqual(
    goalsBefore,
  );
  expect(await (await request.get('/api/v1/account/holdings')).json()).toEqual(
    holdingsBefore,
  );
  expect(
    await (await request.get('/api/v1/account/allocations')).json(),
  ).toEqual(allocationsBefore);
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 2,
  });
  try {
    expect(
      (
        await pool.query('SELECT * FROM record_report_jobs WHERE id=$1', [
          job.id,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query('SELECT * FROM record_reports WHERE job_id=$1', [
          job.id,
        ])
      ).rows,
    ).toEqual([]);
    await request.delete('/api/v1/account', { headers, data: { password } });
    expect(
      (
        await pool.query('SELECT * FROM record_report_deletions WHERE id=$1', [
          job.id,
        ])
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
});
test('E2E-API-225 cancellation and concurrent delete prevent late worker publication @REPORTS-002', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `del_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const job = ReportJobSchema.parse(
    await (
      await request.post('/api/v1/account/reports', {
        headers,
        data: {
          requestId: randomUUID(),
          label: 'Synthetic running',
          consent: true,
        },
      })
    ).json(),
  );
  const lease = randomUUID();
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 2,
  });
  try {
    await pool.query(
      "UPDATE record_report_jobs SET status='running',lease_id=$2,lease_until=now()+interval '5 minutes' WHERE id=$1",
      [job.id, lease],
    );
    expect(
      (
        await request.delete(`/api/v1/account/reports/${job.id}`, {
          headers,
          data: { expectedVersion: job.version, confirm: true },
        })
      ).status(),
    ).toBe(409);
    const cancelled = ReportJobSchema.parse(
      await (
        await request.post(`/api/v1/account/reports/${job.id}/cancel`, {
          headers,
          data: { expectedVersion: job.version },
        })
      ).json(),
    );
    const responses = await Promise.all(
      [1, 2].map(() =>
        request.delete(`/api/v1/account/reports/${job.id}`, {
          headers,
          data: { expectedVersion: cancelled.version, confirm: true },
        }),
      ),
    );
    expect(responses.map((r) => r.status())).toEqual([200, 200]);
    const { issueRecordReport } =
      await import('../../../../packages/contracts/src/index');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL('../../helpers/report-finish-process.mjs', import.meta.url),
          ),
        ],
        { stdio: ['pipe', 'ignore', 'ignore'] },
      );
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(Error('Owned late-finish fixture timed out'));
      }, 10000);
      child.once('error', () => {
        clearTimeout(timer);
        reject(Error('Could not start late-finish fixture'));
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(Error('Actual late-finish method failed in owned fixture'));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(
        JSON.stringify({
          databaseUrl: feedbackSandbox.databaseUrl,
          schema: feedbackSandbox.schema,
          id: job.id,
          lease,
          report: issueRecordReport(
            job.id,
            job.label,
            job.snapshot,
            new Date().toISOString(),
          ),
        }),
      );
    });
    expect(
      (
        await pool.query(
          "SELECT id FROM record_report_jobs WHERE id=$1 AND status='running' FOR UPDATE",
          [job.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query('SELECT * FROM record_reports WHERE job_id=$1', [
          job.id,
        ])
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
});
test('E2E-API-226 exhausted new-request budget does not block deletion or retries @REPORTS-002', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `del_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const input = {
    requestId: randomUUID(),
    label: 'Synthetic budget',
    consent: true,
  };
  const job = ReportJobSchema.parse(
    await (
      await request.post('/api/v1/account/reports', { headers, data: input })
    ).json(),
  );
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 2,
  });
  try {
    await pool.query(
      'UPDATE record_report_request_limits SET used=100 WHERE user_id=(SELECT user_id FROM record_report_jobs WHERE id=$1)',
      [job.id],
    );
    expect(
      (
        await request.post('/api/v1/account/reports', {
          headers,
          data: { ...input, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(429);
    expect(
      (
        await request.post('/api/v1/account/reports', { headers, data: input })
      ).status(),
    ).toBe(201);
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${job.id}`)
            ).json(),
          ).status,
      )
      .toBe('succeeded');
    const ready = ReportJobSchema.parse(
      await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
    );
    expect(
      (
        await request.delete(`/api/v1/account/reports/${job.id}`, {
          headers,
          data: { expectedVersion: ready.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    const tomb = await pool.query(
      'SELECT user_id FROM record_report_deletions WHERE id=$1',
      [job.id],
    );
    expect(tomb.rows).toHaveLength(1);
    const owner = tomb.rows[0]!.user_id;
    for (let n = 0; n < 100; n++)
      await pool.query(
        "INSERT INTO record_report_jobs(id,user_id,label,snapshot,status,next_attempt_at) VALUES($1,$2,'Synthetic capacity fixture',$3,'cancelled',NULL)",
        [randomUUID(), owner, JSON.stringify(job.snapshot)],
      );
    expect(
      ReportJobsSchema.parse(
        await (await request.get('/api/v1/account/reports')).json(),
      ).capacity.used,
    ).toBe(100);
    await pool.query(
      "UPDATE record_report_request_limits SET window_start=now()-interval '2 hours' WHERE user_id=$1",
      [owner],
    );
    expect(
      (
        await request.post('/api/v1/account/reports', {
          headers,
          data: { ...input, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
    const item = ReportJobsSchema.parse(
      await (await request.get('/api/v1/account/reports')).json(),
    ).jobs[0]!;
    expect(
      (
        await request.delete(`/api/v1/account/reports/${item.id}`, {
          headers,
          data: { expectedVersion: item.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      ReportJobsSchema.parse(
        await (await request.get('/api/v1/account/reports')).json(),
      ).capacity.used,
    ).toBe(99);
    expect(
      (
        await request.post('/api/v1/account/reports', {
          headers,
          data: { ...input, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
  } finally {
    await pool.end();
  }
});
