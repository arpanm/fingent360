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
  ECB_RATE_SOURCE,
  ECB_RATE_URL,
  ECB_RATE_PARSER,
  EcbRateEditionSchema,
  EcbRateOperationsSchema,
  EcbRateReviewReceiptSchema,
  parseEcbRates,
} from '../../../packages/contracts/src/index';
export {
  expect,
  retentionHeaders as ecbHeaders,
  loginRetentionOperator as ecbOperator,
};
export const test = isolated.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/policy-rates(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
export const ecbXml = () =>
  readFile(
    new URL(
      '../../../packages/contracts/test/fixtures/ecb-policy-rates.xml',
      import.meta.url,
    ),
    'utf8',
  );
export function ecbRaw(body: string, retrievedAt = new Date().toISOString()) {
  return {
    url: ECB_RATE_URL,
    body,
    retrievedAt,
    hash: createHash('sha256')
      .update(`${ECB_RATE_URL}\n${retrievedAt}\n${body}`)
      .digest('hex'),
  };
}
export async function ecbDatabase(sandbox: FeedbackSandbox) {
  const verified = await ownedRetentionDatabase(sandbox);
  await verified.end();
  // max:1 pins BEGIN/ROLLBACK to one owned connection. Wait observers use their own pool.
  return connectionDatabase(sandbox);
}
/** Actual parser/store/Mongo/Postgres; only the fixed provider transport is synthetic. */
export async function ecbStorage(
  sandbox: FeedbackSandbox,
  fetchSource: () => Promise<ReturnType<typeof ecbRaw>>,
) {
  const checked = await ecbDatabase(sandbox);
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
    throw Error('ECB fixtures require configured owned MongoDB.');
  }
  if (
    mongoUrl.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(mongoUrl.hostname)
  )
    throw Error('ECB fixtures require owned loopback MongoDB.');
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
  const [{ EcbRateStore }, { readConfig }] = await Promise.all([
    import(
      new URL('../../../apps/api/dist/ecb-rates.js', import.meta.url).href
    ),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  const store = new EcbRateStore(
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
export async function captureEcbFixture(
  sandbox: FeedbackSandbox,
  body?: string,
) {
  const raw = ecbRaw(body ?? (await ecbXml())),
    storage = await ecbStorage(sandbox, async () => raw);
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
export async function seedEcbEdition(sandbox: FeedbackSandbox, body?: string) {
  const raw = ecbRaw(body ?? (await ecbXml())),
    parsed = parseEcbRates(raw.body),
    pool = await ecbDatabase(sandbox);
  try {
    await pool.query('BEGIN');
    const current = (
      await pool.query(
        'SELECT edition FROM ecb_rate_head WHERE id=$1 FOR UPDATE',
        [ECB_RATE_SOURCE],
      )
    ).rows[0];
    const value = EcbRateEditionSchema.parse({
      edition: (current.edition ?? 0) + 1,
      parserVersion: ECB_RATE_PARSER,
      sourceId: ECB_RATE_SOURCE,
      sourceUrl: ECB_RATE_URL,
      sourceHash: raw.hash,
      retrievedAt: raw.retrievedAt,
      responsePreparedAt: parsed.responsePreparedAt,
      unit: 'percent-per-annum',
      region: 'euro-area',
      knownAt: null,
      vintageBasis: 'retrieval-revision-only',
      observations: parsed.observations,
    });
    await pool.query(
      'INSERT INTO ecb_rate_editions(edition,retrieved_at,source_hash,canonical_hash,payload) VALUES($1,$2,$3,$4,$5)',
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
        'INSERT INTO ecb_rate_observations(edition,series,effective_on,value) VALUES($1,$2,$3,$4)',
        [value.edition, row.series, row.effectiveOn, row.value],
      );
    await pool.query(
      'UPDATE ecb_rate_head SET version=version+1,edition=$2,checked_at=$3 WHERE id=$1',
      [ECB_RATE_SOURCE, value.edition, raw.retrievedAt],
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
export async function reviewEcb(
  request: APIRequestContext,
  status: 'published' | 'withdrawn' = 'published',
) {
  const response = await request.get('/api/v1/ops/policy-rates');
  expect(response.status()).toBe(200);
  const state = EcbRateOperationsSchema.parse(await response.json());
  const body = {
    requestId: randomUUID(),
    expectedVersion: state.head.version,
    status,
    correctionNote:
      'Synthetic isolated acceptance review; these are not actual ECB rate values.',
  };
  const saved = await request.put('/api/v1/ops/policy-rates/review', {
    headers: retentionHeaders,
    data: body,
  });
  expect(saved.status()).toBe(200);
  return {
    body,
    receipt: EcbRateReviewReceiptSchema.parse(await saved.json()),
  };
}
export async function openEcbOperations(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'ECB policy rates', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'ECB policy-rate operations',
    exact: true,
  });
  await expect(
    region.getByRole('button', {
      name: 'Reload policy-rate state',
      exact: true,
    }),
  ).toBeEnabled();
  return region;
}
