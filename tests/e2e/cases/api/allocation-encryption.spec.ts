import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authGoal,
  authImport,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  SavedGoalSchema,
  HoldingsPreviewSchema,
} from '../../../../packages/contracts/src/index';

test('E2E-API-1406 encrypted allocation preserves exact row history and holdings import dependency review @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox);
  try {
    const goal = SavedGoalSchema.parse(
      await (
        await request.post('/api/v1/account/goals', {
          headers: authHeaders,
          data: authGoal,
        })
      ).json(),
    );
    const preview = HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers: authHeaders,
          data: authImport,
        })
      ).json(),
    );
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers: authHeaders,
          data: { previewId: preview.previewId, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(201);
    const save = await request.put('/api/v1/account/allocations', {
      headers: authHeaders,
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
    });
    expect(save.status()).toBe(200);
    const row = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_goal_allocation_revisions WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(authGoal.name);
    const next = HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers: authHeaders,
          data: { ...authImport, expectedVersion: 1 },
        })
      ).json(),
    );
    const reconciliation = next.reconciliation;
    expect(reconciliation).toBeDefined();
    if (!reconciliation) throw Error('Expected holdings reconciliation.');
    expect(reconciliation.dependencies.allocationRows).toBe(1);
    expect(
      (await request.get('/api/v1/account/allocations/history')).status(),
    ).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
  } finally {
    await db.end();
  }
});
