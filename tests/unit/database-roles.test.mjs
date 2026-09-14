import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  databaseIdentifier,
  databaseTarget,
  migrationDatabaseUrl,
  provisionRuntimeRole,
} from '../../apps/api/dist/database-roles.js';
import { readConfig } from '../../apps/api/dist/config.js';
import { databaseUrls } from '../../scripts/local-ports.mjs';
import { runtimeEnvironment } from '../../scripts/runtime-env.mjs';

const owner =
  'postgresql://synthetic_owner:synthetic-owner-password@127.0.0.1:55432/synthetic';
const runtime =
  'postgresql://synthetic_runtime:synthetic-runtime-password@127.0.0.1:55432/synthetic';
test('role setup validates identifiers URLs and matching targets before any connection', async () => {
  assert.equal(databaseIdentifier('synthetic_runtime'), '"synthetic_runtime"');
  for (const value of [
    'pg_roles',
    'x";DROP ROLE x',
    'two words',
    'A',
    'x'.repeat(64),
  ])
    assert.throws(() => databaseIdentifier(value));
  assert.equal(databaseTarget(runtime, true).schema, 'public');
  for (const value of [
    runtime.replace('127.0.0.1', 'example.com'),
    runtime + '?options=-c%20role=synthetic_owner',
    runtime + '?options=-c%20search_path=public,other',
    runtime + '#fragment',
    runtime + '?host=example.com',
    runtime + '?sslmode=disable&sslmode=require',
  ])
    assert.throws(() => databaseTarget(value, true));
  const different = new URL(runtime);
  different.pathname = '/different';
  await assert.rejects(
    provisionRuntimeRole(owner, different.href),
    /same host, port, database/,
  );
  await assert.rejects(provisionRuntimeRole(owner, owner), /distinct/);
});
test('migration setting is backward compatible and never appears in application config', () => {
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: runtime }), runtime);
  assert.equal(
    migrationDatabaseUrl({
      DATABASE_URL: runtime,
      MIGRATION_DATABASE_URL: owner,
    }),
    owner,
  );
  assert.throws(
    () =>
      migrationDatabaseUrl({
        DATABASE_URL: runtime,
        MIGRATION_DATABASE_URL: owner + '?options=-c%20search_path=another',
      }),
    /same/,
  );
  const config = readConfig({
    DATABASE_URL: runtime,
    MIGRATION_DATABASE_URL: owner,
    MONGODB_URI: 'mongodb://127.0.0.1:57017/synthetic',
  });
  assert.equal(config.DATABASE_URL, runtime);
  assert.equal('MIGRATION_DATABASE_URL' in config, false);
});
test('local port selection preserves separate owner and runtime credentials and schema options', () => {
  const options = '?options=-c%20search_path=synthetic_schema';
  const result = databaseUrls(
    {
      DATABASE_URL: runtime + options,
      MIGRATION_DATABASE_URL: owner + options,
      MONGODB_URI: 'mongodb://127.0.0.1:57017/synthetic',
    },
    55433,
    57018,
  );
  assert.equal(new URL(result.DATABASE_URL).port, '55433');
  assert.equal(new URL(result.MIGRATION_DATABASE_URL).port, '55433');
  assert.equal(new URL(result.DATABASE_URL).username, 'synthetic_runtime');
  assert.equal(
    new URL(result.MIGRATION_DATABASE_URL).username,
    'synthetic_owner',
  );
  assert.equal(
    new URL(result.MIGRATION_DATABASE_URL).searchParams.get('options'),
    '-c search_path=synthetic_schema',
  );
  assert.throws(
    () =>
      databaseUrls(
        {
          DATABASE_URL: runtime,
          MIGRATION_DATABASE_URL: owner.replace('127.0.0.1', 'example.com'),
          MONGODB_URI: 'mongodb://localhost/synthetic',
        },
        55433,
        57018,
      ),
    /remote/,
  );
});
test('API launch environment keeps runtime and strips migration and Compose owner credentials', () => {
  const original = {
    DATABASE_URL: runtime,
    MIGRATION_DATABASE_URL: owner,
    POSTGRES_USER: 'synthetic_owner',
    POSTGRES_PASSWORD: 'synthetic-secret',
    OPERATOR_USERNAME: 'synthetic_initial_admin',
    OPERATOR_PASSWORD: 'synthetic-setup-secret',
    RESEARCH_ADMIN_TOKEN: 'synthetic-operator',
  };
  assert.deepEqual(runtimeEnvironment(original), {
    DATABASE_URL: runtime,
    RESEARCH_ADMIN_TOKEN: 'synthetic-operator',
  });
  assert.equal(original.MIGRATION_DATABASE_URL, owner);
  assert.equal(original.OPERATOR_USERNAME, 'synthetic_initial_admin');
  assert.equal(original.OPERATOR_PASSWORD, 'synthetic-setup-secret');
});
