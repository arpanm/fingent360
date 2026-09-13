import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  ReportJobSchema,
  RecordReportSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test('E2E-API-220 immutable owned report request, issue, retry identity and download @REPORTS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `report_${randomUUID().slice(0, 12)}`,
      password: 'Synthetic-report-2026',
      consent: true,
    },
  });
  const input = {
    requestId: randomUUID(),
    label: 'Synthetic saved-record review',
    consent: true,
  };
  const first = await request.post('/api/v1/account/reports', {
    headers,
    data: input,
  });
  expect(first.status()).toBe(201);
  const job = ReportJobSchema.parse(await first.json());
  expect(
    (
      await request.post('/api/v1/account/reports', {
        headers,
        data: { ...input, label: 'Changed' },
      })
    ).status(),
  ).toBe(409);
  const replay = ReportJobSchema.parse(
    await (
      await request.post('/api/v1/account/reports', { headers, data: input })
    ).json(),
  );
  expect(replay.snapshot).toEqual(job.snapshot);
  await expect
    .poll(
      async () =>
        ReportJobSchema.parse(
          await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
        ).status,
      { timeout: 15000 },
    )
    .toBe('succeeded');
  const report = RecordReportSchema.parse(
    await (
      await request.get(`/api/v1/account/reports/${job.id}/download`)
    ).json(),
  );
  expect(report.snapshot).toEqual(job.snapshot);
  expect(report.recordedHoldingsCostMinor).toBe('0');
  expect(report.caveats.join(' ')).toContain('not their market value');
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await other.post('/api/v1/account/register', {
      headers,
      data: {
        username: `other_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-report-2026',
        consent: true,
      },
    });
    expect(
      (await other.get(`/api/v1/account/reports/${job.id}`)).status(),
    ).toBe(404);
    expect(
      (await other.get(`/api/v1/account/reports/${job.id}/download`)).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect(
    (
      await request.post(`/api/v1/account/reports/${job.id}/cancel`, {
        headers,
        data: { expectedVersion: replay.version },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-221 report consent and unknown fields rejected without jobs @REPORTS-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `report_${randomUUID().slice(0, 12)}`,
      password: 'Synthetic-report-2026',
      consent: true,
    },
  });
  const body = { requestId: randomUUID(), label: 'Synthetic', consent: false };
  expect(
    (
      await request.post('/api/v1/account/reports', { headers, data: body })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/v1/account/reports', {
        headers,
        data: { ...body, consent: true, ownerId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await (await request.get('/api/v1/account/reports')).json()).jobs,
  ).toEqual([]);
});
test('E2E-API-222 expired leases recover and cancellation fences late issuance @REPORTS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const pg = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: { connectionString: string; max: number }) => {
      query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
      end: () => Promise<void>;
    };
  };
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    await request.post('/api/v1/account/register', {
      headers,
      data: {
        username: `report_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-report-2026',
        consent: true,
      },
    });
    const create = async () =>
      ReportJobSchema.parse(
        await (
          await request.post('/api/v1/account/reports', {
            headers,
            data: {
              requestId: randomUUID(),
              label: 'Synthetic crash recovery',
              consent: true,
            },
          })
        ).json(),
      );
    const recover = await create();
    await pool.query(
      "UPDATE record_report_jobs SET status='running', attempts=1, lease_id=$2,lease_until=now()-interval '1 second' WHERE id=$1",
      [recover.id, randomUUID()],
    );
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${recover.id}`)
            ).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('succeeded');
    const cancelled = await create();
    await pool.query(
      "UPDATE record_report_jobs SET status='running',lease_id=$2,lease_until=now()+interval '5 minutes',attempts=1 WHERE id=$1",
      [cancelled.id, randomUUID()],
    );
    const before = ReportJobSchema.parse(
      await (
        await request.get(`/api/v1/account/reports/${cancelled.id}`)
      ).json(),
    );
    expect(
      (
        await request.post(`/api/v1/account/reports/${cancelled.id}/cancel`, {
          headers,
          data: { expectedVersion: before.version },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.get(`/api/v1/account/reports/${cancelled.id}/download`)
      ).status(),
    ).toBe(409);
    expect(
      (
        await pool.query('SELECT * FROM record_reports WHERE job_id=$1', [
          cancelled.id,
        ])
      ).rows,
    ).toHaveLength(0);
    const exhausted = await create();
    await pool.query(
      "UPDATE record_report_jobs SET status='running', attempts=3,lease_id=$2,lease_until=now()-interval '1 second' WHERE id=$1",
      [exhausted.id, randomUUID()],
    );
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${exhausted.id}`)
            ).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('failed');
    const failed = ReportJobSchema.parse(
      await (
        await request.get(`/api/v1/account/reports/${exhausted.id}`)
      ).json(),
    );
    expect(
      (
        await request.post(`/api/v1/account/reports/${failed.id}/retry`, {
          headers,
          data: { expectedVersion: failed.version },
        })
      ).status(),
    ).toBe(201);
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (
              await request.get(`/api/v1/account/reports/${failed.id}`)
            ).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('succeeded');
  } finally {
    await pool.end();
  }
});
