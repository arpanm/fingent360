import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  connectionDatabase,
  connectionHeaders,
} from './research-connection-fixture';
import {
  FeedItemSchema,
  DiscoveryOperationsSchema,
  BEA_FEED,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import { operatorKey } from './operator';
export const beaDate = '2026-09-13T23:47:04.397755Z';
export const beaRaw = () =>
  readFile(
    new URL(
      '../../../apps/api/test/fixtures/research/bea-rss.xml',
      import.meta.url,
    ),
    'utf8',
  );
// Lazy only: test discovery opens no file, database, app, provider or socket.
export async function beaStorage(sandbox: FeedbackSandbox) {
  const check = await connectionDatabase(sandbox);
  await check.end();
  const local = parseEnv(
    await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
  );
  const env = { ...local, ...process.env };
  const url = new URL(env.MONGODB_URI!);
  if (
    url.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  )
    throw Error('BEA tests require owned loopback MongoDB.');
  if (!url.searchParams.has('authSource'))
    url.searchParams.set('authSource', url.pathname.slice(1) || 'admin');
  url.pathname = `/${sandbox.schema}`;
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const [{ DiscoveryStore }, { readConfig }] = await Promise.all([
    import(
      new URL('../../../apps/api/dist/discovery.js', import.meta.url).href
    ),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  const store = new DiscoveryStore(
    readConfig({
      ...env,
      DATABASE_URL: sandbox.databaseUrl,
      MONGODB_URI: url.href,
      WEB_ORIGIN: connectionHeaders.Origin,
    }),
  );
  const { MongoClient } = require('mongodb');
  const mongo = new MongoClient(url.href, { serverSelectionTimeoutMS: 3000 });
  return {
    store,
    mongo,
    close: async () => {
      await store.onApplicationShutdown();
      await mongo.close();
    },
  };
}
/** Replay the exact parent-captured HTTP body through the actual bounded fetch/parser/store. Transport is explicitly simulated. */
export async function ingestBea(
  sandbox: FeedbackSandbox,
  body?: string,
  sources = ['bea'],
) {
  const storage = await beaStorage(sandbox),
    xml = body ?? (await beaRaw()),
    original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      if (String(input) !== BEA_FEED)
        throw Error('Unexpected provider request in captured BEA fixture.');
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    };
    return await storage.store.refresh(sources);
  } finally {
    globalThis.fetch = original;
    await storage.close();
  }
}
export async function beaOperator(request: APIRequestContext) {
  const response = await request.post('/api/v1/ops/session', {
    headers: connectionHeaders,
    data: { key: await operatorKey() },
  });
  if (!response.ok()) throw Error(`BEA operator fixture: ${response.status()}`);
}
export async function reviewBea(
  request: APIRequestContext,
  item: FeedItem,
  status: 'published' | 'withdrawn',
) {
  const response = await request.put(`/api/v1/ops/discovery/items/${item.id}`, {
    headers: connectionHeaders,
    data: {
      expectedVersion: item.version,
      status,
      correctionNote:
        'Isolated acceptance review of actual captured BEA headline metadata.',
    },
  });
  if (!response.ok())
    throw Error(`BEA editorial fixture: ${response.status()}`);
  return FeedItemSchema.parse(await response.json());
}
export async function setupBea(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
  publish = true,
) {
  await ingestBea(sandbox);
  await beaOperator(request);
  const state = DiscoveryOperationsSchema.parse(
    await (await request.get('/api/v1/ops/discovery/items')).json(),
  );
  const item = state.items.find(
    (i) =>
      i.id.startsWith('bea-') &&
      i.title === 'U.S. International Trade in Goods and Services, July 2026',
  );
  if (!item) throw Error('Captured BEA release not ingested.');
  return publish ? reviewBea(request, item, 'published') : item;
}
export async function beaBrowserCall(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
export function beaConnectionInput(source: FeedItem, goalId?: string) {
  return {
    action: 'create',
    requestId: randomUUID(),
    expectedVersion: 0,
    source: {
      itemId: source.id,
      version: source.version,
      sourceHash: source.sourceHash,
    },
    target: goalId
      ? { kind: 'goal', id: goalId, version: 1 }
      : { kind: 'holding', id: 'INE002A01018', version: 1 },
    note: 'My question about this BEA edition, not a claim of investment impact.',
    storageConsent: true,
  };
}
export async function bundledBea() {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const item = bundle.feed
    .map((v: unknown) => FeedItemSchema.parse(v))
    .find((i: FeedItem) => i.id.startsWith('bea-') && i.status === 'published');
  if (!item)
    throw Error(
      'Parent must publish genuine BEA releases and run pnpm android:snapshot before BEA packaged acceptance.',
    );
  return { bundle, item: FeedItemSchema.parse(item) };
}
