import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authGoal,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  SavedGoalSchema,
  SavedGoalsSchema,
} from '../../../../packages/contracts/src/index';

test('E2E-API-1403 encrypted goal revisions preserve actual reads, historical export and legacy rewrap; wrong owner binding fails closed @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  const db = await connectionDatabase(feedbackSandbox);
  const moduleUrl = new URL(
    '../../../../apps/api/dist/private-goals.js',
    import.meta.url,
  ).href;
  const { encryptGoal, decryptGoalRows } = await import(moduleUrl);
  try {
    const create = await request.post('/api/v1/account/goals', {
      headers: authHeaders,
      data: authGoal,
    });
    expect(create.status()).toBe(201);
    const goal = SavedGoalSchema.parse(await create.json());
    let row = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_goal_revisions WHERE goal_id=$1',
        [goal.id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(authGoal.name);
    expect(
      SavedGoalsSchema.parse(
        await (await request.get('/api/v1/account/goals')).json(),
      ).goals[0]?.name,
    ).toBe(authGoal.name);
    // Deliberate old-format row conversion within the isolated fixture only.
    await db.query(
      'UPDATE app_goal_revisions SET payload=$2,encrypted_payload=NULL WHERE goal_id=$1',
      [goal.id, goal],
    );
    await expect(
      decryptGoalRows(
        db,
        randomUUID(),
        [
          {
            goal_id: goal.id,
            version: goal.version,
            payload: goal,
            encrypted_payload: null,
          },
        ],
        feedbackSandbox.privateDataKeys,
      ),
    ).rejects.toThrow('owner could not be verified');
    expect(
      (
        await db.query(
          'SELECT encrypted_payload FROM app_goal_revisions WHERE goal_id=$1',
          [goal.id],
        )
      ).rows[0].encrypted_payload,
    ).toBeNull();
    expect(
      (await request.get(`/api/v1/account/goals/${goal.id}/history`)).status(),
    ).toBe(200);
    row = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_goal_revisions WHERE goal_id=$1',
        [goal.id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(row.encrypted_payload).toBeTruthy();
    expect((await request.get('/api/v1/account/overview')).status()).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
    await db.query(
      'UPDATE app_goal_revisions SET encrypted_payload=$2 WHERE goal_id=$1',
      [
        goal.id,
        encryptGoal(randomUUID(), goal, feedbackSandbox.privateDataKeys),
      ],
    );
    const denied = await request.get('/api/v1/account/goals');
    expect(denied.status()).toBe(503);
    expect(await denied.text()).not.toContain(authGoal.name);
    await db.query(
      'UPDATE app_goal_revisions SET encrypted_payload=$2 WHERE goal_id=$1',
      [goal.id, encryptGoal(owner.id, goal, feedbackSandbox.privateDataKeys)],
    );
    expect((await request.get('/api/v1/account/goals')).status()).toBe(200);
  } finally {
    await db.end();
  }
});
