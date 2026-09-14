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
  OIL_BENCHMARK_SOURCE,
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_PARSER,
  OilBenchmarkEditionSchema,
  OilBenchmarkOperationsSchema,
  OilBenchmarkReviewReceiptSchema,
  parseOilBenchmarks,
} from '../../../packages/contracts/src/index';
export {
  expect,
  retentionHeaders as oilHeaders,
  loginRetentionOperator as oilOperator,
};
export const test = isolated.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/oil-benchmarks(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
/** Documented layout, synthetic numbers only. No download or work at import time. */
export async function oilWorkbook(
  options: {
    brent?: string;
    truncate?: boolean;
    unit?: string;
    nextYear?: boolean;
  } = {},
) {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/oil-benchmarks.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    rows: Array<{ period: string; brent: string; wti: string | null }>;
  };
  const require = createRequire(
    new URL('../../../packages/contracts/package.json', import.meta.url),
  );
  const { zipSync, strToU8 } = require('fflate') as {
    zipSync: (files: Record<string, Uint8Array>) => Uint8Array;
    strToU8: (text: string) => Uint8Array;
  };
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const texts = [
    'World Bank Commodity Price Data (The Pink Sheet)',
    'monthly prices in nominal US dollars, 1960 to present',
    `Updated on March 02, ${options.nextYear ? '2001' : '2000'}`,
    'Crude oil, Brent',
    'Crude oil, WTI',
    options.unit ?? '($/bbl)',
    '…',
  ];
  const cell = (r: string, value: string | null) =>
    value === null
      ? `<c r="${r}" t="s"><v>6</v></c>`
      : `<c r="${r}" s="0"><v>${value}</v></c>`;
  const extended = options.nextYear
    ? [
        ...fixture.rows,
        ...Array.from({ length: 10 }, (_, i) => ({
          period: `2000M${String(i + 3).padStart(2, '0')}`,
          brent: '14.0',
          wti: '-1.0',
        })),
        ...fixture.rows.map((row) => ({
          ...row,
          period: row.period.replace('2000', '2001'),
        })),
      ]
    : fixture.rows;
  const rows = options.truncate ? extended.slice(0, 1) : extended;
  const parts: Record<string, string> = {
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Monthly Prices" sheetId="1" r:id="r1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst xmlns="${ns}">${texts.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`,
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><numFmts><numFmt numFmtId="164" formatCode="0.0"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row><row r="4"><c r="A4" t="s"><v>2</v></c></row><row r="5"><c r="C5" t="s"><v>3</v></c><c r="E5" t="s"><v>4</v></c></row><row r="6"><c r="C6" t="s"><v>5</v></c><c r="E6" t="s"><v>5</v></c></row>${rows.map((row, i) => `<row r="${i + 7}"><c r="A${i + 7}" t="inlineStr"><is><t>${row.period}</t></is></c>${cell('C' + (i + 7), i === 0 && options.brent !== undefined ? options.brent : row.brent)}${cell('E' + (i + 7), row.wti)}</row>`).join('')}</sheetData></worksheet>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(parts).map(([key, value]) => [key, strToU8(value)]),
    ),
  );
}
export function oilRaw(
  bytes: Uint8Array,
  retrievedAt = new Date().toISOString(),
) {
  return {
    url: OIL_BENCHMARK_URL,
    body: Buffer.from(bytes).toString('base64'),
    retrievedAt,
    hash: createHash('sha256')
      .update(`${OIL_BENCHMARK_URL}\n${retrievedAt}\n`)
      .update(bytes)
      .digest('hex'),
  };
}
export async function oilDatabase(sandbox: FeedbackSandbox) {
  const verified = await ownedRetentionDatabase(sandbox);
  await verified.end();
  // max:1 pins BEGIN/ROLLBACK to one owned connection. Wait observers use their own pool.
  return connectionDatabase(sandbox);
}
/** Actual parser/store/Mongo/Postgres; only the fixed provider transport is synthetic. */
export async function oilStorage(
  sandbox: FeedbackSandbox,
  fetchSource: () => Promise<ReturnType<typeof oilRaw>>,
) {
  const checked = await oilDatabase(sandbox);
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
    throw Error('Oil fixtures require configured owned MongoDB.');
  }
  if (
    mongoUrl.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(mongoUrl.hostname)
  )
    throw Error('Oil fixtures require owned loopback MongoDB.');
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
  const [{ OilBenchmarkStore }, { readConfig }] = await Promise.all([
    import(
      new URL('../../../apps/api/dist/oil-benchmarks.js', import.meta.url).href
    ),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  const store = new OilBenchmarkStore(
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
export async function captureOilFixture(
  sandbox: FeedbackSandbox,
  body?: Uint8Array,
) {
  const raw = oilRaw(body ?? (await oilWorkbook())),
    storage = await oilStorage(sandbox, async () => raw);
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
export async function seedOilEdition(
  sandbox: FeedbackSandbox,
  body?: Uint8Array,
) {
  const raw = oilRaw(body ?? (await oilWorkbook())),
    parsed = parseOilBenchmarks(Buffer.from(raw.body, 'base64')),
    pool = await oilDatabase(sandbox);
  try {
    await pool.query('BEGIN');
    const current = (
      await pool.query(
        'SELECT edition FROM oil_benchmark_head WHERE id=$1 FOR UPDATE',
        [OIL_BENCHMARK_SOURCE],
      )
    ).rows[0];
    const value = OilBenchmarkEditionSchema.parse({
      edition: (current.edition ?? 0) + 1,
      parserVersion: OIL_BENCHMARK_PARSER,
      sourceId: OIL_BENCHMARK_SOURCE,
      sourceUrl: OIL_BENCHMARK_URL,
      sourceHash: raw.hash,
      retrievedAt: raw.retrievedAt,
      reportedUpdatedOn: parsed.reportedUpdatedOn,
      unit: 'USD-per-barrel',
      region: 'global-benchmarks',
      knownAt: null,
      vintageBasis: 'retrieval-revision-only',
      precision: 1,
      transformation: 'workbook-display-half-away-from-zero',
      observations: parsed.observations,
    });
    await pool.query(
      'INSERT INTO oil_benchmark_editions(edition,retrieved_at,source_hash,canonical_hash,payload) VALUES($1,$2,$3,$4,$5)',
      [
        value.edition,
        raw.retrievedAt,
        raw.hash,
        createHash('sha256')
          .update(
            JSON.stringify(
              parsed.observations.map(({ series, period, value }) => ({
                series,
                period,
                value,
              })),
            ),
          )
          .digest('hex'),
        value,
      ],
    );
    for (const row of value.observations)
      await pool.query(
        'INSERT INTO oil_benchmark_observations(edition,series,period,value,source_value) VALUES($1,$2,$3,$4,$5)',
        [value.edition, row.series, row.period, row.value, row.sourceValue],
      );
    await pool.query(
      'UPDATE oil_benchmark_head SET version=version+1,edition=$2,checked_at=$3 WHERE id=$1',
      [OIL_BENCHMARK_SOURCE, value.edition, raw.retrievedAt],
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
export async function reviewOil(
  request: APIRequestContext,
  status: 'published' | 'withdrawn' = 'published',
) {
  const response = await request.get('/api/v1/ops/oil-benchmarks');
  expect(response.status()).toBe(200);
  const state = OilBenchmarkOperationsSchema.parse(await response.json());
  const body = {
    requestId: randomUUID(),
    expectedVersion: state.head.version,
    status,
    correctionNote:
      'Synthetic isolated acceptance review; these are not actual source observations.',
  };
  const saved = await request.put('/api/v1/ops/oil-benchmarks/review', {
    headers: retentionHeaders,
    data: body,
  });
  expect(saved.status()).toBe(200);
  return {
    body,
    receipt: OilBenchmarkReviewReceiptSchema.parse(await saved.json()),
  };
}
export async function openOilOperations(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Oil benchmarks', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'Oil benchmark operations',
    exact: true,
  });
  await expect(
    region.getByRole('button', {
      name: 'Reload oil-benchmark state',
      exact: true,
    }),
  ).toBeEnabled();
  return region;
}
