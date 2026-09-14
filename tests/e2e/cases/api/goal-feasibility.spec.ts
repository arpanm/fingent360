import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  GoalFeasibilitySchema,
  GoalFeasibilityExportSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const goalInput = {
  name: 'Synthetic downside capacity',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '20000',
  monthlyMinor: '10000',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-600 downside exact persistence replay ownership deletion and unchanged goal @GOAL-FEASIBILITY-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `capacity_${randomUUID().slice(0, 8)}`,
          password: 'Synthetic-capacity-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  const goal = await (
      await request.post('/api/v1/account/goals', { headers, data: goalInput })
    ).json(),
    before = await (await request.get('/api/v1/account/goals')).json();
  const input = {
      goalId: goal.id,
      expectedVersion: goal.version,
      affordableMonthlyMinor: '8000',
      interruptionMonths: 3,
      protectedSavingsMinor: '10000',
      storageConsent: true,
    },
    path = '/api/v1/account/goal-feasibility/' + randomUUID();
  const savedResponse = await request.put(path, { headers, data: input });
  expect(savedResponse.status()).toBe(200);
  const saved = GoalFeasibilitySchema.parse(await savedResponse.json());
  expect(saved.result.stressedProjectedMinor).toBe('82000');
  expect(saved.result.stressedGapMinor).toBe('18000');
  expect(
    await (await request.put(path, { headers, data: input })).json(),
  ).toEqual(saved);
  expect(
    (
      await request.put(path, {
        headers,
        data: { ...input, interruptionMonths: 0 },
      })
    ).status(),
  ).toBe(409);
  expect(await (await request.get('/api/v1/account/goals')).json()).toEqual(
    before,
  );
  const exported = await (
    await request.get('/api/v1/account/privacy/export')
  ).json();
  expect(
    GoalFeasibilityExportSchema.parse(exported.goalFeasibility).assessments,
  ).toContainEqual(saved);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await other.post('/api/v1/account/register', {
      headers,
      data: {
        username: `other_${randomUUID().slice(0, 8)}`,
        password: 'Synthetic-capacity-2026',
        consent: true,
      },
    });
    expect((await other.delete(path, { headers })).status()).toBe(404);
    expect(
      (
        await other.put('/api/v1/account/goal-feasibility/' + randomUUID(), {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(404);
    expect(
      await (await other.get('/api/v1/account/goal-feasibility')).json(),
    ).toEqual({ assessments: [] });
  } finally {
    await other.dispose();
  }
  expect((await request.delete(path, { headers })).status()).toBe(200);
  expect((await request.delete(path, { headers })).status()).toBe(200);
  expect((await request.put(path, { headers, data: input })).status()).toBe(
    410,
  );
  expect(
    await (await request.get('/api/v1/account/goal-feasibility')).json(),
  ).toEqual({ assessments: [] });
  const removed = GoalFeasibilityExportSchema.parse(
    (await (await request.get('/api/v1/account/privacy/export')).json())
      .goalFeasibility,
  );
  expect(removed.assessments).toEqual([]);
  expect(removed.deletedRequestCount).toBe(1);
  const db = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await db.query(
          'SELECT count(*)::integer AS n FROM app_goal_feasibility WHERE id=$1',
          [saved.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      db.query('UPDATE app_goal_feasibility SET fingerprint=$2 WHERE id=$1', [
        saved.id,
        'b'.repeat(64),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await request.delete('/api/v1/account', {
          headers,
          data: { password: 'Synthetic-capacity-2026' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.query(
          'SELECT count(*)::integer AS n FROM app_goal_feasibility WHERE id=$1',
          [saved.id],
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await db.end();
  }
});
test('E2E-API-601 strict assumptions unknown stale goal and consent origin denial @GOAL-FEASIBILITY-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `capacity_${randomUUID().slice(0, 8)}`,
      password: 'Synthetic-capacity-2026',
      consent: true,
    },
  });
  const goal = await (
    await request.post('/api/v1/account/goals', { headers, data: goalInput })
  ).json();
  const data = {
      goalId: goal.id,
      expectedVersion: goal.version,
      affordableMonthlyMinor: null,
      interruptionMonths: null,
      protectedSavingsMinor: null,
      storageConsent: true,
    },
    path = () => '/api/v1/account/goal-feasibility/' + randomUUID();
  const unknown = GoalFeasibilitySchema.parse(
    await (await request.put(path(), { headers, data })).json(),
  );
  expect(unknown.result.status).toBe('unknown');
  expect(unknown.result.stressedProjectedMinor).toBeNull();
  for (const invalid of [
    { ...data, interruptionMonths: 13 },
    { ...data, affordableMonthlyMinor: '1.5' },
    { ...data, storageConsent: false },
    { ...data, expectedVersion: 0 },
    { ...data, returns: '12' },
  ])
    expect(
      (await request.put(path(), { headers, data: invalid })).status(),
    ).toBe(400);
  expect(
    (
      await request.put(path(), {
        headers: { Origin: 'https://example.invalid' },
        data,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put('/api/v1/account/goals/' + goal.id, {
        headers,
        data: {
          expectedVersion: goal.version,
          goal: { ...goalInput, monthlyMinor: '20000' },
        },
      })
    ).status(),
  ).toBe(200);
  expect((await request.put(path(), { headers, data })).status()).toBe(409);
});
test('E2E-API-602 retained capacity deletion frees a slot without resurrecting request @GOAL-FEASIBILITY-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `capacity_${randomUUID().slice(0, 8)}`,
      password: 'Synthetic-capacity-2026',
      consent: true,
    },
  });
  const goal = await (
    await request.post('/api/v1/account/goals', { headers, data: goalInput })
  ).json();
  const input = {
    goalId: goal.id,
    expectedVersion: 1,
    affordableMonthlyMinor: '10000',
    interruptionMonths: 0,
    protectedSavingsMinor: '0',
    storageConsent: true,
  };
  const id = randomUUID(),
    base = '/api/v1/account/goal-feasibility/';
  const original = GoalFeasibilitySchema.parse(
    await (await request.put(base + id, { headers, data: input })).json(),
  );
  const db = await connectionDatabase(feedbackSandbox);
  try {
    // Seed only this fixture owner's valid retained editions to exercise the boundary quickly.
    const owner = await db.query(
      'SELECT user_id,fingerprint FROM app_goal_feasibility WHERE id=$1',
      [id],
    );
    for (let i = 0; i < 99; i++) {
      const next = randomUUID();
      await db.query(
        'INSERT INTO app_goal_feasibility(user_id,id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [
          owner.rows[0].user_id,
          next,
          owner.rows[0].fingerprint,
          { ...original, id: next },
        ],
      );
    }
    expect(
      (
        await request.put(base + randomUUID(), { headers, data: input })
      ).status(),
    ).toBe(409);
    expect((await request.delete(base + id, { headers })).status()).toBe(200);
    expect(
      (
        await request.put(base + randomUUID(), { headers, data: input })
      ).status(),
    ).toBe(200);
    expect(
      (await request.put(base + id, { headers, data: input })).status(),
    ).toBe(410);
    const exported = GoalFeasibilityExportSchema.parse(
      (await (await request.get('/api/v1/account/privacy/export')).json())
        .goalFeasibility,
    );
    expect(exported.assessments).toHaveLength(100);
    expect(exported.deletedRequestCount).toBe(1);
  } finally {
    await db.end();
  }
});
