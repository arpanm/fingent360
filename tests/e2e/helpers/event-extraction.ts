import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { test, expect, eventHeaders, eventFixture } from './event-fixture';
import {
  connectionDatabase,
  seedConnectionSource,
} from './research-connection-fixture';
import {
  EventExtractionViewSchema,
  type EventExtractionView,
  type FeedItem,
} from '../../../packages/contracts/src/index';

export { test, expect, eventHeaders as extractionHeaders };
export const extractionDatabase = connectionDatabase;
export const extractionPath = '/api/v1/ops/event-extractions';
export const extractionInput = (
  source: FeedItem,
  method: 'template' | 'auto' | 'openai' = 'template',
) => ({
  sourceId: source.id,
  expectedVersion: source.version,
  sourceHash: source.sourceHash,
  method,
});
/** Actual dated public-bundle source, copied only into the validated owned canonical schema.
 * This does not claim to ingest a new provider capture or create Mongo evidence. */
export async function extractionFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  if (sandbox.namedCredentials) {
    const source = await seedConnectionSource(sandbox);
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers: eventHeaders,
          data: sandbox.namedCredentials,
        })
      ).status(),
    ).toBe(200);
    return { source };
  }
  const { source } = await eventFixture(request, sandbox);
  return { source };
}
export async function prepareExtraction(
  request: APIRequestContext,
  source: FeedItem,
  requestId: string = randomUUID(),
) {
  // Explicit template avoids any inherited real provider configuration.
  const response = await request.put(`${extractionPath}/${requestId}`, {
    headers: eventHeaders,
    data: extractionInput(source),
  });
  expect(response.status(), await response.text()).toBe(200);
  return EventExtractionViewSchema.parse(await response.json());
}
export function extractionDraft(view: EventExtractionView) {
  if (!view.attempt.candidate)
    throw Error('A completed owned candidate is required for this fixture.');
  return {
    requestId: randomUUID(),
    kind: 'draft' as const,
    reason: 'Synthetic human-reviewed event draft acceptance.',
    editorial: {
      title: 'Synthetic human-edited event draft',
      family: 'Source context',
      geography: ['Unknown'],
      claimKind: 'inference' as const,
      explanation:
        'Synthetic explicit human context, awaiting separate publication review. No financial impact asserted.',
      announcedAt: null,
      effectiveAt: null,
      citations: view.attempt.candidate.excerpts.map((excerpt) => ({
        sourceId: view.attempt.source.id,
        version: view.attempt.source.version,
        hash: view.attempt.source.hash,
        field: excerpt.field,
        quote: excerpt.quote,
      })),
      links: [],
    },
  };
}
type Authorize = (client?: unknown) => Promise<unknown>;
type InjectedDispatch = (
  config: unknown,
  provider: 'openai' | 'gemini' | 'anthropic',
  instructions: string,
  material: string,
) => Promise<string>;
type OwnedStore = {
  prepare(
    id: string,
    body: unknown,
    authorize: Authorize,
  ): Promise<EventExtractionView>;
  read(id: string, authorize: Authorize): Promise<EventExtractionView>;
  decide(
    id: string,
    body: unknown,
    authorize: Authorize,
  ): Promise<EventExtractionView>;
  onApplicationShutdown(): Promise<void>;
};
/** Real store/auth/transactions; only dispatch is injected. No actual provider key is loaded.
 * All module loading, configuration and connections happen inside a running test. */
export async function extractionStorage(
  sandbox: FeedbackSandbox,
  request: APIRequestContext,
  dispatch: InjectedDispatch,
  options: { remote?: boolean } = {},
) {
  const check = await connectionDatabase(sandbox);
  await check.end();
  const cookies = (await request.storageState()).cookies.filter(
    (cookie) => cookie.name === 'f360_ops',
  );
  if (cookies.length !== 1)
    throw Error(
      'Direct extraction fixture requires its actual owned operator session.',
    );
  const cookie = `f360_ops=${cookies[0]!.value}`;
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const [
    { EventExtractionStore },
    { EventStore },
    { OperatorStore },
    { readConfig },
  ] = await Promise.all([
    import(
      new URL('../../../apps/api/dist/event-extraction.js', import.meta.url)
        .href
    ),
    import(new URL('../../../apps/api/dist/events.js', import.meta.url).href),
    import(new URL('../../../apps/api/dist/operator.js', import.meta.url).href),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  // This module uses PostgreSQL only. The required, unused Mongo URL names the
  // same owned schema; no Mongo client or provider transport is constructed here.
  const config = readConfig({
    DATABASE_URL: sandbox.databaseUrl,
    MONGODB_URI: `mongodb://127.0.0.1/${sandbox.schema}`,
    WEB_ORIGIN: eventHeaders.Origin,
    OPS_AUTH_MODE: sandbox.namedCredentials ? 'named' : 'bootstrap',
    AI_PROVIDER: 'auto',
    ...(options.remote
      ? {
          OPENAI_API_KEY: 'synthetic-injected-dispatch-only',
          OPENAI_MODEL: 'synthetic-excerpt-selector',
        }
      : {}),
  });
  const ops = new OperatorStore(config),
    events = new EventStore(ops);
  const store: OwnedStore = new EventExtractionStore(config, events, dispatch);
  return {
    store,
    authorize: (client?: unknown) =>
      ops.permission(cookie, 'prepare', client) as Promise<unknown>,
    close: async () => {
      try {
        await store.onApplicationShutdown();
      } finally {
        await ops.onApplicationShutdown();
      }
    },
  };
}
export async function extractionFinancialDigest(sandbox: FeedbackSandbox) {
  const pool = await connectionDatabase(sandbox);
  try {
    const row = await pool.query(`SELECT jsonb_build_object(
      'holdings',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY user_id),'[]') FROM app_holdings t),
      'holdingRevisions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY user_id,version),'[]') FROM app_holdings_revisions t),
      'goals',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM app_goals t),
      'goalRevisions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY goal_id,version),'[]') FROM app_goal_revisions t),
      'allocations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY user_id),'[]') FROM app_goal_allocations t),
      'reports',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY job_id),'[]') FROM record_reports t)
    ) AS value`);
    return createHash('sha256')
      .update(JSON.stringify(row.rows[0].value))
      .digest('hex');
  } finally {
    await pool.end();
  }
}
