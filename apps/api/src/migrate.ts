import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { readConfig } from './config.js';
const config = readConfig(process.env);
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(360001)');
  await client.query(await readFile(new URL('../../../infra/migrations/001_virtual_journey.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Virtual journey schema is ready. Existing data preserved.');
} catch {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed. Check database availability and permissions.');
  process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
