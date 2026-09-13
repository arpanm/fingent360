import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  GoalComparisonSchema,
  GoalComparisonsSchema,
  GoalAdoptionSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const goalInput = {
  name: 'Synthetic comparison goal',
  type: 'education',
  targetMinor: '9999999999999999',
  savedMinor: '100',
  monthlyMinor: '10000',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
const register = () => ({
  username: `scenario_${randomUUID().slice(0, 10)}`,
  password: 'Synthetic-scenario-2026',
  consent: true,
});
test('E2E-API-280 immutable exact comparisons adopt once preserve baseline and export @GOAL-SCENARIOS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', { headers, data: register() });
  const goal = await (
    await request.post('/api/v1/account/goals', { headers, data: goalInput })
  ).json();
  const other = await (
    await request.post('/api/v1/account/goals', {
      headers,
      data: { ...goalInput, name: 'Unrelated goal' },
    })
  ).json();
  const preview = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    })
  ).json();
  await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: { previewId: preview.previewId, expectedVersion: 0 },
  });
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: {
          expectedVersion: 0,
          expectedHoldingsVersion: 1,
          rows: [
            {
              goalId: goal.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1',
            },
          ],
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(200);
  const id = randomUUID(),
    input = {
      goalId: goal.id,
      expectedGoalVersion: 1,
      alternatives: [
        { monthlyMinor: '9999999999999999', horizonMonths: 1200 },
        { monthlyMinor: '0', horizonMonths: 1 },
      ],
      storageConsent: true,
    };
  const comparison = GoalComparisonSchema.parse(
    await (
      await request.put(`/api/v1/account/goal-comparisons/${id}`, {
        headers,
        data: input,
      })
    ).json(),
  );
  expect(comparison.baseline).toEqual(goal);
  expect(comparison.alternatives[0]?.projectedMinor).toBe(
    (9999999999999999n * 1200n + 100n).toString(),
  );
  expect(
    await (
      await request.put(`/api/v1/account/goal-comparisons/${id}`, {
        headers,
        data: input,
      })
    ).json(),
  ).toEqual(comparison);
  expect(
    (await (await request.get('/api/v1/account/goals')).json()).goals,
  ).toEqual([goal, other]);
  const stranger = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await stranger.post('/api/v1/account/register', {
      headers,
      data: register(),
    });
    expect(
      (
        await stranger.put(`/api/v1/account/goal-comparisons/${id}/adopt`, {
          headers,
          data: {
            requestId: randomUUID(),
            alternativeIndex: 0,
            storageConsent: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      GoalComparisonsSchema.parse(
        await (await stranger.get('/api/v1/account/goal-comparisons')).json(),
      ).comparisons,
    ).toEqual([]);
  } finally {
    await stranger.dispose();
  }
  const adoptionInput = {
    requestId: randomUUID(),
    alternativeIndex: 0,
    storageConsent: true,
  };
  const writes = await Promise.all(
    [0, 1].map(() =>
      request.put(`/api/v1/account/goal-comparisons/${id}/adopt`, {
        headers,
        data: adoptionInput,
      }),
    ),
  );
  expect(writes.map((r) => r.status())).toEqual([200, 200]);
  const a = GoalAdoptionSchema.parse(await writes[0]!.json());
  expect(await writes[1]!.json()).toEqual(a);
  expect(a.goal.version).toBe(2);
  const after = (await (await request.get('/api/v1/account/goals')).json())
    .goals;
  expect(after.find((g: { id: string }) => g.id === other.id)).toEqual(other);
  expect(
    (await (await request.get('/api/v1/account/allocations')).json())
      .requiresReview,
  ).toBe(true);
  expect(
    (
      await request.put(`/api/v1/account/goal-comparisons/${id}/adopt`, {
        headers,
        data: {
          ...adoptionInput,
          requestId: randomUUID(),
          alternativeIndex: 1,
        },
      })
    ).status(),
  ).toBe(409);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.goalScenarios.comparisons).toEqual([comparison]);
  expect(exported.goalScenarios.adoptions).toEqual([a]);
  await request.delete('/api/v1/account', {
    headers,
    data: { password: 'Synthetic-scenario-2026' },
  });
  expect((await request.get('/api/v1/account/goal-comparisons')).status()).toBe(
    401,
  );
});
test('E2E-API-281 stale deleted and conflicting comparison requests reject without goal writes @GOAL-SCENARIOS-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', { headers, data: register() });
  const goal = await (
    await request.post('/api/v1/account/goals', { headers, data: goalInput })
  ).json();
  const id = randomUUID(),
    input = {
      goalId: goal.id,
      expectedGoalVersion: 1,
      alternatives: [{ monthlyMinor: '20000', horizonMonths: 24 }],
      storageConsent: true,
    };
  await request.put(`/api/v1/account/goal-comparisons/${id}`, {
    headers,
    data: input,
  });
  expect(
    (
      await request.put(`/api/v1/account/goal-comparisons/${id}`, {
        headers,
        data: {
          ...input,
          alternatives: [{ monthlyMinor: '30000', horizonMonths: 24 }],
        },
      })
    ).status(),
  ).toBe(409);
  await request.put(`/api/v1/account/goals/${goal.id}`, {
    headers,
    data: {
      expectedVersion: 1,
      goal: { ...goalInput, name: 'Revised synthetic goal' },
    },
  });
  expect(
    (
      await request.put(`/api/v1/account/goal-comparisons/${id}/adopt`, {
        headers,
        data: {
          requestId: randomUUID(),
          alternativeIndex: 0,
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(409);
  await request.delete(`/api/v1/account/goals/${goal.id}`, {
    headers,
    data: { expectedVersion: 2 },
  });
  expect(
    (
      await request.put(`/api/v1/account/goal-comparisons/${id}/adopt`, {
        headers,
        data: {
          requestId: randomUUID(),
          alternativeIndex: 0,
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(404);
  const state = GoalComparisonsSchema.parse(
    await (await request.get('/api/v1/account/goal-comparisons')).json(),
  );
  expect(state.goals).toEqual([]);
  expect(state.adoptions).toEqual([]);
  expect(state.comparisons[0]?.baseline.version).toBe(1);
});
test('E2E-API-282 session revoked while waiting for account lock cannot create comparison @GOAL-SCENARIOS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { createRequire } = await import('node:module');
  type Client = {
    query: (
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    release: () => void;
  };
  const { Pool } = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: { connectionString: string }) => {
      connect: () => Promise<Client>;
      query: Client['query'];
      end: () => Promise<void>;
    };
  };
  const user = await (
    await request.post('/api/v1/account/register', {
      headers,
      data: register(),
    })
  ).json();
  const goal = await (
    await request.post('/api/v1/account/goals', { headers, data: goalInput })
  ).json();
  const id = randomUUID();
  const pool = new Pool({ connectionString: feedbackSandbox.databaseUrl });
  const locker = await pool.connect();
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await locker.query('BEGIN');
    await locker.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
      user.user.id,
    ]);
    const pid = Number(
      (await locker.query('SELECT pg_backend_pid() AS pid')).rows[0]!.pid,
    );
    pending = request.put(`/api/v1/account/goal-comparisons/${id}`, {
      headers,
      data: {
        goalId: goal.id,
        expectedGoalVersion: 1,
        alternatives: [{ monthlyMinor: '100', horizonMonths: 12 }],
        storageConsent: true,
      },
    });
    await expect
      .poll(
        async () =>
          Number(
            (
              await pool.query(
                'SELECT count(*)::integer AS count FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
                [pid],
              )
            ).rows[0]!.count,
          ),
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
    await locker.query('DELETE FROM app_sessions WHERE user_id=$1', [
      user.user.id,
    ]);
    await locker.query('COMMIT');
    expect((await pending).status()).toBe(401);
    expect(
      (
        await pool.query('SELECT id FROM app_goal_comparisons WHERE id=$1', [
          id,
        ])
      ).rows,
    ).toEqual([]);
  } finally {
    await locker.query('ROLLBACK');
    locker.release();
    try {
      if (pending) await pending.catch(() => undefined);
    } finally {
      await pool.end();
    }
  }
});
