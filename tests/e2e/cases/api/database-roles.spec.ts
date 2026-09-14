import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  ownedRoleConnections,
  databaseRoleTools,
} from '../../helpers/database-role-fixture';
import {
  connectionHeaders,
  prepareConnectionAccount,
} from '../../helpers/research-connection-fixture';
import { beaOperator } from '../../helpers/bea-fixture';
import {
  SourceRecordSchema,
  HoldingsSnapshotSchema,
} from '../../../../packages/contracts/src/index';
import {
  ownedRetentionDatabase,
  type OwnedPool,
} from '../../helpers/retention';

test.use({
  leastPrivilege: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
async function denied(pool: OwnedPool, sql: string, code = '42501') {
  let actual: unknown;
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
  } catch (error) {
    actual =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : 'unknown';
  } finally {
    await pool.query('ROLLBACK');
  }
  expect(
    actual,
    'The actual runtime SQL must be denied with the expected safe SQLSTATE.',
  ).toBe(code);
}

test('E2E-API-580 actual least-privilege runtime serves owned account holdings and source workflows @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox);
  try {
    const goal = await prepareConnectionAccount(request);
    const holdings = await request.get('/api/v1/account/holdings');
    expect(holdings.status()).toBe(200);
    expect(
      HoldingsSnapshotSchema.parse(await holdings.json()).holdings,
    ).toHaveLength(1);
    const goals = await request.get('/api/v1/account/goals');
    expect(goals.status()).toBe(200);
    expect(JSON.stringify(await goals.json())).toContain(goal.id);
    expect((await request.get('/api/v1/ready')).status()).toBe(200);
    await beaOperator(request);
    const data = {
      name: 'Synthetic runtime role source',
      category: 'Synthetic',
      sourceUrl: 'https://example.com/source',
      termsUrl: 'https://example.com/terms',
      rightsStatus: 'unreviewed',
      constraints: 'Synthetic only',
      reviewEvidence: '',
      reviewedAt: null,
      published: false,
    };
    const saved = await request.post('/api/v1/ops/sources', {
      headers: connectionHeaders,
      data,
    });
    expect(saved.status()).toBe(201);
    const record = SourceRecordSchema.parse(await saved.json());
    expect(
      (
        await db.runtime.query(
          'SELECT data FROM research_source_revisions WHERE source_id=$1',
          [record.id],
        )
      ).rows[0]?.data,
    ).toEqual(data);
    // Trigger authority is not bypassed by runtime DML grants.
    await denied(
      db.runtime,
      `UPDATE research_source_revisions SET data='{}'::jsonb WHERE source_id='${record.id}'`,
      'P0001',
    );
    expect(
      (
        await db.owner.query(
          'SELECT data FROM research_source_revisions WHERE source_id=$1',
          [record.id],
        )
      ).rows[0]?.data,
    ).toEqual(data);
  } finally {
    await db.close();
  }
});

test('E2E-API-581 persistent DDL escalation ledger writes and truncate are actually denied @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox);
  try {
    const owner = (
      await db.owner.query<{ owner: string }>('SELECT current_user AS owner')
    ).rows[0]!.owner;
    expect(/^[a-z][a-z0-9_]{0,62}$/.test(owner)).toBe(true);
    for (const sql of [
      'CREATE TABLE forbidden_runtime_table(id integer)',
      'CREATE SCHEMA forbidden_runtime_schema',
      'CREATE ROLE forbidden_runtime_role',
      'ALTER TABLE app_users DISABLE TRIGGER ALL',
      'TRUNCATE app_users CASCADE',
      'DELETE FROM schema_migrations',
      `SET ROLE "${owner}"`,
    ])
      await denied(db.runtime, sql);
    const permission = await db.runtime.query<{
      safe: boolean;
      temporary: boolean;
    }>(`SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND NOT rolinherit
      AND NOT has_database_privilege(current_user,current_database(),'CREATE') AND NOT has_schema_privilege(current_user,current_schema(),'CREATE') AS safe,
      has_database_privilege(current_user,current_database(),'TEMP') AS temporary FROM pg_roles WHERE rolname=current_user`);
    expect(permission.rows[0]?.safe).toBe(true);
    expect(typeof permission.rows[0]?.temporary).toBe('boolean');
    expect(
      Number(
        (await db.runtime.query('SELECT count(*) AS n FROM schema_migrations'))
          .rows[0]?.n,
      ),
    ).toBeGreaterThan(0);
  } finally {
    await db.close();
  }
});

