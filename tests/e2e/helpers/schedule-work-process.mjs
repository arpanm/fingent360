// Invoked only inside isolated schedule tests. A plain Node process loads the actual ESM worker
// method without Playwright's CommonJS transform. Never reads the application .env.
import { createRequire } from 'node:module';
import { ReportSchedulesStore } from '../../../apps/api/dist/report-schedules.js';

const { Pool } = createRequire(
  new URL('../../../apps/api/package.json', import.meta.url),
)('pg');
let pool;
try {
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk.toString();
    if (text.length > 100000) throw Error('Oversized fixture input');
  }
  const input = JSON.parse(text);
  const connection = new URL(input.databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(connection.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname) ||
    !/^e2e_feedback_[a-f0-9]+$/.test(input.schema)
  )
    throw Error('Owned loopback fixture required');
  pool = new Pool({
    connectionString: connection.href,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  if (
    (await pool.query('SELECT current_schema() AS schema')).rows[0]?.schema !==
    input.schema
  )
    throw Error('Fixture isolation mismatch');
  const store = new ReportSchedulesStore({
    transaction: async (work) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const value = await work(c);
        await c.query('COMMIT');
        return value;
      } catch (error) {
        await c.query('ROLLBACK');
        throw error;
      } finally {
        c.release();
      }
    },
  });
  await store.workOne();
} catch {
  // Driver failures may contain secrets. Parent reports a generic failure only.
  process.exitCode = 1;
} finally {
  await pool?.end();
}
