import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import type { FeedbackSandbox } from './feedback-fixture';
export async function automaticPublicationConfig(sandbox: FeedbackSandbox) {
  if (!/^e2e_feedback_[a-f0-9]{32}$/.test(sandbox.schema))
    throw Error('Owned research schema required.');
  const local = parseEnv(
      await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
    ),
    uri = new URL(process.env.MONGODB_URI ?? local.MONGODB_URI!);
  if (
    uri.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname)
  )
    throw Error('Local Mongo fixture only.');
  if (!uri.searchParams.has('authSource'))
    uri.searchParams.set('authSource', uri.pathname.slice(1) || 'admin');
  uri.pathname = '/' + sandbox.schema;
  const require = createRequire(
      new URL('../../../apps/api/package.json', import.meta.url),
    ),
    { MongoClient } = require('mongodb');
  const configUrl = new URL('../../../apps/api/dist/config.js', import.meta.url)
      .href,
    { readConfig } = await import(configUrl);
  return {
    config: readConfig({
      DATABASE_URL: sandbox.databaseUrl,
      MONGODB_URI: uri.href,
      OPS_AUTH_MODE: 'bootstrap',
    }),
    mongo: new MongoClient(uri.href),
  };
}
