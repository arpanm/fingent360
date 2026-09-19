// Explicit selected-test helper. Real controller/provider parser and owned stores;
// only the provider HTTP response is synthetic. Never imported by discovery.
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
const apiRequire = createRequire(
  new URL('../../../apps/api/package.json', import.meta.url),
);
apiRequire('reflect-metadata');
const { AccountStore } = await import('../../../apps/api/dist/accounts.js');
const { AssistanceController } =
  await import('../../../apps/api/dist/assistance.js');
const { generateAssistance } =
  await import('../../../apps/api/dist/ai-providers.js');
const lines = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
let pool,
  store,
  stage = 'owned fixture input';
try {
  const first = await lines.next();
  if (first.done || first.value.length > 20000) throw Error('Invalid input');
  const input = JSON.parse(first.value),
    url = new URL(input.databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^e2e_feedback_[a-f0-9]{32}$/.test(input.schema)
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
    throw Error('Wrong schema');
  stage = 'controller setup';
  let calls = 0,
    network = 0;
  globalThis.fetch = async () => {
    network++;
    throw Error('External network forbidden');
  };
  store = new AccountStore({
    DATABASE_URL: url.href,
    WEB_ORIGIN: input.origin,
    ...input.privateDataKeys,
  });
  const raw = JSON.stringify({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: '{"suggestions":[]}' }],
      },
    ],
  });
  const controller = new AssistanceController(
    store,
    {
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic-never-sent',
      OPENAI_MODEL: 'synthetic-history-fallback',
    },
    (config, provider, instructions, material, _fetcher, observe) =>
      generateAssistance(
        config,
        provider,
        instructions,
        material,
        async () => {
          calls++;
          // Wait for real dispatch admission to commit its history row before the
          // simulated response arrives; avoid an arbitrary fixed transport delay.
          let committed = false;
          for (let attempt = 0; attempt < 100; attempt++) {
            const row = await pool.query(
              "SELECT 1 FROM private_ai_history WHERE user_id=$1 AND status='running'",
              [input.userId],
            );
            if (row.rowCount) {
              committed = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          if (!committed) throw Error('History admission not committed');
          return new Response(raw, { status: 200 });
        },
        observe,
      ),
  );
  stage = 'history dispatch and fallback';
  const result = await controller.suggest(
    {
      query: 'Synthetic authorization goal',
      scope: 'goals',
      provider: 'openai',
      useHistory: true,
    },
    input.origin,
    input.cookie,
  );
  process.stdout.write(JSON.stringify({ calls, network, result }) + '\n');
} catch {
  // Never print input, database credentials, cookies or driver diagnostics.
  process.stdout.write(
    JSON.stringify({
      failure: 'Owned private-history transport fixture failed.',
      stage,
    }) + '\n',
  );
  process.exitCode = 1;
} finally {
  await store?.onApplicationShutdown();
  await pool?.end();
  process.stdin.destroy();
}
