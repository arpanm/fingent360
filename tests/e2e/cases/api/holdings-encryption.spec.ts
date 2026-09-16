import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authImport,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
} from '../../../../packages/contracts/src/index';

test('E2E-API-1404 encrypted holdings preview confirms and replays one actual revision with readable history/export @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  const db = await connectionDatabase(feedbackSandbox);
  try {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers: authHeaders,
      data: authImport,
    });
    expect(response.status()).toBe(201);
    const preview = HoldingsPreviewSchema.parse(await response.json());
    const stored = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_holdings_previews WHERE id=$1',
        [preview.previewId],
      )
    ).rows[0];
    expect(stored.payload).toBeNull();
    expect(JSON.stringify(stored.encrypted_payload)).not.toContain(
      'INE002A01018',
    );
    const confirm = () =>
      request.post('/api/v1/account/holdings/confirm', {
        headers: authHeaders,
        data: { previewId: preview.previewId, expectedVersion: 0 },
      });
    const first = await confirm();
    expect(first.status()).toBe(201);
    const snapshot = HoldingsSnapshotSchema.parse(await first.json());
    expect(await (await confirm()).json()).toEqual(snapshot);
    const revision = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_holdings_revisions WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(revision.payload).toBeNull();
    expect(JSON.stringify(revision.encrypted_payload)).not.toContain(
      'INE002A01018',
    );
    expect(
      (await request.get('/api/v1/account/holdings/history')).status(),
    ).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
    // Simulate a pre-encryption revision; actual current read rewraps it.
    await db.query(
      'UPDATE app_holdings_revisions SET payload=$2,encrypted_payload=NULL WHERE user_id=$1',
      [owner.id, snapshot],
    );
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ),
    ).toEqual(snapshot);
    expect(
      (
        await db.query(
          'SELECT payload FROM app_holdings_revisions WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].payload,
    ).toBeNull();
  } finally {
    await db.end();
  }
});