test('E2E-API-582 owner migration defaults enable new runtime DML and sequence usage without ownership @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox);
  try {
    const { applyMigration } = await import(
      new URL('../../../../apps/api/dist/migration-ledger.js', import.meta.url)
        .href
    );
    const { refreshRuntimeGrants } = await databaseRoleTools();
    await db.owner.query('BEGIN');
    try {
      await applyMigration(
        db.owner,
        'synthetic-role-grants.sql',
        'CREATE TABLE synthetic_role_rows(id bigserial PRIMARY KEY,value text NOT NULL)',
      );
      await refreshRuntimeGrants(db.owner, {
        DATABASE_URL: db.runtimeUrl,
        MIGRATION_DATABASE_URL: feedbackSandbox.databaseUrl,
      });
      await db.owner.query('COMMIT');
    } catch (error) {
      await db.owner.query('ROLLBACK');
      throw error;
    }
    const saved = await db.runtime.query<{ id: string }>(
      "INSERT INTO synthetic_role_rows(value) VALUES('synthetic') RETURNING id",
    );
    expect(saved.rows[0]?.id).toBe('1');
    await db.runtime.query(
      "UPDATE synthetic_role_rows SET value='synthetic changed' WHERE id=1",
    );
    expect(
      (await db.runtime.query('SELECT value FROM synthetic_role_rows')).rows,
    ).toEqual([{ value: 'synthetic changed' }]);
    await db.runtime.query('DELETE FROM synthetic_role_rows WHERE id=1');
    expect(
      (await db.runtime.query('SELECT * FROM synthetic_role_rows')).rows,
    ).toEqual([]);
    await denied(
      db.runtime,
      'ALTER TABLE synthetic_role_rows ADD COLUMN extra text',
    );
    await denied(
      db.runtime,
      "UPDATE schema_migrations SET checksum='synthetic'",
    );
    expect(
      (
        await db.owner.query(
          "SELECT filename FROM schema_migrations WHERE filename='synthetic-role-grants.sql'",
        )
      ).rows,
    ).toHaveLength(1);
    // Default privileges are independently effective before the next refresh.
    await db.owner.query(
      'CREATE TABLE synthetic_default_rows(id bigserial PRIMARY KEY)',
    );
    expect(
      (
        await db.runtime.query(
          'INSERT INTO synthetic_default_rows DEFAULT VALUES RETURNING id',
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});

test('E2E-API-583 repeat preview and apply preserve records password and grants @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox);
  try {
    await prepareConnectionAccount(request);
    const original = await (
      await request.get('/api/v1/account/holdings')
    ).json();
    const { provisionRuntimeRole } = await databaseRoleTools();
    const preview = await provisionRuntimeRole(
      feedbackSandbox.databaseUrl,
      db.runtimeUrl,
    );
    expect(preview).toMatchObject({
      action: 'existing',
      applied: false,
      role: db.role,
      schema: feedbackSandbox.schema,
    });
    const reapplied = await provisionRuntimeRole(
      feedbackSandbox.databaseUrl,
      db.runtimeUrl,
      true,
    );
    expect(reapplied).toMatchObject({ action: 'existing', applied: true });
    // Repeat preview opens a fresh runtime connection using the original secret.
    // No access to pg_authid/password verifiers is required by this acceptance.
    expect(
      (await provisionRuntimeRole(feedbackSandbox.databaseUrl, db.runtimeUrl))
        .applied,
    ).toBe(false);
    expect(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).toEqual(original);
    const wrong = new URL(db.runtimeUrl);
    wrong.password = 'synthetic-incorrect-runtime-password';
    await expect(
      provisionRuntimeRole(feedbackSandbox.databaseUrl, wrong.href, true),
    ).rejects.toThrow('Existing runtime authentication failed');
    expect(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).toEqual(original);
  } finally {
    await db.close();
  }
});

test('E2E-API-584 unknown role and unsafe owned-schema grants are refused without takeover @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox),
    foreign = `f360_unknown_${randomUUID().replaceAll('-', '')}`;
  let created = false;
  try {
    const { provisionRuntimeRole } = await databaseRoleTools();
    const unknown = new URL(db.runtimeUrl);
    unknown.username = foreign;
    await db.owner.query(`CREATE ROLE "${foreign}" NOLOGIN`);
    created = true;
    await expect(
      provisionRuntimeRole(feedbackSandbox.databaseUrl, unknown.href, true),
    ).rejects.toThrow('already exists');
    expect(
      (
        await db.owner.query(
          "SELECT rolcanlogin,shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",
          [foreign],
        )
      ).rows,
    ).toEqual([{ rolcanlogin: false, marker: null }]);
    // Grant is introduced only in this test-owned schema, never public or main.
    await db.owner.query(
      `GRANT CREATE ON SCHEMA "${feedbackSandbox.schema}" TO "${db.role}"`,
    );
    await expect(
      provisionRuntimeRole(feedbackSandbox.databaseUrl, db.runtimeUrl, true),
    ).rejects.toThrow('CREATE');
    expect(
      (
        await db.owner.query(
          "SELECT has_schema_privilege($1,$2,'CREATE') AS allowed",
          [db.role, feedbackSandbox.schema],
        )
      ).rows[0]?.allowed,
    ).toBe(true);
  } finally {
    try {
      await db.owner.query(
        `REVOKE CREATE ON SCHEMA "${feedbackSandbox.schema}" FROM "${db.role}"`,
      );
      if (created) await db.owner.query(`DROP ROLE "${foreign}"`);
    } finally {
      await db.close();
    }
  }
});

test('E2E-API-585 owner migration failure rolls back schema and ledger while runtime keeps working @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox);
  try {
    await prepareConnectionAccount(request);
    const original = await (
      await request.get('/api/v1/account/holdings')
    ).json();
    const { applyMigration } = await import(
      new URL('../../../../apps/api/dist/migration-ledger.js', import.meta.url)
        .href
    );
    await db.owner.query('BEGIN');
    try {
      await applyMigration(
        db.owner,
        'synthetic-role-rollback.sql',
        'CREATE TABLE synthetic_rolled_back(id integer); SELECT 1/0',
      );
      throw Error('Synthetic migration must fail.');
    } catch (error) {
      expect(
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : null,
      ).toBe('22012');
    } finally {
      await db.owner.query('ROLLBACK');
    }
    expect(
      (
        await db.owner.query(
          "SELECT to_regclass('synthetic_rolled_back') AS relation",
        )
      ).rows,
    ).toEqual([{ relation: null }]);
    expect(
      (
        await db.owner.query(
          "SELECT filename FROM schema_migrations WHERE filename='synthetic-role-rollback.sql'",
        )
      ).rows,
    ).toEqual([]);
    expect(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).toEqual(original);
  } finally {
    await db.close();
  }
});

