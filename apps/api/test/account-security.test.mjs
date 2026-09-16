import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkOrigin,
  derivePassword,
  matchesPassword,
  newSalt,
  sessionFromCookie,
  sessionHash,
  AccountRateLimit,
} from '../dist/account-security.js';
test('passwords use unique salts and require exact matching', async () => {
  const salt = newSalt();
  const derived = await derivePassword('test-only-passphrase-123', salt);
  assert.equal(derived.length, 128);
  assert.notEqual(newSalt(), salt);
  assert.ok(matchesPassword(derived, derived));
  assert.equal(matchesPassword(derived, '0'.repeat(128)), false);
});
test('session parser rejects duplicates and malformed bearer cookies', () => {
  const token = 'a'.repeat(64);
  assert.equal(
    sessionFromCookie(`other=x; f360_session=${token}`),
    sessionHash(token),
  );
  assert.equal(
    sessionFromCookie(`f360_session=${token}; f360_session=${token}`),
    null,
  );
  assert.equal(sessionFromCookie('f360_session=wrong'), null);
});
test('account mutations accept only configured same-origin and its loopback alias', () => {
  checkOrigin('http://localhost:5173', 'http://localhost:5173');
  checkOrigin('http://127.0.0.1:5173', 'http://localhost:5173');
  for (const origin of [
    undefined,
    'null',
    'https://evil.example',
    'http://localhost:9000',
  ])
    assert.throws(() => checkOrigin(origin, 'http://localhost:5173'));
  assert.throws(() =>
    checkOrigin('http://127.0.0.1:5173', 'https://app.example'),
  );
});
test('account request work is bounded per client', () => {
  const limits = new AccountRateLimit();
  for (let i = 0; i < 120; i++) limits.consume('test-client');
  assert.throws(
    () => limits.consume('test-client'),
    (error) => error.getStatus() === 429,
  );
});

test('deletion and sign-in have independent IP budgets with stricter owner limits', () => {
  const signIn = new AccountRateLimit();
  const deletion = new AccountRateLimit();
  const owners = new AccountRateLimit(5);
  for (let i = 0; i < 120; i++) signIn.consume('same-ip');
  assert.throws(
    () => signIn.consume('same-ip'),
    (error) => error.getStatus() === 429,
  );
  deletion.consume('same-ip');
  for (let i = 0; i < 5; i++) owners.consume('owner-a');
  assert.throws(
    () => owners.consume('owner-a'),
    (error) => error.getStatus() === 429,
  );
  owners.consume('owner-b');
  for (let i = 1; i < 120; i++) deletion.consume('same-ip');
  assert.throws(
    () => deletion.consume('same-ip'),
    (error) => error.getStatus() === 429,
  );
});

// Synthetic storage fixture: keep the real cookie parser and session admission.
async function deletionFixture({ revokeAfterLock = false } = {}) {
  const { AccountStore } = await import('../dist/accounts.js');
  const store = new AccountStore({
    DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
  });
  const token = 'a'.repeat(64);
  const events = [];
  const owner = {
    id: 'owner-fixture',
    get password_salt() {
      return assert.fail('Password work must not start before admission');
    },
  };
  store.transaction = async (work) =>
    work({
      query: async (sql, values) => {
        if (sql.startsWith('SELECT u.* FROM app_users u JOIN app_sessions')) {
          assert.deepEqual(values, [sessionHash(token)]);
          assert.ok(sql.includes('s.expires_at > clock_timestamp()'));
          const revoked = revokeAfterLock && events.includes('lock');
          events.push('session');
          return { rows: revoked ? [] : [owner] };
        }
        assert.equal(sql, 'SELECT id FROM app_users WHERE id=$1 FOR UPDATE');
        assert.deepEqual(values, [owner.id]);
        events.push('lock');
        return { rows: [{ id: owner.id }] };
      },
    });
  return { store, events, owner, cookie: `f360_session=${token}` };
}

test('account deletion fixture rejects premature password salt access', async () => {
  const { store, owner } = await deletionFixture();
  try {
    assert.throws(() => owner.password_salt, {
      name: 'AssertionError',
      code: 'ERR_ASSERTION',
      message: 'Password work must not start before admission',
    });
  } finally {
    await store.onApplicationShutdown();
  }
});

test('account deletion enforces the authenticated owner budget before password work', async () => {
  const { store, events, owner, cookie } = await deletionFixture();
  for (let i = 0; i < 5; i++) store.deletionOwnerLimits.consume(owner.id);
  try {
    await assert.rejects(
      store.remove(
        { password: 'test-only-passphrase-123' },
        cookie,
        'fixture-ip',
      ),
      (error) => error.getStatus() === 429,
    );
    assert.deepEqual(events, ['session', 'lock', 'session']);
  } finally {
    await store.onApplicationShutdown();
  }
});

test('account deletion rejects malformed cookies before owner or password work', async () => {
  const { store, events, owner } = await deletionFixture();
  try {
    await assert.rejects(
      store.remove(
        { password: 'test-only-passphrase-123' },
        'fixture-cookie',
        'fixture-ip',
      ),
      (error) => error.getStatus() === 401,
    );
    assert.deepEqual(events, []);
    for (let i = 0; i < 5; i++) store.deletionOwnerLimits.consume(owner.id);
  } finally {
    await store.onApplicationShutdown();
  }
});

test('account deletion rechecks the session after locking before owner or password work', async () => {
  const { store, events, owner, cookie } = await deletionFixture({
    revokeAfterLock: true,
  });
  try {
    await assert.rejects(
      store.remove(
        { password: 'test-only-passphrase-123' },
        cookie,
        'fixture-ip',
      ),
      (error) => error.getStatus() === 401,
    );
    assert.deepEqual(events, ['session', 'lock', 'session']);
    for (let i = 0; i < 5; i++) store.deletionOwnerLimits.consume(owner.id);
  } finally {
    await store.onApplicationShutdown();
  }
});
