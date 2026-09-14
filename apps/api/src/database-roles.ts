import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import pg from 'pg';

const identifier = /^[a-z][a-z0-9_]{0,62}$/;
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
export class DatabaseRoleError extends Error {}
function fail(message: string): never {
  throw new DatabaseRoleError(message);
}
export function databaseIdentifier(value: string) {
  if (!identifier.test(value) || value.startsWith('pg_'))
    fail(
      'Use a lowercase application role/schema identifier of at most63 characters; system names are not accepted.',
    );
  return `"${value}"`;
}
export function databaseTarget(value: string, local = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(
      'Invalid PostgreSQL URL. Inspect credentials locally; do not share them.',
    );
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.hash ||
    (local && !localHosts.has(url.hostname))
  )
    fail(
      'Role provisioning requires an explicit loopback PostgreSQL URL. Remote administration requires a separately reviewed manual setup.',
    );
  let role: string, database: string, password: string;
  try {
    role = decodeURIComponent(url.username);
    database = decodeURIComponent(url.pathname.slice(1));
    password = decodeURIComponent(url.password);
  } catch {
    return fail('Invalid encoded PostgreSQL connection fields.');
  }
  databaseIdentifier(role);
  databaseIdentifier(database);
  const keys = [...url.searchParams.keys()];
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key) => !['options', 'sslmode'].includes(key))
  )
    fail(
      'Only an explicit search_path and sslmode are supported by role setup. Review other connection options manually.',
    );
  const options = url.searchParams.get('options');
  const match = options?.match(/^-c search_path=([a-z][a-z0-9_]{0,62})$/);
  if (options !== null && !match)
    fail(
      'Use one explicit application schema in options=-c search_path=SCHEMA.',
    );
  const schema = match?.[1] ?? 'public';
  databaseIdentifier(schema);
  const ssl = url.searchParams.get('sslmode');
  if (
    ssl !== null &&
    !['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(ssl)
  )
    fail('Invalid PostgreSQL sslmode.');
  return {
    url: url.href,
    role,
    password,
    database,
    schema,
    host: url.hostname,
    port: url.port || '5432',
  };
}
export function migrationDatabaseUrl(env: NodeJS.ProcessEnv) {
  if (!env.DATABASE_URL) fail('DATABASE_URL is required.');
  if (!env.MIGRATION_DATABASE_URL) return env.DATABASE_URL;
  const runtime = databaseTarget(env.DATABASE_URL),
    owner = databaseTarget(env.MIGRATION_DATABASE_URL);
  sameTarget(owner, runtime);
  return owner.url;
}
function sameTarget(
  owner: ReturnType<typeof databaseTarget>,
  runtime: ReturnType<typeof databaseTarget>,
) {
  if (
    owner.host !== runtime.host ||
    owner.port !== runtime.port ||
    owner.database !== runtime.database ||
    owner.schema !== runtime.schema
  )
    fail(
      'Owner and runtime URLs must name exactly the same host, port, database and application schema.',
    );
}
function verifier(password: string) {
  const salt = randomBytes(18),
    iterations = 16384;
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest('base64');
  const serverKey = createHmac('sha256', salted)
    .update('Server Key')
    .digest('base64');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}
