import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyMigration } from '../dist/migration-ledger.js';

test('unchanged applied migration does not execute SQL twice', async () => {
  const sql = 'CREATE TABLE example(id int)';
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      return {
        rows: [{ checksum: createHash('sha256').update(sql).digest('hex') }],
      };
    },
  };
  assert.equal(await applyMigration(client, 'example.sql', sql), false);
  assert.equal(calls.length, 1);
});

test('modified applied migration is rejected before executing its SQL', async () => {
  let calls = 0;
  const client = {
    query: async () => {
      calls++;
      return { rows: [{ checksum: 'old' }] };
    },
  };
  await assert.rejects(
    applyMigration(client, 'example.sql', 'DROP TABLE example'),
    /Applied migration changed/,
  );
  assert.equal(calls, 1);
});

test('failed SQL is not recorded as applied', async () => {
  const calls = [];
  const client = {
    query: async (sql) => {
      calls.push(sql);
      if (sql === 'bad migration') throw new Error('syntax error');
      return { rows: [] };
    },
  };
  await assert.rejects(
    applyMigration(client, 'example.sql', 'bad migration'),
    /syntax error/,
  );
  assert.equal(calls.length, 2);
});
