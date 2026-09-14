// Executed only by a selected feedback test. Never imported for discovery.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const require = createRequire(
  new URL('../../../apps/api/package.json', import.meta.url),
);
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const schema = `e2e_feedback_${randomUUID().replaceAll('-', '')}`;
let pool,
  ownedMongo,
  app,
  created = false,
  stopping,
  startup,
  cancelled = false,
  exitCode = 0;
let runtimeRole, runtimeDatabaseUrl;
function notify(message) {
  if (process.connected) process.send?.(message, () => {});
}
function localConnection(value, protocols) {
  const url = new URL(value);
  if (
    !protocols.includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  )
    throw Error('Feedback fixtures require loopback databases.');
  return url;
}
async function stop(code = 0) {
  cancelled = true;
  exitCode = Math.max(exitCode, code);
  if (stopping) return stopping;
  stopping = (async () => {
    // A cancellation may arrive while CREATE SCHEMA is committing. Wait for
    // startup to observe cancellation, so created/app ownership is settled.
    await startup?.catch(() => {});
    const steps = [
      async () => {
        await app?.close();
      },
      async () => {
        if (created) {
          // This exact random schema was created by this process; never remove
          // another schema, reset shared quotas or fall back to public tables.
          await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        }
      },
      async () => {
        if (runtimeRole) {
          // This process created this exact random role after its owned schema.
          const row = await pool.query('SELECT current_database() AS database');
          const database = row.rows[0].database;
          if (
            !/^[a-z][a-z0-9_]{0,62}$/.test(database) ||
            !/^f360_app_[a-f0-9]{32}$/.test(runtimeRole)
          )
            throw Error('Owned role cleanup identity failed.');
          await pool.query(
            `REVOKE CONNECT ON DATABASE "${database}" FROM "${runtimeRole}"`,
          );
          await pool.query(`DROP ROLE "${runtimeRole}"`);
        }
      },
      async () => {
        if (ownedMongo) {
          try {
            await ownedMongo.db(schema).dropDatabase();
          } finally {
            await ownedMongo.close();
          }
        }
      },
      async () => {
        await pool?.end();
      },
    ];
    for (const step of steps) {
      try {
        await step();
      } catch {
        exitCode = 1;
        notify({
          error: `Feedback fixture cleanup failed for owned schema ${schema}.`,
        });
      }
    }
    process.exit(exitCode);
  })();
  return stopping;
}
// Parent disconnect/termination also owns shutdown, including a cancelled UI run.
process.on('disconnect', () => void stop());
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
process.on('message', (message) => {
  if (message === 'stop') void stop();
});
async function start() {
  const local = parseEnv(
    await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
  );
  if (cancelled) return;
  const env = { ...local, ...process.env };
  const database = localConnection(
    env.MIGRATION_DATABASE_URL || env.DATABASE_URL,
    ['postgres:', 'postgresql:'],
  );
  const mongo = localConnection(env.MONGODB_URI, ['mongodb:']);
  // Every module receives the exact owned namespace. Broader application tests
  // can store real source evidence here; teardown also drops this private database.
  if (!mongo.searchParams.has('authSource'))
    mongo.searchParams.set('authSource', mongo.pathname.slice(1) || 'admin');
  mongo.pathname = `/${schema}`;
  ownedMongo = new MongoClient(mongo.href, { serverSelectionTimeoutMS: 3000 });
  database.searchParams.set('options', `-c search_path=${schema}`);
  pool = new Pool({
    connectionString: database.href,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  notify({ phase: 'schema-created', schema });
  if (cancelled) return;
  const isolation = await pool.query(
    'SELECT current_schema() = $1 AS isolated',
    [schema],
  );
  if (!isolation.rows[0]?.isolated)
    throw Error('Fixture schema isolation failed.');
  Object.assign(process.env, env, {
    DATABASE_URL: database.href,
    MIGRATION_DATABASE_URL: database.href,
    MONGODB_URI: mongo.href,
    API_HOST: '127.0.0.1',
    API_PORT: '4100',
    WEB_ORIGIN: env.E2E_WEB_URL,
    AI_PROVIDER: 'query',
  });
  await import('../../../apps/api/dist/migrate.js');
  if (process.exitCode) throw Error('Fixture migration failed.');
  if (cancelled) return;
  if (env.F360_TEST_LEAST_PRIVILEGE === '1') {
    const { provisionRuntimeRole } =
      await import('../../../apps/api/dist/database-roles.js');
    const runtime = new URL(database.href),
      name = `f360_app_${randomUUID().replaceAll('-', '')}`;
    runtime.username = name;
    runtime.password = randomBytes(32).toString('hex');
    await provisionRuntimeRole(database.href, runtime.href, true);
    runtimeRole = name;
    runtimeDatabaseUrl = runtime.href;
    process.env.DATABASE_URL = runtime.href;
  }
  delete process.env.MIGRATION_DATABASE_URL;
  delete process.env.POSTGRES_USER;
  delete process.env.POSTGRES_PASSWORD;
  const { readConfig } = await import('../../../apps/api/dist/config.js');
  const { createApp } = await import('../../../apps/api/dist/app.js');
  app = await createApp(readConfig(process.env));
  if (cancelled) return;
  // Let the OS reserve the port atomically; never race a find-free-port probe.
  await app.listen(0, '127.0.0.1');
  if (process.env.F360_TEST_MANUAL_WORKERS === '1') {
    // Selected worker-control tests drive real instances explicitly, only in this
    // owned API/schema. Ordinary fixtures keep their production timers.
    const { ReportWorker } =
      await import('../../../apps/api/dist/report-worker.js');
    const { LibraryReminderWorker } =
      await import('../../../apps/api/dist/library-worker.js');
    await app.get(ReportWorker).onApplicationShutdown();
    await app.get(LibraryReminderWorker).onApplicationShutdown();
  }
  if (!cancelled)
    notify({
      apiOrigin: await app.getUrl(),
      databaseUrl: database.href,
      schema,
      ...(runtimeDatabaseUrl ? { runtimeDatabaseUrl, runtimeRole } : {}),
    });
}
startup = start();
void startup.catch(() => {
  // Driver errors can contain credentials; expose only actionable safe context.
  notify({
    error:
      'Feedback fixture setup failed. User must build the API; check loopback owner credentials (MIGRATION_DATABASE_URL or legacy DATABASE_URL), operator key and CREATE SCHEMA permission. Least-privilege cases also need safe schema grants and CREATE ROLE authority. Existing app data was not reset.',
  });
  void stop(1);
});