type Target = ReturnType<typeof databaseTarget>;
export interface RuntimeRolePlan {
  role: string;
  schema: string;
  action: 'create' | 'existing';
  applied: boolean;
  temporaryTables: boolean;
}
async function binding(c: pg.PoolClient, owner: Target) {
  const result = await c.query<{
    current_user: string;
    owner_oid: number;
    schema_oid: number;
    database_oid: number;
    schema_owned: boolean;
    can_create_role: boolean;
    database_authority: boolean;
  }>(
    `SELECT current_user,r.oid AS owner_oid,n.oid AS schema_oid,d.oid AS database_oid,
       (n.nspowner=r.oid OR (n.nspname='public' AND d.datdba=r.oid AND n.nspowner=(SELECT oid FROM pg_roles WHERE rolname='pg_database_owner'))) AS schema_owned,
       (r.rolsuper OR r.rolcreaterole) AS can_create_role,(r.rolsuper OR d.datdba=r.oid) AS database_authority
     FROM pg_roles r JOIN pg_namespace n ON n.nspname=$1 JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`,
    [owner.schema],
  );
  const row = result.rows[0];
  if (
    !row ||
    row.current_user !== owner.role ||
    !row.schema_owned ||
    !row.database_authority
  )
    fail(
      'Migration credentials must directly own the existing application schema/database. No ownership will be changed.',
    );
  const foreign = await c.query(
    `SELECT 1 FROM pg_class WHERE relnamespace=$1 AND relkind IN ('r','p','S','v','m','f') AND relowner<>$2
    UNION ALL SELECT 1 FROM pg_proc WHERE pronamespace=$1 AND proowner<>$2 LIMIT 1`,
    [row.schema_oid, row.owner_oid],
  );
  if (foreign.rowCount)
    fail(
      'Application objects have another owner. Review ownership manually; provisioning never reassigns objects.',
    );
  return {
    ...row,
    marker: `fingent360-runtime-v1:${row.database_oid}:${row.schema_oid}:${row.owner_oid}`,
  };
}
async function inspectRole(c: pg.PoolClient, runtime: Target, marker: string) {
  const found = await c.query<{
    oid: number;
    safe: boolean;
    marker: string | null;
  }>(
    `SELECT oid,
    (rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls) AS safe,
    shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1`,
    [runtime.role],
  );
  const role = found.rows[0];
  if (!role) return null;
  if (!role.safe || role.marker !== marker)
    fail(
      'Runtime role already exists without the exact safe application marker/attributes. Choose a new role; no role was taken over.',
    );
  const unexpected = await c.query(
    `SELECT 1 FROM pg_auth_members WHERE member=$1
    UNION ALL SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=$1 AND deptype='o' LIMIT 1`,
    [role.oid],
  );
  if (unexpected.rowCount)
    fail(
      'Runtime role has membership or owned objects. Administrator review is required; no privileges were removed.',
    );
  return role;
}
async function rejectUnsafeGrants(
  c: pg.PoolClient,
  runtime: Target,
  exists: boolean,
) {
  // PUBLIC privileges are inherited even with NOINHERIT. Never silently revoke
  // shared grants to make a role appear safe.
  const create = await c.query(
    `SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND
    (EXISTS(SELECT 1 FROM aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee=0 AND a.privilege_type='CREATE')
     ${exists ? "OR has_schema_privilege($1,n.oid,'CREATE')" : ''}) LIMIT 1`,
    exists ? [runtime.role] : [],
  );
  if (create.rowCount)
    fail(
      'PUBLIC or runtime can CREATE in a persistent schema. An administrator must review those grants before enabling runtime separation; nothing was revoked.',
    );
  const databaseCreate = await c.query(
    `SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND
    (EXISTS(SELECT 1 FROM aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a WHERE a.grantee=0 AND a.privilege_type='CREATE')
     ${exists ? "OR has_database_privilege($1,d.oid,'CREATE')" : ''})`,
    exists ? [runtime.role] : [],
  );
  if (databaseCreate.rowCount)
    fail(
      'PUBLIC or runtime can create persistent schemas in this database. Administrator review is required.',
    );
  const privileges = await c.query(
    `SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND t.relkind IN ('r','p','v','m','f') AND
    EXISTS(SELECT 1 FROM aclexplode(COALESCE(t.relacl,acldefault('r',t.relowner))) a WHERE a.grantee=0 AND
      (n.nspname<>$1 OR t.relname='schema_migrations' OR a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'))) LIMIT 1`,
    [runtime.schema],
  );
  if (privileges.rowCount)
    fail(
      'Unexpected PUBLIC table privileges bypass the runtime boundary. Administrator review is required.',
    );
  const publicSequences = await c.query(
    `SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind='S'
    AND n.nspname !~ '^pg_' AND EXISTS(SELECT 1 FROM aclexplode(COALESCE(t.relacl,acldefault('S',t.relowner))) a
      WHERE a.grantee=0 AND (n.nspname<>$1 OR a.privilege_type<>'USAGE')) LIMIT 1`,
    [runtime.schema],
  );
  if (publicSequences.rowCount)
    fail(
      'Unexpected PUBLIC sequence privileges bypass the runtime boundary. Administrator review is required.',
    );
  if (exists) {
    const extra = await c.query(
      `SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND t.relkind IN ('r','p','v','m','f') AND
      ((n.nspname<>$2 AND has_table_privilege($1,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
       OR has_table_privilege($1,t.oid,'TRUNCATE,REFERENCES,TRIGGER')) LIMIT 1`,
      [runtime.role, runtime.schema],
    );
    if (extra.rowCount)
      fail(
        'Runtime has unexpected table privileges outside the supported DML grant. Review manually; grants were not silently revoked.',
      );
    const sequence = await c.query(
      `SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind='S'
      AND n.nspname !~ '^pg_' AND (has_sequence_privilege($1,t.oid,'SELECT,UPDATE') OR (n.nspname<>$2 AND has_sequence_privilege($1,t.oid,'USAGE'))) LIMIT 1`,
      [runtime.role, runtime.schema],
    );
    if (sequence.rowCount)
      fail(
        'Runtime has unsupported sequence privileges. Only application-schema USAGE is granted.',
      );
  }
  const defaults = await c.query(
    `SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      AND d.defaclnamespace IN (0,(SELECT oid FROM pg_namespace WHERE nspname=$1))
      AND a.grantee IN (0,COALESCE((SELECT oid FROM pg_roles WHERE rolname=$2),0))
      AND (d.defaclnamespace=0 OR (d.defaclobjtype='r' AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'))
        OR (d.defaclobjtype='S' AND a.privilege_type<>'USAGE') OR d.defaclobjtype='n') LIMIT 1`,
    [runtime.schema, runtime.role],
  );
  if (defaults.rowCount)
    fail(
      'Existing owner default privileges would grant broader future access. Review them manually; no defaults were silently revoked.',
    );
  const functions = await c.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND
    ${exists ? "has_function_privilege($1,p.oid,'EXECUTE')" : "EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')"} LIMIT 1`,
    exists ? [runtime.role] : [],
  );
  if (functions.rowCount)
    fail(
      'An executable security-definer function needs separate administrator review before runtime separation.',
    );
}
async function grants(c: pg.PoolClient, owner: Target, runtime: Target) {
  const role = databaseIdentifier(runtime.role),
    schema = databaseIdentifier(runtime.schema),
    migrationOwner = databaseIdentifier(owner.role);
  await c.query(
    `GRANT CONNECT ON DATABASE ${databaseIdentifier(runtime.database)} TO ${role}`,
  );
  await c.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
  await c.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`,
  );
  await c.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`);
  await c.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationOwner} IN SCHEMA ${schema} GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${role}`,
  );
  await c.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationOwner} IN SCHEMA ${schema} GRANT USAGE ON SEQUENCES TO ${role}`,
  );
  const ledger = await c.query('SELECT to_regclass($1) AS ledger', [
    `${schema}.schema_migrations`,
  ]);
  if (ledger.rows[0]?.ledger) {
    await c.query(
      `REVOKE INSERT,UPDATE,DELETE ON TABLE ${schema}.schema_migrations FROM ${role}`,
    );
    await c.query(
      `GRANT SELECT ON TABLE ${schema}.schema_migrations TO ${role}`,
    );
  }
}
/** Called inside the owner's migration transaction, after additive migrations. */
export async function refreshRuntimeGrants(
  c: pg.PoolClient,
  env: NodeJS.ProcessEnv,
) {
  const ownerUrl = migrationDatabaseUrl(env);
  if (!env.MIGRATION_DATABASE_URL) return;
  const owner = databaseTarget(ownerUrl),
    runtime = databaseTarget(env.DATABASE_URL!);
  if (owner.role === runtime.role) return;
  const bound = await binding(c, owner);
  if (!(await inspectRole(c, runtime, bound.marker)))
    fail(
      'Provision the explicit runtime role with pnpm db:roles --apply before migrating with separate credentials.',
    );
  await rejectUnsafeGrants(c, runtime, true);
  await grants(c, owner, runtime);
}
export async function provisionRuntimeRole(
  ownerUrl: string,
  runtimeUrl: string,
  apply = false,
): Promise<RuntimeRolePlan> {
  const owner = databaseTarget(ownerUrl, true),
    runtime = databaseTarget(runtimeUrl, true);
  sameTarget(owner, runtime);
  if (owner.role === runtime.role)
    fail(
      'Use distinct migration-owner and runtime users. Least privilege is not enabled by identical credentials.',
    );
  if (
    runtime.password.length < 24 ||
    runtime.password.length > 256 ||
    !/^[\x21-\x7e]+$/.test(runtime.password)
  )
    fail(
      'Configure a private runtime password of24–256 printable ASCII characters. No password is generated or printed by this command.',
    );
  const pool = new pg.Pool({
    connectionString: owner.url,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  let c: pg.PoolClient | undefined;
  try {
    c = await pool.connect();
    await c.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `fingent360-runtime:${runtime.role}`,
    ]);
    const bound = await binding(c, owner),
      existing = await inspectRole(c, runtime, bound.marker);
    await rejectUnsafeGrants(c, runtime, !!existing);
    if (existing) {
      const runtimePool = new pg.Pool({
        connectionString: runtime.url,
        max: 1,
        connectionTimeoutMillis: 3000,
        statement_timeout: 3000,
      });
      try {
        await runtimePool.query('SELECT current_user');
      } catch {
        fail(
          'Existing runtime authentication failed. Correct its private URL or perform an explicit administrator password rotation; this command never rotates passwords.',
        );
      } finally {
        await runtimePool.end();
      }
    }
    if (apply) {
      if (!existing) {
        if (!bound.can_create_role)
          fail(
            'The schema owner cannot create roles. Ask the database administrator to provision a reviewed runtime role.',
          );
        const role = databaseIdentifier(runtime.role),
          secret = verifier(runtime.password);
        await c.query(
          `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${secret}'`,
        );
        // Marker contains catalog IDs only; it is not a credential.
        await c.query(`COMMENT ON ROLE ${role} IS '${bound.marker}'`);
      }
      await grants(c, owner, runtime);
      await rejectUnsafeGrants(c, runtime, true);
    }
    const temporary =
      existing || apply
        ? (
            await c.query(
              "SELECT has_database_privilege($1,current_database(),'TEMP') AS allowed",
              [runtime.role],
            )
          ).rows[0].allowed === true
        : (
            await c.query(
              "SELECT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='TEMPORARY') AS allowed",
            )
          ).rows[0].allowed === true;
    await c.query('COMMIT');
    return {
      role: runtime.role,
      schema: runtime.schema,
      action: existing ? 'existing' : 'create',
      applied: apply,
      temporaryTables: temporary,
    };
  } catch (error) {
    await c?.query('ROLLBACK').catch(() => {});
    if (error instanceof DatabaseRoleError) throw error;
    throw new DatabaseRoleError(
      'Role setup failed and its transaction rolled back. Check owner connectivity, CREATE ROLE authority, locks and migrations locally; no driver details or credentials are shown.',
    );
  } finally {
    c?.release();
    await pool.end();
  }
}
