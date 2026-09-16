import { createHash, randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';

test('E2E-API-1411 virtual financial workspace encrypts replay and upgrades legacy storage with key-independent deletion @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const base = '/api/v1/journey',
    opened = await request.post(base + '/workspaces', { data: {} });
  expect(opened.status()).toBe(201);
  const { token } = await opened.json(),
    owner = createHash('sha256').update(token).digest('hex'),
    headers = { Authorization: 'Bearer ' + token },
    db = await connectionDatabase(feedbackSandbox);
  try {
    const portfolio = {
        holdings: [{ instrumentId: 'alpha-air', quantity: '10' }],
        cash: '1000.00',
        goals: [],
      },
      data = { portfolio, expectedRevision: 0, idempotencyKey: randomUUID() };
    const saved = await request.post(base + '/workspace', { headers, data });
    expect(saved.status()).toBe(200);
    const receipt = await saved.json();
    expect(
      await (await request.post(base + '/workspace', { headers, data })).json(),
    ).toEqual(receipt);
    const workspace = (
      await db.query(
        'SELECT portfolio,encrypted_payload FROM virtual_workspaces WHERE token_hash=$1',
        [owner],
      )
    ).rows[0];
    expect(workspace.portfolio).toBeNull();
    expect(workspace.encrypted_payload).toBeTruthy();
    const mutation = (
      await db.query(
        'SELECT response,encrypted_payload FROM virtual_mutations WHERE owner_hash=$1',
        [owner],
      )
    ).rows[0];
    expect(mutation.response).toBeNull();
    expect(mutation.encrypted_payload).toBeTruthy();
    await db.query(
      'UPDATE virtual_workspaces SET portfolio=$2,encrypted_payload=NULL WHERE token_hash=$1',
      [owner, portfolio],
    );
    expect((await request.get(base + '/workspace', { headers })).status()).toBe(
      200,
    );
    expect(
      (
        await db.query(
          'SELECT portfolio FROM virtual_workspaces WHERE token_hash=$1',
          [owner],
        )
      ).rows[0].portfolio,
    ).toBeNull();
    await db.query(
      "UPDATE virtual_workspaces SET encrypted_payload=jsonb_set(encrypted_payload,'{keyId}','\"unknown_synthetic_key\"') WHERE token_hash=$1",
      [owner],
    );
    expect((await request.get(base + '/workspace', { headers })).status()).toBe(
      503,
    );
    expect(
      (await request.delete(base + '/workspace', { headers })).status(),
    ).toBe(200);
    expect(
      (
        await db.query('SELECT 1 FROM virtual_mutations WHERE owner_hash=$1', [
          owner,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await db.end();
  }
});
