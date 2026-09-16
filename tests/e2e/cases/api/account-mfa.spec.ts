import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authPassword,
  recoveredPassword,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { MfaEnrollmentSchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-1400 authenticator enrollment encryption, password-only denial, replay prevention and recovery @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  const db = await connectionDatabase(feedbackSandbox);
  const moduleUrl = new URL(
    '../../../../apps/api/dist/account-mfa-crypto.js',
    import.meta.url,
  ).href;
  const { authenticatorCode } = await import(moduleUrl);
  try {
    const setup = await request.post('/api/v1/account/mfa/setup', {
      headers: authHeaders,
      data: { password: authPassword },
    });
    expect(setup.status()).toBe(201);
    const enrollment = MfaEnrollmentSchema.parse(await setup.json());
    const stored = (
      await db.query(
        'SELECT encrypted_secret FROM app_account_mfa WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(JSON.stringify(stored)).not.toContain(enrollment.secret);
    const confirmation = await request.post('/api/v1/account/mfa/confirm', {
      headers: authHeaders,
      data: {
        password: authPassword,
        code: authenticatorCode(
          enrollment.secret,
          Math.floor(Date.now() / 30000) - 1,
        ),
      },
    });
    expect(confirmation.status()).toBe(201);
    expect(
      (
        await request.post('/api/v1/account/logout', { headers: authHeaders })
      ).status(),
    ).toBe(200);
    const credentials = { username: owner.username, password: authPassword };
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers: authHeaders,
          data: credentials,
        })
      ).status(),
    ).toBe(401);
    const code = authenticatorCode(
      enrollment.secret,
      Math.floor(Date.now() / 30000),
    );
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers: authHeaders,
          data: { ...credentials, code },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers: authHeaders,
          data: { ...credentials, code },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/recovery/reset', {
          headers: authHeaders,
          data: {
            username: owner.username,
            code: owner.code,
            newPassword: recoveredPassword,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.query('SELECT * FROM app_account_mfa WHERE user_id=$1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers: authHeaders,
          data: { username: owner.username, password: recoveredPassword },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await db.end();
  }
});

test('E2E-API-1401 RFC6238 SHA1 golden codes and replay windows @DEV-017', async () => {
  const moduleUrl = new URL(
    '../../../../apps/api/dist/account-mfa-crypto.js',
    import.meta.url,
  ).href;
  const { authenticatorCode, matchedAuthenticatorStep } = await import(
    moduleUrl
  );
  // RFC6238 Appendix B public test secret, six-digit truncation of SHA1 outcomes.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for (const [seconds, code] of [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ] as const) {
    expect(authenticatorCode(secret, Math.floor(seconds / 30))).toBe(code);
    expect(
      matchedAuthenticatorStep(
        secret,
        code,
        Math.floor(seconds / 30),
        seconds * 1000,
      ),
    ).toBeNull();
  }
});

test('E2E-API-1402 authenticator disable and recovery rotation require a fresh second factor; failed management attempts remain rate limited @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  const db = await connectionDatabase(feedbackSandbox);
  const moduleUrl = new URL(
    '../../../../apps/api/dist/account-mfa-crypto.js',
    import.meta.url,
  ).href;
  const { authenticatorCode } = await import(moduleUrl);
  try {
    const setup = await request.post('/api/v1/account/mfa/setup', {
      headers: authHeaders,
      data: { password: authPassword },
    });
    const enrollment = MfaEnrollmentSchema.parse(await setup.json());
    expect(
      (
        await request.post('/api/v1/account/mfa/confirm', {
          headers: authHeaders,
          data: {
            password: authPassword,
            code: authenticatorCode(
              enrollment.secret,
              Math.floor(Date.now() / 30000) - 1,
            ),
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/account/recovery/code', {
          headers: authHeaders,
          data: { currentPassword: authPassword, confirm: true },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/mfa/disable', {
          headers: authHeaders,
          data: { password: authPassword, code: 'not-a-code' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/v1/account/mfa/disable', {
          headers: authHeaders,
          data: {
            password: authPassword,
            code: authenticatorCode(
              enrollment.secret,
              Math.floor(Date.now() / 30000),
            ),
          },
        })
      ).status(),
    ).toBe(201);
    expect((await request.get('/api/v1/account/mfa')).status()).toBe(200);
    expect(
      (
        await db.query('SELECT * FROM app_account_mfa WHERE user_id=$1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        (
          await request.post('/api/v1/account/mfa/setup', {
            headers: authHeaders,
            data: { password: 'Wrong-synthetic-password' },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/mfa/setup', {
          headers: authHeaders,
          data: { password: authPassword },
        })
      ).status(),
    ).toBe(429);
  } finally {
    await db.end();
  }
});
