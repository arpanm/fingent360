import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  connectionDatabase,
  prepareConnectionAccount,
  seedConnectionSource,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';

test('E2E-API-1409 encrypted connection revision and review receipts preserve replay/history/export @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const db = await connectionDatabase(feedbackSandbox);
  try {
    const id = randomUUID(),
      data = {
        requestId: randomUUID(),
        expectedVersion: 0,
        action: 'create',
        source: {
          itemId: source.id,
          version: source.version,
          sourceHash: source.sourceHash,
        },
        target: { kind: 'holding', id: 'INE002A01018', version: 1 },
        note: 'Synthetic private encrypted note',
        storageConsent: true,
      };
    const path = '/api/v1/account/research-connections/' + id;
    const first = await request.put(path, { headers, data });
    expect(first.status()).toBe(200);
    const receipt = await first.json();
    expect(await (await request.put(path, { headers, data })).json()).toEqual(
      receipt,
    );
    const row = (
      await db.query(
        'SELECT payload,encrypted_payload,target_kind FROM app_research_connection_revisions WHERE connection_id=$1',
        [id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(row.target_kind).toBe('holding');
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(data.note);
    expect(
      (
        await request.post('/api/v1/account/connection-reviews/check', {
          headers,
          data: { requestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    for (const table of [
      'app_connection_review_inboxes',
      'app_connection_review_requests',
    ]) {
      const stored = (
        await db.query(`SELECT payload,encrypted_payload FROM ${table}`)
      ).rows[0];
      expect(stored.payload).toBeNull();
      expect(stored.encrypted_payload).toBeTruthy();
    }
    expect((await request.get(path + '/history')).status()).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
  } finally {
    await db.end();
  }
});
