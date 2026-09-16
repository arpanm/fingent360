import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  fundFixture,
  fundAccount,
  retentionHeaders,
} from '../../helpers/funds-bonds';
import { connectionDatabase } from '../../helpers/research-connection-fixture';

test('E2E-API-1410 encrypted bond receipt preserves legacy upgrade and key-independent deletion @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await fundAccount(request);
  const { comparison } = await fundFixture(),
    db = await connectionDatabase(feedbackSandbox),
    id = randomUUID(),
    path = '/api/v1/account/bond-comparisons/' + id;
  try {
    const response = await request.put(path, {
      headers: retentionHeaders,
      data: comparison,
    });
    expect(response.status()).toBe(200);
    const saved = await response.json();
    const row = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_bond_comparisons WHERE id=$1',
        [id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(row.encrypted_payload).toBeTruthy();
    await db.query(
      'UPDATE app_bond_comparisons SET payload=$2,encrypted_payload=NULL WHERE id=$1',
      [id, saved],
    );
    expect(
      (await request.get('/api/v1/account/bond-comparisons')).status(),
    ).toBe(200);
    expect(
      (
        await db.query('SELECT payload FROM app_bond_comparisons WHERE id=$1', [
          id,
        ])
      ).rows[0].payload,
    ).toBeNull();
    await db.query(
      "UPDATE app_bond_comparisons SET encrypted_payload=jsonb_set(encrypted_payload,'{keyId}','\"unknown_synthetic_key\"') WHERE id=$1",
      [id],
    );
    expect(
      (await request.get('/api/v1/account/bond-comparisons')).status(),
    ).toBe(503);
    expect(
      (await request.delete(path, { headers: retentionHeaders })).status(),
    ).toBe(200);
    const removed = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_bond_comparisons WHERE id=$1',
        [id],
      )
    ).rows[0];
    expect(removed.payload).toBeNull();
    expect(removed.encrypted_payload).toBeNull();
  } finally {
    await db.end();
  }
});
