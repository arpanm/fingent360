import { createRequire } from 'node:module';
import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  ReportJobSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test('E2E-API-223 populated report preserves exact records, allocation review, privacy and ownership @REPORTS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const password = 'Synthetic-report-2026';
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `report_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const goal = {
    name: 'Synthetic populated goal',
    type: 'education',
    targetMinor: '100000',
    savedMinor: '10001',
    monthlyMinor: '25002',
    horizonMonths: 3,
    currency: 'INR',
    scale: 2,
    assumptions: 'no-growth-nominal-v1',
    storageConsent: true,
  };
  const g = await (
    await request.post('/api/v1/account/goals', { headers, data: goal })
  ).json();
  const hold = async (version: number, cost: string) => {
    const p = await (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: {
          csv: `isin,quantity,total_cost_paise\nINE002A01018,3,${cost}`,
          expectedVersion: version,
          storageConsent: true,
        },
      })
    ).json();
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers,
          data: { previewId: p.previewId, expectedVersion: version },
        })
      ).ok(),
    ).toBe(true);
  };
  await hold(0, '10000');
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
              goalId: g.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1',
            },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  const create = async () =>
    ReportJobSchema.parse(
      await (
        await request.post('/api/v1/account/reports', {
          headers,
          data: {
            requestId: randomUUID(),
            label: 'Synthetic populated report',
            consent: true,
          },
        })
      ).json(),
    );
  const first = await create();
  expect(
    (
      await request.put(`/api/v1/account/goals/${g.id}`, {
        headers,
        data: { expectedVersion: 1, goal: { ...goal, monthlyMinor: '10000' } },
      })
    ).ok(),
  ).toBe(true);
  await hold(1, '12000');
  const issued = async (id: string) => {
    await expect
      .poll(
        async () =>
          ReportJobSchema.parse(
            await (await request.get(`/api/v1/account/reports/${id}`)).json(),
          ).status,
        { timeout: 15000 },
      )
      .toBe('succeeded');
    return ReportJobSchema.parse(
      await (await request.get(`/api/v1/account/reports/${id}`)).json(),
    );
  };
  const old = await issued(first.id);
  expect(old.snapshot).toEqual(first.snapshot);
  expect(old.report?.goalReviews[0]).toMatchObject({
    projectedMinor: '85007',
    gapMinor: '14993',
    goalVersion: 1,
  });
  expect(old.report?.recordedHoldingsCostMinor).toBe('10000');
  expect(old.snapshot.allocations.rows[0]?.recordedCostMinor).toBe('3333');
  expect(old.report?.allocationsRequireReview).toBe(false);
  const newer = await issued((await create()).id);
  expect(newer.report?.goalReviews[0]).toMatchObject({
    projectedMinor: '40001',
    gapMinor: '59999',
    goalVersion: 2,
  });
  expect(newer.report?.recordedHoldingsCostMinor).toBe('12000');
  expect(newer.report?.allocationsRequireReview).toBe(true);
  expect(newer.report?.allocationReview[0]?.reasons.join(' ')).toContain(
    'changed',
  );
  expect(
    ReportJobSchema.parse(
      await (await request.get(`/api/v1/account/reports/${first.id}`)).json(),
    ).report,
  ).toEqual(old.report);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    exported.reports.jobs.find((j) => j.id === first.id)?.snapshot,
  ).toEqual(first.snapshot);
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
        await other.get(`/api/v1/account/reports/${first.id}/download`)
      ).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect(
    (
      await request.delete('/api/v1/account', { headers, data: { password } })
    ).ok(),
  ).toBe(true);
  const pg = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: { connectionString: string; max?: number }) => {
      query: (
        sql: string,
        values?: unknown[],
      ) => Promise<{ rows: Record<string, unknown>[] }>;
      end: () => Promise<void>;
    };
  };
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    expect(
      (
        await pool.query(
          'SELECT id FROM record_report_jobs WHERE id=ANY($1::uuid[])',
          [[first.id, newer.id]],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query(
          'SELECT job_id FROM record_reports WHERE job_id=ANY($1::uuid[])',
          [[first.id, newer.id]],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
});
