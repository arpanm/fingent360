import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authGoal,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { SavedGoalSchema } from '../../../../packages/contracts/src/index';

test('E2E-API-1405 encrypted immutable goal comparisons and assessments retain replay, adoption, export and deletion @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  const db = await connectionDatabase(feedbackSandbox);
  try {
    const goal = SavedGoalSchema.parse(
      await (
        await request.post('/api/v1/account/goals', {
          headers: authHeaders,
          data: authGoal,
        })
      ).json(),
    );
    const id = randomUUID(),
      comparisonPath = '/api/v1/account/goal-comparisons/' + id;
    const input = {
      goalId: goal.id,
      expectedGoalVersion: 1,
      alternatives: [{ monthlyMinor: '50000', horizonMonths: 12 }],
      storageConsent: true,
    };
    const first = await request.put(comparisonPath, {
      headers: authHeaders,
      data: input,
    });
    expect(first.status()).toBe(200);
    const comparison = await first.json();
    expect(
      await (
        await request.put(comparisonPath, { headers: authHeaders, data: input })
      ).json(),
    ).toEqual(comparison);
    const adoptionId = randomUUID();
    const adoption = await request.put(comparisonPath + '/adopt', {
      headers: authHeaders,
      data: {
        requestId: adoptionId,
        alternativeIndex: 0,
        storageConsent: true,
      },
    });
    expect(adoption.status()).toBe(200);
    const feasibilityId = randomUUID(),
      feasibilityPath = '/api/v1/account/goal-feasibility/' + feasibilityId;
    const saved = await request.put(feasibilityPath, {
      headers: authHeaders,
      data: {
        goalId: goal.id,
        expectedVersion: 2,
        affordableMonthlyMinor: '50000',
        interruptionMonths: 1,
        protectedSavingsMinor: '0',
        storageConsent: true,
      },
    });
    expect(saved.status()).toBe(200);
    for (const table of [
      'app_goal_comparisons',
      'app_goal_adoptions',
      'app_goal_feasibility',
    ]) {
      const rows = (
        await db.query(
          `SELECT payload,encrypted_payload,content_hash FROM ${table} WHERE user_id=$1`,
          [owner.id],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toBeNull();
      expect(rows[0].content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(rows[0].encrypted_payload)).not.toContain(
        authGoal.name,
      );
    }
    await expect(
      db.query('UPDATE app_goal_comparisons SET fingerprint=$2 WHERE id=$1', [
        id,
        '0'.repeat(64),
      ]),
    ).rejects.toThrow();
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
    expect(
      (
        await request.delete(feasibilityPath, {
          headers: authHeaders,
          data: { confirm: true },
        })
      ).status(),
    ).toBe(200);
    const deleted = (
      await db.query(
        'SELECT payload,encrypted_payload,deleted_at FROM app_goal_feasibility WHERE id=$1',
        [feasibilityId],
      )
    ).rows[0];
    expect(deleted.payload).toBeNull();
    expect(deleted.encrypted_payload).toBeNull();
    expect(deleted.deleted_at).toBeTruthy();
  } finally {
    await db.end();
  }
});
