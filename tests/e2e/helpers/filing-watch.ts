import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import type { FeedbackSandbox } from './feedback-fixture';
import { connectionDatabase } from './research-connection-fixture';
import { retentionHeaders } from './retention';
import { test as base } from './feedback-fixture';
export { expect } from './feedback-fixture';
export { retentionHeaders } from './retention';
export { indiaActors } from './india-macro';
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await use(context);
  },
});
export const filingRights =
  'TEST-SIMULATION original source format only, no NSE retention/distribution licence asserted.';
/** Actual production worker/tables; only upstream source responses are simulated during explicit user-run tests. */
export async function runFilingTick(
  sandbox: FeedbackSandbox,
  originals: Record<string, string | Error>,
  beforeResponse?: () => Promise<void>,
  sourceId:
    'equity-filing-watch' | 'equity-filing-discovery' = 'equity-filing-watch',
) {
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const env = {
      ...parseEnv(
        await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
      ),
      ...process.env,
    },
    uri = new URL(env.MONGODB_URI!);
  if (
    uri.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)
  )
    throw Error('Owned loopback MongoDB required.');
  if (!uri.searchParams.has('authSource'))
    uri.searchParams.set('authSource', uri.pathname.slice(1) || 'admin');
  uri.pathname = '/' + sandbox.schema;
  const { readConfig } = await import(
      new URL('../../../apps/api/dist/config.js', import.meta.url).href
    ),
    { ResearchAutoStore } = await import(
      new URL('../../../apps/api/dist/research-auto.js', import.meta.url).href
    ),
    { DiscoveryStore } = await import(
      new URL('../../../apps/api/dist/discovery.js', import.meta.url).href
    ),
    config = readConfig({
      DATABASE_URL: sandbox.databaseUrl,
      MONGODB_URI: uri.href,
      WEB_ORIGIN: retentionHeaders.Origin,
    }),
    discovery = new DiscoveryStore(config),
    worker = new ResearchAutoStore(config, discovery, true),
    pool = await connectionDatabase(sandbox),
    savedFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    await beforeResponse?.();
    const value = originals[String(input)];
    if (value === undefined)
      throw Error('Unexpected original URL in isolated source simulation.');
    if (value instanceof Error) throw value;
    return new Response(value, { status: 200 });
  };
  try {
    await worker.initialize();
    await pool.query(
      'UPDATE research_auto_schedules SET enabled=false WHERE source_id<>$1',
      [sourceId],
    );
    await pool.query(
      'UPDATE research_auto_schedules SET next_at=now() WHERE source_id=$1',
      [sourceId],
    );
    await worker.tick();
    return calls;
  } finally {
    globalThis.fetch = savedFetch;
    await Promise.allSettled([
      worker.onApplicationShutdown(),
      discovery.onApplicationShutdown(),
      pool.end(),
    ]);
  }
}
