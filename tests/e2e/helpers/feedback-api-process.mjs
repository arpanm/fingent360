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
let runtimeRole, runtimeDatabaseUrl, namedCredentials;
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
    PRIVATE_IDENTITY_LOOKUP_KEY: randomBytes(32).toString('base64'),
    PRIVATE_DATA_ACTIVE_KEY: 'synthetic_fixture',
    PRIVATE_DATA_KEYS: JSON.stringify({
      synthetic_fixture: randomBytes(32).toString('base64'),
    }),
    REGULATORY_SOURCES_ENABLED:
      env.F360_TEST_REGULATORY === '1' ? 'true' : 'false',
    REGULATORY_SOURCES_PERMISSION_REFERENCE:
      'TEST-SIMULATION synthetic regulatory permission only; no actual licence.',
    WHATSAPP_ENABLED: env.F360_TEST_WHATSAPP === '1' ? 'true' : 'false',
    WHATSAPP_AUTOMATIC_DISPATCH: 'false',
    WHATSAPP_ACCESS_TOKEN: 'synthetic-access-token-never-send',
    WHATSAPP_APP_SECRET: 'synthetic-whatsapp-app-secret',
    WHATSAPP_VERIFY_TOKEN: 'synthetic-whatsapp-verify-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_BUSINESS_NUMBER: '15555550100',
    WHATSAPP_TEMPLATE_NAME: 'fingent_public_summary',
    WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
    WHATSAPP_PUBLIC_ORIGIN: 'https://reading.example.com',
    WHATSAPP_APPROVAL_REFERENCE:
      'TEST-SIMULATION only; no provider activation or actual permission.',
    WHATSAPP_ALLOWED_SOURCE_IDS: 'glossary',
    CCIL_ZERO_ENABLED: env.F360_TEST_CCIL_ZERO === '1' ? 'true' : 'false',
    CCIL_ZERO_PERMISSION_REFERENCE:
      'Synthetic fixture only; no live source rights',
    CCIL_ENABLED: env.F360_TEST_CCIL === '1' ? 'true' : 'false',
    CCIL_PERMISSION_REFERENCE: 'Synthetic fixture only; no live source rights',
    KITE_ENABLED: env.F360_TEST_KITE === '1' ? 'true' : 'false',
    UPSTOX_ENABLED: env.F360_TEST_UPSTOX === '1' ? 'true' : 'false',
    ANGEL_ENABLED: env.F360_TEST_ANGEL === '1' ? 'true' : 'false',
    ANGEL_API_KEY: 'synthetic_angel_key',
    ANGEL_REDIRECT_URL:
      'http://127.0.0.1:4100/api/v1/account/broker-connections/angel/callback',
    ANGEL_PERMISSION_REFERENCE: 'synthetic-publisher-test-only',
    ANGEL_CLIENT_LOCAL_IP: '127.0.0.1',
    ANGEL_CLIENT_PUBLIC_IP: '192.0.2.1',
    ANGEL_MAC_ADDRESS: '02:00:00:00:00:01',
    UPSTOX_API_KEY: 'synthetic_upstox_key',
    UPSTOX_API_SECRET: 'synthetic_upstox_secret',
    UPSTOX_REDIRECT_URL:
      'http://127.0.0.1:4100/api/v1/account/broker-connections/upstox/callback',
    UPSTOX_PERMISSION_REFERENCE: 'synthetic-test-only',
    KITE_API_KEY: 'synthetic_kite_key',
    KITE_API_SECRET: 'synthetic_kite_secret',
    KITE_REDIRECT_URL:
      'http://127.0.0.1:4100/api/v1/account/broker-connections/kite/callback',
    KITE_PERMISSION_REFERENCE: 'SYNTHETIC-E2E-NO-LIVE-PERMISSION',
    RESEARCH_AUTO_ENABLED: 'false',
    STORY_IMAGE_PROVIDER: env.F360_TEST_STORY_IMAGE === '1' ? 'openai' : 'off',
    ...(env.F360_TEST_STORY_IMAGE === '1'
      ? {
          STORY_IMAGE_MODEL: 'synthetic-story-image-model',
          OPENAI_API_KEY: 'synthetic-story-image-key-never-send',
        }
      : {}),
    DATABASE_URL: database.href,
    MIGRATION_DATABASE_URL: database.href,
    MONGODB_URI: mongo.href,
    OPS_AUTH_MODE:
      env.F360_TEST_NAMED_OPERATORS === '1' ? 'named' : 'bootstrap',
    ...(env.F360_TEST_NAMED_OPERATORS === '1' ? { AI_PROVIDER: 'query' } : {}),
    API_HOST: '127.0.0.1',
    API_PORT: '4100',
    WEB_ORIGIN: env.E2E_WEB_URL,
    AI_PROVIDER: 'query',
  });
  if (env.F360_TEST_INDIA_GDP_ARCHIVE === '1') {
    const { installSyntheticIndiaGdpArchive } =
      await import('./india-gdp-archive-simulation.mjs');
    installSyntheticIndiaGdpArchive();
  }
  if (env.F360_TEST_ANGEL === '1') {
    const { installSyntheticAngel } = await import('./angel-simulation.mjs');
    installSyntheticAngel();
  }
  if (env.F360_TEST_UPSTOX === '1') {
    const { installSyntheticUpstox } = await import('./upstox-simulation.mjs');
    installSyntheticUpstox();
  }
  if (env.F360_TEST_KITE === '1') {
    const { installSyntheticKite } = await import('./kite-simulation.mjs');
    installSyntheticKite();
  }
  if (env.F360_TEST_STORY_IMAGE === '1') {
    const { installSyntheticStoryImage } =
      await import('./story-image-simulation.mjs');
    await installSyntheticStoryImage(pool, schema);
  }
  if (env.F360_TEST_WORLD_BANK === '1') {
    const { installSyntheticWorldBank } =
      await import('./world-bank-simulation.mjs');
    await installSyntheticWorldBank(pool, schema);
  }
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
  if (env.F360_TEST_NAMED_OPERATORS === '1') {
    const { provisionNamedAdministrator } =
      await import('../../../apps/api/dist/provision-operator.js');
    namedCredentials = {
      username: 'synthetic_admin',
      password: randomBytes(24).toString('hex'),
    };
    await provisionNamedAdministrator(database.href, namedCredentials);
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
    const { MaterialWorker } =
      await import('../../../apps/api/dist/material-worker.js');
    const { DeploymentMonitoringWorker } =
      await import('../../../apps/api/dist/deployment-monitoring.js');
    await app.get(DeploymentMonitoringWorker).onApplicationShutdown();
    await app.get(MaterialWorker).onApplicationShutdown();
    await app.get(ReportWorker).onApplicationShutdown();
    await app.get(LibraryReminderWorker).onApplicationShutdown();
  }
  if (!cancelled)
    notify({
      apiOrigin: await app.getUrl(),
      privateDataKeys: {
        PRIVATE_IDENTITY_LOOKUP_KEY: process.env.PRIVATE_IDENTITY_LOOKUP_KEY,
        PRIVATE_DATA_ACTIVE_KEY: process.env.PRIVATE_DATA_ACTIVE_KEY,
        PRIVATE_DATA_KEYS: process.env.PRIVATE_DATA_KEYS,
      },
      databaseUrl: database.href,
      schema,
      ...(namedCredentials ? { namedCredentials } : {}),
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
