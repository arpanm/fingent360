import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  SavedGoalSchema,
  SavedGoalsSchema,
  SavedGoalHistorySchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-goal-test-only-2026';
const goal = {
  name: 'Synthetic education plan',
  type: 'education',
  targetMinor: '10000001',
  savedMinor: '1',
  monthlyMinor: '100000',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-060 private repeat goals preserve precision, revisions and conflicts @GOALS-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  const username = `goal_${randomUUID().slice(0, 16)}`;
  try {
    expect((await request.get('/api/v1/account/goals')).status()).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: { username, password, consent: true },
        })
      ).status(),
    ).toBe(201);
    const created = await request.post('/api/v1/account/goals', {
      headers,
      data: goal,
    });
    expect(created.status()).toBe(201);
    const first = SavedGoalSchema.parse(await created.json());
    expect(first.projectedMinor).toBe('1200001');
    expect(first.gapMinor).toBe('8800000');
    expect(
      (
        await request.post('/api/v1/account/goals', {
          headers,
          data: { ...goal, name: 'Second education plan' },
        })
      ).status(),
    ).toBe(201);
    expect(
      SavedGoalsSchema.parse(
        await (await request.get('/api/v1/account/goals')).json(),
      ).goals,
    ).toHaveLength(2);
    expect(
      (
        await other.post('/api/v1/account/register', {
          headers,
          data: {
            username: `goal_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await other.get(`/api/v1/account/goals/${first.id}/history`)).status(),
    ).toBe(404);
    expect(
      (
        await other.put(`/api/v1/account/goals/${first.id}`, {
          headers,
          data: { expectedVersion: 1, goal },
        })
      ).status(),
    ).toBe(404);
    const updated = await request.put(`/api/v1/account/goals/${first.id}`, {
      headers,
      data: { expectedVersion: 1, goal: { ...goal, monthlyMinor: '200000' } },
    });
    expect(updated.status()).toBe(200);
    expect(SavedGoalSchema.parse(await updated.json()).version).toBe(2);
    expect(
      (
        await request.put(`/api/v1/account/goals/${first.id}`, {
          headers,
          data: { expectedVersion: 1, goal },
        })
      ).status(),
    ).toBe(409);
    const history = SavedGoalHistorySchema.parse(
      await (
        await request.get(`/api/v1/account/goals/${first.id}/history`)
      ).json(),
    );
    expect(history.revisions.map((r) => r.monthlyMinor)).toEqual([
      '200000',
      '100000',
    ]);
    await request.post('/api/v1/account/logout', { headers, data: {} });
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    expect(
      SavedGoalsSchema.parse(
        await (await request.get('/api/v1/account/goals')).json(),
      ).goals,
    ).toHaveLength(2);
    expect(
      (
        await request.delete(`/api/v1/account/goals/${first.id}`, {
          headers,
          data: { expectedVersion: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.delete(`/api/v1/account/goals/${first.id}`, {
          headers,
          data: { expectedVersion: 2 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await request.get(`/api/v1/account/goals/${first.id}/history`)).status(),
    ).toBe(404);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
test('E2E-API-061 goal validation and origin reject without mutation @GOALS-001', async ({
  request,
}) => {
  try {
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `goal_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await request.post('/api/v1/account/goals', { data: goal })).status(),
    ).toBe(403);
    for (const invalid of [
      { ...goal, targetMinor: '1.23' },
      { ...goal, horizonMonths: 0 },
      { ...goal, storageConsent: false },
      { ...goal, userId: randomUUID() },
      { ...goal, monthlyMinor: '-1' },
    ])
      expect(
        (
          await request.post('/api/v1/account/goals', {
            headers,
            data: invalid,
          })
        ).status(),
      ).toBe(400);
    expect(
      SavedGoalsSchema.parse(
        await (await request.get('/api/v1/account/goals')).json(),
      ).goals,
    ).toEqual([]);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
  }
});
