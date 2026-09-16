import { parseEnv } from 'node:util';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { oilRaw } from '../../helpers/oil-benchmarks';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test, expect } from '../../helpers/feedback-fixture';
import { indiaActors } from '../../helpers/india-macro';
import { retentionHeaders } from '../../helpers/retention';
import {
  commodityInput,
  commodityFixtureUrl,
} from '../../helpers/commodity-benchmarks';
import {
  CommodityPublicSchema,
  parseCommodityWorkbook,
} from '../../../../packages/contracts/src/commodity-benchmarks';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1710 retained reconstructed World Bank metals layout with actual source values independent review exact monthly history withdrawal @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = await commodityInput();
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request.post('/api/v1/ops/commodity-benchmarks/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
    const review = {
      requestId: randomUUID(),
      id: input.requestId,
      decision: 'publish',
      reason:
        'Independent original header unit source precision and attribution review.',
      rightsVerified: true,
    };
    expect(
      (
        await request.post('/api/v1/ops/commodity-benchmarks/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/commodity-benchmarks/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const result = await request.get('/api/v1/commodity-benchmarks');
    expect(result.status()).toBe(200);
    const view = CommodityPublicSchema.parse(await result.json());
    expect(view.receipt.retrievedAt).toBeNull();
    expect(view.receipt.reportedUpdatedOn).toBe('2026-09-02');
    for (const [series, value] of [
      ['GOLD', '4411'],
      ['COPPER', '14326'],
      ['SILVER', '65.4'],
    ])
      expect(
        view.receipt.observations.find(
          (v) => v.series === series && v.period === '2026-08',
        )?.value,
      ).toBe(value);
    const original = await (
      await request.get(
        '/api/v1/commodity-benchmarks/' + input.requestId + '/evidence',
      )
    ).json();
    expect(original.body).toBe(input.body);
    expect(
      (
        await reviewer.post('/api/v1/ops/commodity-benchmarks/review', {
          headers: retentionHeaders,
          data: {
            ...review,
            requestId: randomUUID(),
            decision: 'withdraw',
            rightsVerified: false,
          },
        })
      ).status(),
    ).toBe(201);
    expect((await request.get('/api/v1/commodity-benchmarks')).status()).toBe(
      404,
    );
    expect(
      (
        await request.get(
          '/api/v1/commodity-benchmarks/' + input.requestId + '/evidence',
        )
      ).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1711 unsupported retained original quarantines without publication @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = {
      ...(await commodityInput()),
      body: Buffer.from('Synthetic unsupported workbook bytes').toString(
        'base64',
      ),
    };
    const result = await request.post(
      '/api/v1/ops/commodity-benchmarks/capture',
      { headers: retentionHeaders, data: input },
    );
    expect(result.status()).toBe(201);
    expect((await result.json()).state).toBe('quarantined');
    const queue = await (
      await request.get('/api/v1/ops/commodity-benchmarks')
    ).json();
    expect(queue.items[0].error).toBeTruthy();
    expect(
      (
        await reviewer.post('/api/v1/ops/commodity-benchmarks/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            id: input.requestId,
            decision: 'publish',
            reason: 'Synthetic invalid original must never publish.',
            rightsVerified: true,
          },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1712 metals parser rejects substituted troy units and selected formulas @SRC-009 @TEST-SIMULATION', async () => {
  const require = createRequire(
    new URL('../../../../packages/contracts/package.json', import.meta.url),
  );
  const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
  const original = await readFile(commodityFixtureUrl);
  const units = unzipSync(original);
  units['xl/sharedStrings.xml'] = strToU8(
    strFromU8(units['xl/sharedStrings.xml']).replaceAll(
      '($/troy oz)',
      '($/oz)',
    ),
  );
  expect(() => parseCommodityWorkbook(zipSync(units))).toThrow();
  const formula = unzipSync(original);
  formula['xl/worksheets/sheet2.xml'] = strToU8(
    strFromU8(formula['xl/worksheets/sheet2.xml']).replace(
      /(<c\b[^>]*r="BR487"[^>]*>)/,
      '$1<f>1+1</f>',
    ),
  );
  expect(() => parseCommodityWorkbook(zipSync(formula))).toThrow();
});
test('E2E-API-1713 configured scheduled draft capture deduplicates original and rechecks pause after fetch @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox),
    require = createRequire(
      new URL('../../../../apps/api/package.json', import.meta.url),
    );
  require('reflect-metadata');
  const { MongoClient } = require('mongodb');
  const env = {
      ...parseEnv(
        await readFile(new URL('../../../../.env', import.meta.url), 'utf8'),
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
  uri.pathname = '/' + feedbackSandbox.schema;
  const mongo = new MongoClient(uri.href, { serverSelectionTimeoutMS: 3000 }),
    { captureScheduledCommodities } = await import(
      new URL(
        '../../../../apps/api/dist/commodity-benchmarks.js',
        import.meta.url,
      ).href
    );
  let calls = 0;
  const raw = oilRaw(await readFile(commodityFixtureUrl)),
    fetchSource = async () => {
      calls++;
      return raw;
    };
  const setting = {
    sourceId: 'commodity-benchmarks',
    enabled: true,
    intervalMinutes: 1440,
    rightsEvidence:
      'World Bank catalogue attribution and third-party conditions reviewed for test capture.',
  };
  try {
    await expect(
      captureScheduledCommodities(pool, mongo, fetchSource),
    ).rejects.toThrow();
    expect(calls).toBe(0);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: setting,
        })
      ).status(),
    ).toBe(200);
    await captureScheduledCommodities(pool, mongo, fetchSource);
    await captureScheduledCommodities(pool, mongo, fetchSource);
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM commodity_sources'))
        .rows[0].count,
    ).toBe(1);
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM commodity_reviews'))
        .rows[0].count,
    ).toBe(0);
    expect((await request.get('/api/v1/commodity-benchmarks')).status()).toBe(
      404,
    );
    await expect(
      captureScheduledCommodities(pool, mongo, async () => {
        expect(
          (
            await request.put('/api/v1/ops/research-auto', {
              headers: retentionHeaders,
              data: { ...setting, enabled: false },
            })
          ).status(),
        ).toBe(200);
        return raw;
      }),
    ).rejects.toThrow();
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM commodity_sources'))
        .rows[0].count,
    ).toBe(1);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: setting,
        })
      ).status(),
    ).toBe(200);
    await expect(
      captureScheduledCommodities(pool, mongo, async () => {
        expect(
          (
            await request.put('/api/v1/ops/research-auto', {
              headers: retentionHeaders,
              data: {
                ...setting,
                rightsEvidence: setting.rightsEvidence + ' Changed scope.',
              },
            })
          ).status(),
        ).toBe(200);
        return raw;
      }),
    ).rejects.toThrow();
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM commodity_sources'))
        .rows[0].count,
    ).toBe(1);
  } finally {
    await mongo.close();
    await pool.end();
    await reviewer.dispose();
  }
});
test('E2E-API-1714 equal-timestamp capture keyset visits every row once and rejects missing cursor @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  try {
    const ids = Array.from({ length: 21 }, () => randomUUID())
      .sort()
      .reverse();
    for (const id of ids)
      await pool.query(
        'INSERT INTO commodity_sources(id,actor_id,fingerprint,body_hash,error,created_at) VALUES($1,$2,$3,$4,$5,$6)',
        [
          id,
          'synthetic-pagination-actor',
          'a'.repeat(64),
          'b'.repeat(64),
          'Synthetic pagination quarantine, not source evidence.',
          '2026-09-15T00:00:00.000Z',
        ],
      );
    const first = await (
      await request.get('/api/v1/ops/commodity-benchmarks')
    ).json();
    expect(first.items.map((v: { id: string }) => v.id)).toEqual(
      ids.slice(0, 20),
    );
    const second = await (
      await request.get('/api/v1/ops/commodity-benchmarks?after=' + first.next)
    ).json();
    expect(second.items.map((v: { id: string }) => v.id)).toEqual(
      ids.slice(20),
    );
    expect(second.next).toBeNull();
    expect(
      (
        await request.get(
          '/api/v1/ops/commodity-benchmarks?after=' + randomUUID(),
        )
      ).status(),
    ).toBe(404);
  } finally {
    await pool.end();
    await reviewer.dispose();
  }
});
