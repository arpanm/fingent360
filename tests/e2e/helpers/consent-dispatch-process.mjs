// Explicit test-only transport simulation around the actual controller and real owned AccountStore.
// Invoked inside API-767 only; never reads .env or calls a provider.
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { AccountStore } from '../../../apps/api/dist/accounts.js';
import { AssistanceController } from '../../../apps/api/dist/assistance.js';
const lines = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
let pool, store;
try {
  const first = await lines.next();
  if (first.done || first.value.length > 20000)
    throw Error('Invalid fixture input');
  const input = JSON.parse(first.value),
    url = new URL(input.databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^e2e_feedback_[a-f0-9]+$/.test(input.schema)
  )
    throw Error('Owned fixture required');
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg');
  pool = new Pool({ connectionString: url.href, max: 1 });
  if (
    (await pool.query('SELECT current_schema() AS schema')).rows[0]?.schema !==
    input.schema
  )
    throw Error('Fixture isolation mismatch');
  let calls = 0,
    network = 0;
  globalThis.fetch = async () => {
    network++;
    throw Error('No network is permitted in this transport simulation');
  };
  store = new AccountStore({
    DATABASE_URL: url.href,
    WEB_ORIGIN: input.origin,
    ...input.privateDataKeys,
  });
  if (input.holdBeforeDispatch) {
    const transaction = store.transaction.bind(store);
    let firstTransaction = true;
    store.transaction = async (work) => {
      const value = await transaction(work);
      if (firstTransaction) {
        firstTransaction = false;
        process.stdout.write(JSON.stringify({ phase: 'loaded' }) + '\n');
        const command = await lines.next();
        if (command.done || command.value !== 'release')
          throw Error('Missing pre-dispatch release');
      }
      return value;
    };
  }
  const controller = new AssistanceController(
    store,
    {
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic-never-sent',
      OPENAI_MODEL: 'synthetic-transport',
    },
    async (_config, _provider, _instructions, context) => {
      calls++;
      const references = JSON.parse(context).references;
      if (!references.some((r) => r.sourceId.startsWith('goal-')))
        throw Error('Expected actual owned goal reference');
      process.stdout.write(JSON.stringify({ phase: 'dispatched' }) + '\n');
      if (input.hold) {
        const command = await lines.next();
        if (command.done || command.value !== 'release')
          throw Error('Missing release');
      }
      return JSON.stringify({ suggestions: references.slice(0, 5) });
    },
  );
  const result = await controller.suggest(
    {
      query: 'Synthetic research goal',
      scope: 'goals',
      provider: 'openai',
      useHistory: true,
    },
    input.origin,
    input.cookie,
  );
  process.stdout.write(
    JSON.stringify({ phase: 'result', calls, network, result }) + '\n',
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      phase: 'failure',
      kind: error?.name ?? 'Error',
      fields: Array.isArray(error?.issues)
        ? error.issues.map((issue) => issue.path.join('.'))
        : [],
      frames:
        typeof error?.stack === 'string'
          ? error.stack
              .split('\n')
              .slice(1)
              .filter(
                (line) =>
                  line.includes('/apps/api/') ||
                  line.includes('/packages/contracts/'),
              )
          : [],
    }) + '\n',
  );
  // Never print database credentials, session cookies or driver diagnostics.
  process.exitCode = 1;
} finally {
  await store?.onApplicationShutdown();
  await pool?.end();
  process.stdin.destroy();
}
