import { test, expect } from '../../helpers/feedback-fixture';
import {
  registerRecoverable,
  authHeaders,
  authPassword,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';

test('E2E-API-1412 encrypted account identity preserves unique registration, legacy login and key-independent removal @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox);
  try {
    let row = (
      await db.query(
        'SELECT username,username_lookup,encrypted_identity FROM app_users WHERE id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(row.username).toBeNull();
    expect(row.username_lookup).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row.encrypted_identity)).not.toContain(
      owner.username,
    );
    await db.query(
      'UPDATE app_users SET username=$2,username_lookup=NULL,encrypted_identity=NULL WHERE id=$1',
      [owner.id, owner.username],
    );
    const duplicate = await request.post('/api/v1/account/register', {
      headers: authHeaders,
      data: { username: owner.username, password: authPassword, consent: true },
    });
    expect(duplicate.status()).toBe(400);
    const login = await request.post('/api/v1/account/login', {
      headers: authHeaders,
      data: { username: owner.username, password: authPassword },
    });
    expect(login.status()).toBe(200);
    row = (
      await db.query(
        'SELECT username,encrypted_identity FROM app_users WHERE id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(row.username).toBeNull();
    expect(row.encrypted_identity).toBeTruthy();
    expect((await request.get('/api/v1/account')).status()).toBe(200);
    await db.query(
      "UPDATE app_users SET encrypted_identity=jsonb_set(encrypted_identity,'{keyId}','\"unknown_synthetic_key\"') WHERE id=$1",
      [owner.id],
    );
    expect((await request.get('/api/v1/account')).status()).toBe(503);
    const removed = await request.delete('/api/v1/account', {
      headers: authHeaders,
      data: { password: authPassword },
    });
    expect(removed.status()).toBe(200);
    expect(
      (await db.query('SELECT 1 FROM app_users WHERE id=$1', [owner.id]))
        .rowCount,
    ).toBe(0);
  } finally {
    await db.end();
  }
});
