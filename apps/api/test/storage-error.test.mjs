import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storageErrorMessage } from '../dist/storage-error.js';

test('storage diagnostics distinguish setup failures without exposing driver data', () => {
  for (const [code, expected] of [
    ['42P01', /schema is missing/],
    ['42703', /schema is missing/],
    ['28P01', /authentication failed/],
    ['42501', /denied access/],
    ['3D000', /does not exist/],
    ['ECONNREFUSED', /unreachable/],
    ['57014', /timed out/],
    ['ENOENT', /SQL file could not be found/],
  ]) {
    const message = storageErrorMessage({
      code,
      message: 'private-password',
      detail: 'private-query',
    });
    assert.match(message, expected);
    assert.doesNotMatch(message, /private-password|private-query/);
  }
});
test('unknown errors do not imply migration is the confirmed cause', () => {
  for (const error of [
    null,
    undefined,
    new Error('private-password'),
    { code: 'unknown' },
  ]) {
    assert.match(storageErrorMessage(error), /cause has not been identified/);
    assert.doesNotMatch(storageErrorMessage(error), /private-password/);
  }
});

test('workspace transaction preserves the schema diagnostic and rolls back', async () => {
  const { JourneyStore } = await import('../dist/journey.js');
  const calls = [];
  const store = Object.create(JourneyStore.prototype);
  store.pool = {
    connect: async () => ({
      query: async (sql) => {
        calls.push(sql);
      },
      release: () => {
        calls.push('release');
      },
    }),
  };
  await assert.rejects(
    () =>
      store.transaction(async () => {
        throw { code: '42P01', message: 'private SQL' };
      }),
    (error) =>
      error.getStatus() === 503 &&
      /schema is missing/.test(error.message) &&
      !error.message.includes('private SQL'),
  );
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', 'release']);
});
