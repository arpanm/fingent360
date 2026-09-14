import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import type { APIRequestContext, Page } from '@playwright/test';
import { test as isolated } from './app-fixture';
import { expect } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  ownedRetentionDatabase,
  retentionHeaders,
  loginRetentionOperator,
} from './retention';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import {
  ECB_FX_SOURCE,
  ECB_FX_URL,
  ECB_FX_PARSER,
  EcbFxEditionSchema,
  EcbFxOperationsSchema,
  EcbFxReviewReceiptSchema,
  parseEcbFx,
  compareEcbFx,
} from '../../../packages/contracts/src/index';
export {
  expect,
  retentionHeaders as fxHeaders,
  loginRetentionOperator as fxOperator,
};
export const test = isolated.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/reference-fx(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
/** Official XML shape, explicitly synthetic numbers. No download at import time. */
export async function fxXml(
  options: { usd?: string; dropOldest?: boolean } = {},
) {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/ecb-fx.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { xml: string };
  let xml = fixture.xml;
  if (options.usd !== undefined)
    xml = xml.replace(
      /(currency=["']USD["']\s+rate=["'])[^"']+/,
      (_match, prefix: string) => prefix + options.usd,
    );
  if (options.dropOldest) {
    const blocks = [
      ...xml.matchAll(
        /<Cube time=["'][^"']+["']>\s*(?:<Cube currency=[^>]+\/>\s*)+<\/Cube>/g,
      ),
    ].map((match) => match[0]);
    const oldest = blocks.sort()[0];
    if (!oldest) throw Error('Synthetic date block missing.');
    xml = xml.replace(oldest, '');
  }
  return xml;
}
export function fxRaw(body: string, retrievedAt = new Date().toISOString()) {
  return {
    url: ECB_FX_URL,
    body,
    retrievedAt,
    hash: createHash('sha256')
      .update(`${ECB_FX_URL}\n${retrievedAt}\n${body}`)
      .digest('hex'),
  };
}
export async function fxDatabase(sandbox: FeedbackSandbox) {
  const verified = await ownedRetentionDatabase(sandbox);
  await verified.end();
  // max:1 pins BEGIN/ROLLBACK to one owned connection. Wait observers use their own pool.
  return connectionDatabase(sandbox);
}
/** Actual parser/store/Mongo/Postgres; only the fixed provider transport is synthetic. */
export async function fxStorage(
  sandbox: FeedbackSandbox,
  fetchSource: () => Promise<ReturnType<typeof fxRaw>>,
) {
  const checked = await fxDatabase(sandbox);
  await checked.end();
  const env = {
    ...parseEnv(
      await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
    ),
    ...process.env,
  };
  let mongoUrl: URL;
  try {
    mongoUrl = new URL(env.MONGODB_URI!);
  } catch {
    throw Error('FX fixtures require configured owned MongoDB.');
  }
  if (
    mongoUrl.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(mongoUrl.hostname)
  )
    throw Error('FX fixtures require owned loopback MongoDB.');
  if (!mongoUrl.searchParams.has('authSource'))
    mongoUrl.searchParams.set(
      'authSource',
      mongoUrl.pathname.slice(1) || 'admin',
    );
  mongoUrl.pathname = `/${sandbox.schema}`;
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const [{ EcbFxStore }, { readConfig }] = await Promise.all([
    import(new URL('../../../apps/api/dist/ecb-fx.js', import.meta.url).href),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  const store = new EcbFxStore(
    readConfig({
      ...env,
      DATABASE_URL: sandbox.databaseUrl,
      MONGODB_URI: mongoUrl.href,
      WEB_ORIGIN: retentionHeaders.Origin,
      OPS_AUTH_MODE: 'bootstrap',
    }),
    fetchSource,
  );
  return { store, close: () => store.onApplicationShutdown() as Promise<void> };
}
export async function captureFxFixture(
  sandbox: FeedbackSandbox,
  body?: string,
) {
  const raw = fxRaw(body ?? (await fxXml())),
    storage = await fxStorage(sandbox, async () => raw);
  try {
    return {
      raw,
      run: await storage.store.refresh(
        { requestId: randomUUID() },
        async () => {},
      ),
    };
  } finally {
    await storage.close();
  }
}
/** Explicit synthetic canonical history setup; it is not evidence of a provider fetch. */
export async function seedFxEdition(sandbox: FeedbackSandbox, body?: string) {
  const raw = fxRaw(body ?? (await fxXml())),
    parsed = parseEcbFx(raw.body),
    pool = await fxDatabase(sandbox);
  try {
    await pool.query('BEGIN');
    const current = (
      await pool.query(
        'SELECT edition FROM ecb_fx_head WHERE id=$1 FOR UPDATE',
        [ECB_FX_SOURCE],
      )
    ).rows[0];
    const prior = current.edition
      ? EcbFxEditionSchema.parse(
          (
            await pool.query(
              'SELECT payload FROM ecb_fx_editions WHERE edition=$1',
              [current.edition],
            )
          ).rows[0].payload,
        )
      : null;
    const value = EcbFxEditionSchema.parse({
      edition: (current.edition ?? 0) + 1,
      parserVersion: ECB_FX_PARSER,
      sourceId: ECB_FX_SOURCE,
      sourceUrl: ECB_FX_URL,
      sourceHash: raw.hash,
      retrievedAt: raw.retrievedAt,
      knownAt: null,
      vintageBasis: 'retrieval-revision-only',
      sourceWindow: 'rolling-90-day-file',
      windowStart: parsed.observations[0]!.date,
      windowEnd: parsed.observations[parsed.observations.length - 1]!.date,
      observations: parsed.observations,
      comparison: compareEcbFx(prior, parsed.observations),
    });
    await pool.query(
      'INSERT INTO ecb_fx_editions(edition,retrieved_at,source_hash,canonical_hash,payload) VALUES($1,$2,$3,$4,$5)',
      [
        value.edition,
        raw.retrievedAt,
        raw.hash,
        createHash('sha256')
          .update(JSON.stringify(parsed.observations))
          .digest('hex'),
        value,
      ],
    );
    for (const row of value.observations)
      await pool.query(
        'INSERT INTO ecb_fx_observations(edition,observed_on,usd_per_eur,inr_per_eur,usd_source,inr_source,derived_inr_per_usd) VALUES($1,$2,$3::text::numeric,$4::text::numeric,$3,$4,$5::numeric)',
        [
          value.edition,
          row.date,
          row.usdPerEur,
          row.inrPerEur,
          row.derivedInrPerUsd.value,
        ],
      );
    await pool.query(
      'UPDATE ecb_fx_head SET version=version+1,edition=$2,checked_at=$3 WHERE id=$1',
      [ECB_FX_SOURCE, value.edition, raw.retrievedAt],
    );
    await pool.query('COMMIT');
    return value;
  } finally {
    try {
      await pool.query('ROLLBACK');
    } finally {
      await pool.end();
    }
  }
}
export async function reviewFx(
  request: APIRequestContext,
  status: 'published' | 'withdrawn' = 'published',
) {
  const response = await request.get('/api/v1/ops/reference-fx');
  expect(response.status()).toBe(200);
  const state = EcbFxOperationsSchema.parse(await response.json());
  const body = {
    requestId: randomUUID(),
    expectedVersion: state.head.version,
    status,
    correctionNote:
      'Synthetic isolated acceptance review; these are not actual source observations.',
  };
  const saved = await request.put('/api/v1/ops/reference-fx/review', {
    headers: retentionHeaders,
    data: body,
  });
  expect(saved.status()).toBe(200);
  return { body, receipt: EcbFxReviewReceiptSchema.parse(await saved.json()) };
}
export async function openFxOperations(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reference exchange rates', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'FX operations',
    exact: true,
  });
  await expect(
    region.getByRole('button', { name: 'Reload FX state', exact: true }),
  ).toBeEnabled();
  return region;
}