test('E2E-API-586 cancelled owned grant wait rolls back a newly created role and its partial grants @DB-LEAST-PRIVILEGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const db = await ownedRoleConnections(feedbackSandbox),
    observer = await ownedRetentionDatabase(feedbackSandbox);
  const role = `f360_app_${randomUUID().replaceAll('-', '')}`,
    candidate = new URL(db.runtimeUrl);
  candidate.username = role;
  let pending: Promise<unknown> | undefined;
  async function cleanupOwnedRole() {
    const found = await observer.query<{ marker: string | null }>(
      "SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",
      [role],
    );
    if (found.rows.length) {
      const binding = (
        await observer.query<{ marker: string }>(
          "SELECT 'fingent360-runtime-v1:'||d.oid||':'||n.oid||':'||r.oid AS marker FROM pg_database d,pg_namespace n,pg_roles r WHERE d.datname=current_database() AND n.nspname=$1 AND r.rolname=current_user",
          [feedbackSandbox.schema],
        )
      ).rows[0]?.marker;
      if (found.rows[0]?.marker !== binding)
        throw Error('Refusing cleanup of an unexpected role identity.');
      // This rare failed-assertion path revokes only the exact role created by
      // this test. No other role, PUBLIC grant or application row is changed.
      const owner = new URL(feedbackSandbox.databaseUrl).username;
      const database = new URL(feedbackSandbox.databaseUrl).pathname.slice(1);
      if (
        ![owner, database].every((value) =>
          /^[a-z][a-z0-9_]{0,62}$/.test(value),
        )
      )
        throw Error('Owned role cleanup identifiers are invalid.');
      await observer.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE "${owner}" IN SCHEMA "${feedbackSandbox.schema}" REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM "${role}"`,
      );
      await observer.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE "${owner}" IN SCHEMA "${feedbackSandbox.schema}" REVOKE USAGE ON SEQUENCES FROM "${role}"`,
      );
      await observer.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA "${feedbackSandbox.schema}" FROM "${role}"`,
      );
      await observer.query(
        `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "${feedbackSandbox.schema}" FROM "${role}"`,
      );
      await observer.query(
        `REVOKE USAGE ON SCHEMA "${feedbackSandbox.schema}" FROM "${role}"`,
      );
      await observer.query(
        `REVOKE CONNECT ON DATABASE "${database}" FROM "${role}"`,
      );
      await observer.query(`DROP ROLE "${role}"`);
    }
  }
  try {
    await prepareConnectionAccount(request);
    const original = await (
      await request.get('/api/v1/account/holdings')
    ).json();
    const { provisionRuntimeRole } = await databaseRoleTools();
    const { waitForQueryBlocked } =
      await import('../../helpers/withdrawal-fixture');
    const readAcl = () =>
      observer.query<{ acl: string; runtime_select: boolean }>(
        "SELECT relacl::text AS acl,has_table_privilege($1,oid,'SELECT') AS runtime_select FROM pg_class WHERE oid='app_users'::regclass",
        [db.role],
      );
    const originalAcl = (await readAcl()).rows;
    expect(originalAcl).toHaveLength(1);
    expect(originalAcl[0]?.runtime_select).toBe(true);
    await db.owner.query('BEGIN');
    const blocker = Number(
      (await db.owner.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid,
    );
    // GRANT changes pg_class's ACL tuple without locking the target table.
    // This uncommitted change holds the actual catalog-write conflict and
    // touches only the fixture role's SELECT grant on its owned app_users.
    // Always roll it back; no revoked runtime privilege is ever committed.
    await db.owner.query(
      `REVOKE SELECT ON TABLE "${feedbackSandbox.schema}".app_users FROM "${db.role}"`,
    );
    expect(
      (
        await db.owner.query<{ runtime_select: boolean }>(
          "SELECT has_table_privilege($1,'app_users','SELECT') AS runtime_select",
          [db.role],
        )
      ).rows,
    ).toEqual([{ runtime_select: false }]);
    const provisioning = provisionRuntimeRole(
      feedbackSandbox.databaseUrl,
      candidate.href,
      true,
    );
    pending = provisioning;
    void provisioning.catch(() => {});
    const sql = `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA "${feedbackSandbox.schema}" TO "${role}"`;
    const waiter = await waitForQueryBlocked(observer, sql, [blocker]);
    // Cancel only the exact newly owned provisioning query observed above.
    expect(
      (
        await observer.query(
          'SELECT pg_cancel_backend(pid) AS cancelled FROM pg_stat_activity WHERE pid=$1 AND query=$2 AND $3=ANY(pg_blocking_pids(pid))',
          [waiter, sql, blocker],
        )
      ).rows,
    ).toEqual([{ cancelled: true }]);
    await expect(provisioning).rejects.toThrow('transaction rolled back');
    await db.owner.query('ROLLBACK');
    expect((await readAcl()).rows).toEqual(originalAcl);
    expect(
      (
        await observer.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [
          role,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).toEqual(original);
  } finally {
    try {
      await db.owner.query('ROLLBACK');
      if (pending) await pending.catch(() => {});
      await cleanupOwnedRole();
    } finally {
      await Promise.all([observer.end(), db.close()]);
    }
  }
});
