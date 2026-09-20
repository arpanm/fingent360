import { test, expect } from '../../helpers/app-fixture';
import { createHash, randomUUID } from 'node:crypto';
import {
  CcilLiquiditySchema,
  CcilLiquidityEditionSchema,
  CcilLiquidityListSchema,
  CCIL_LIQUIDITY_URL,
  parseCcilLiquidity,
} from '../../../../packages/contracts/src/index';
import {
  ccilLiquidityWorkbook,
  changedLiquidityWorkbook,
  captureLiquidity,
  reviewLiquidity,
} from '../../helpers/ccil-liquidity';
import {
  governanceFixture,
  governanceHeaders as headers,
} from '../../helpers/research-governance';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test('E2E-API-2320 CCIL workbook preserves source lexemes null depth and rejects altered structure and dates @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async () => {
  const data = parseCcilLiquidity(ccilLiquidityWorkbook());
  expect(data.rows[0]).toEqual({
    sourceRow: 2,
    securityDescription: '05.74 GS 2026',
    instrumentType: 'CENTRAL GOVERMENT',
    tradeDate: '2026-07-01',
    couponLabel: '5.74',
    settlementDate: '2026-07-02',
    metrics: [
      '1.34254584763383E-3',
      '0.13428571428571001',
      '0.363480128893651',
      '0.189999999999998',
      '4.9999999999997199E-2',
      null,
      null,
    ],
    comment: 'Orders Not Adding to 25Cr On Bid/Ask Side',
  });
  expect(data.rows[1]?.metrics).toEqual(Array(7).fill(null));
  expect(data.identity).toBe('source-description-only-no-isin');
  const changes: [string, (s: string) => string][] = [
    [
      'xl/sharedStrings.xml',
      (s) => s.replace('Average_Spread_Ratio', 'Unverified_Metric'),
    ],
    [
      'xl/worksheets/sheet1.xml',
      (s) => s.replace('<v>46204</v>', '<v>46234.5</v>'),
    ],
    [
      'xl/worksheets/sheet1.xml',
      (s) => s.replace('<v>46204</v>', '<v>46174</v>'),
    ],
    [
      'xl/worksheets/sheet1.xml',
      (s) => s.replace('<v>46205</v>', '<v>46203</v>'),
    ],
    [
      'xl/worksheets/sheet1.xml',
      (s) => s.replace('<v>5.74</v>', '<f>1+1</f><v>5.74</v>'),
    ],
    ['xl/worksheets/sheet1.xml', (s) => s.replace('r="B2"', 'r="A2"')],
    [
      'xl/workbook.xml',
      (s) => s.replace('<workbookPr/>', '<workbookPr date1904="1"/>'),
    ],
    [
      'xl/_rels/workbook.xml.rels',
      (s) =>
        s.replace(
          'Target="worksheets/sheet1.xml"',
          'TargetMode="External" Target="https://example.invalid/source"',
        ),
    ],
    ['xl/vbaProject.bin', () => 'Unexpected macro'],
  ];
  for (const [part, change] of changes)
    expect(() =>
      parseCcilLiquidity(changedLiquidityWorkbook(part, change)),
    ).toThrow();
  for (const row of [
    { ...data.rows[0], tradeDate: '2026-08-01' },
    { ...data.rows[0], settlementDate: '2026-06-30' },
    { ...data.rows[0], sourceRow: 3 },
  ])
    expect(
      CcilLiquiditySchema.safeParse({ ...data, rows: [row] }).success,
    ).toBe(false);
  expect(
    CcilLiquiditySchema.safeParse({
      ...data,
      rows: [data.rows[0], { ...data.rows[0], sourceRow: 3 }],
    }).success,
  ).toBe(false);
});
test('E2E-API-2321 CCIL default permission gate refuses retention and returns no public liquidity @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/ops/bond-liquidity/import', {
        headers,
        data: {
          requestId: randomUUID(),
          body: Buffer.from(ccilLiquidityWorkbook()).toString('base64'),
        },
      })
    ).status(),
  ).toBe(503);
  expect(await (await request.get('/api/v1/bond-liquidity')).json()).toEqual({
    enabled: false,
    editions: [],
    nextCursor: null,
  });
});
test.describe('Explicit synthetic liquidity permission and real storage', () => {
  test.use({ namedOperators: true, ccilLiquiditySimulation: true });
  test('E2E-API-2322 CCIL retained original hash idempotency independent review quarantine and withdrawal @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const actors = await governanceFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const bytes = ccilLiquidityWorkbook(),
        capture = await captureLiquidity(request, bytes);
      expect(capture.state).toBe('draft');
      expect(capture.hash).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
      expect(capture.sourceUrl).toBe(CCIL_LIQUIDITY_URL);
      expect(capture.data).toEqual(parseCcilLiquidity(bytes));
      const persistedRequestId: string = capture.id;
      expect(
        await captureLiquidity(request, bytes, persistedRequestId),
      ).toEqual(capture);
      const otherCredentials = {
        username: 'liquidity_' + randomUUID().slice(0, 8),
        password: 'Synthetic-liquidity-researcher-2026',
      };
      expect(
        (
          await request.post('/api/v1/ops/operators', {
            headers,
            data: { ...otherCredentials, role: 'researcher' },
          })
        ).status(),
      ).toBe(201);
      const other = await playwright.request.newContext({
        baseURL: feedbackSandbox.apiOrigin,
      });
      try {
        expect(
          (
            await other.post('/api/v1/ops/session', {
              headers,
              data: otherCredentials,
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await other.post('/api/v1/ops/bond-liquidity/import', {
              headers,
              data: {
                requestId: capture.id,
                body: Buffer.from(bytes).toString('base64'),
              },
            })
          ).status(),
        ).toBe(409);
      } finally {
        await other.dispose();
      }

      expect(
        (
          await request.post('/api/v1/ops/bond-liquidity/import', {
            headers,
            data: {
              requestId: capture.id,
              body: Buffer.from(ccilLiquidityWorkbook(1)).toString('base64'),
            },
          })
        ).status(),
      ).toBe(409);
      const evidence = await (
        await request.get(`/api/v1/ops/bond-liquidity/${capture.id}/evidence`)
      ).json();
      expect(Buffer.from(evidence.body, 'base64')).toEqual(Buffer.from(bytes));
      expect(
        (await (await request.get('/api/v1/bond-liquidity')).json()).editions,
      ).toEqual([]);
      const review = {
        requestId: randomUUID(),
        decision: 'publish',
        reason: 'TEST-SIMULATION independent raw workbook review.',
      };
      expect(
        (
          await request.post(
            `/api/v1/ops/bond-liquidity/${capture.id}/review`,
            { headers, data: review },
          )
        ).status(),
      ).toBe(403);
      const published = await actors.reviewer.post(
        `/api/v1/ops/bond-liquidity/${capture.id}/review`,
        { headers, data: review },
      );
      expect(published.status()).toBe(201);
      const publishedEdition = CcilLiquidityEditionSchema.parse(
        await published.json(),
      );
      expect(publishedEdition.state).toBe('published');
      expect(publishedEdition.sourceUrl).toBe(CCIL_LIQUIDITY_URL);
      expect(publishedEdition.data).toEqual(parseCcilLiquidity(bytes));
      expect(
        (
          await request.post(
            `/api/v1/ops/bond-liquidity/${capture.id}/review`,
            { headers, data: review },
          )
        ).status(),
      ).toBe(409);
      expect(
        (
          await actors.reviewer.post(
            `/api/v1/ops/bond-liquidity/${capture.id}/review`,
            { headers, data: review },
          )
        ).status(),
      ).toBe(201);
      expect(
        (
          await actors.reviewer.post(
            `/api/v1/ops/bond-liquidity/${capture.id}/review`,
            { headers, data: { ...review, decision: 'withdraw' } },
          )
        ).status(),
      ).toBe(409);
      const db = await connectionDatabase(feedbackSandbox);
      try {
        expect(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM ccil_liquidity_reviews WHERE edition_id=$1',
              [capture.id],
            )
          ).rows[0].n,
        ).toBe(1);
        await expect(
          db.query('UPDATE ccil_liquidity_editions SET error=$1 WHERE id=$2', [
            'changed',
            capture.id,
          ]),
        ).rejects.toThrow();
      } finally {
        await db.end();
      }
      const invalid = await captureLiquidity(
        request,
        changedLiquidityWorkbook('xl/sharedStrings.xml', (s) =>
          s.replace('Comments', 'Unsupported'),
        ),
      );
      expect(invalid.state).toBe('quarantined');
      expect(
        (
          await actors.reviewer.post(
            `/api/v1/ops/bond-liquidity/${invalid.id}/review`,
            { headers, data: { ...review, requestId: randomUUID() } },
          )
        ).status(),
      ).toBe(409);
      expect(
        CcilLiquidityListSchema.parse(
          await (await request.get('/api/v1/bond-liquidity')).json(),
        ).editions.map((e) => e.id),
      ).toEqual([capture.id]);
      await reviewLiquidity(actors.reviewer, capture.id, 'withdraw');
      expect(
        (await (await request.get('/api/v1/bond-liquidity/snapshot')).json())
          .editions,
      ).toEqual([]);
    } finally {
      await actors.reviewer.dispose();
    }
  });
  test('E2E-API-2323 CCIL ingress enforces fixed source canonical bytes origin and authenticated raw access @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const actors = await governanceFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    const anonymous = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      const captured = await captureLiquidity(request);
      expect(
        (
          await anonymous.get(
            `/api/v1/ops/bond-liquidity/${captured.id}/evidence`,
          )
        ).status(),
      ).toBe(401);
      for (const data of [
        { requestId: randomUUID(), body: '!!!!' },
        {
          requestId: randomUUID(),
          body: Buffer.alloc(2000001).toString('base64'),
        },
        {
          requestId: randomUUID(),
          sourceUrl: 'https://example.invalid/arbitrary.xlsx',
          body: Buffer.from(ccilLiquidityWorkbook()).toString('base64'),
        },
      ])
        expect(
          (
            await request.post('/api/v1/ops/bond-liquidity/import', {
              headers,
              data,
            })
          ).status(),
        ).toBe(400);
      expect(
        (
          await request.post('/api/v1/ops/bond-liquidity/import', {
            headers: { ...headers, Origin: 'https://example.invalid' },
            data: {
              requestId: randomUUID(),
              body: Buffer.from(ccilLiquidityWorkbook()).toString('base64'),
            },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await request.post('/api/v1/ops/bond-liquidity/fetch', {
            headers,
            data: {
              requestId: randomUUID(),
              body: Buffer.from(ccilLiquidityWorkbook()).toString('base64'),
            },
          })
        ).status(),
      ).toBe(400);
      expect(
        CcilLiquidityEditionSchema.safeParse({
          ...captured,
          state: 'published',
          reviewedAt: null,
        }).success,
      ).toBe(false);
      expect(
        CcilLiquidityEditionSchema.safeParse({
          ...captured,
          state: 'quarantined',
          error: 'failed',
        }).success,
      ).toBe(false);
    } finally {
      await anonymous.dispose();
      await actors.reviewer.dispose();
    }
  });
  test('E2E-API-2324 CCIL full history pagination and snapshot capacity cannot silently drop reviewed editions @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const actors = await governanceFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const e = await captureLiquidity(request);
        ids.push(e.id);
        await reviewLiquidity(actors.reviewer, e.id);
      }
      for (const path of [
        '/api/v1/bond-liquidity',
        '/api/v1/ops/bond-liquidity',
      ]) {
        const seen: string[] = [];
        let cursor: string | null = null;
        do {
          const response = await request.get(path, {
            params: cursor ? { cursor } : {},
          });
          expect(response.status()).toBe(200);
          const page = CcilLiquidityListSchema.parse(await response.json());
          seen.push(...page.editions.map((e) => e.id));
          cursor = page.nextCursor;
          expect(seen.length).toBeLessThanOrEqual(4);
        } while (cursor);
        expect(seen.sort()).toEqual(ids.slice().sort());
        expect(
          (await request.get(path, { params: { cursor: 'invalid' } })).status(),
        ).toBe(400);
      }
      expect(
        (await request.get('/api/v1/bond-liquidity/snapshot')).status(),
      ).toBe(503);
      await reviewLiquidity(actors.reviewer, ids[0]!, 'withdraw');
      expect(
        (await (await request.get('/api/v1/bond-liquidity/snapshot')).json())
          .editions,
      ).toHaveLength(3);
    } finally {
      await actors.reviewer.dispose();
    }
  });
  test('E2E-API-2325 CCIL upstream simulation exercises actual fixed-original fetch retention and source identity @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const actors = await governanceFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const id = randomUUID(),
        response = await request.post('/api/v1/ops/bond-liquidity/fetch', {
          headers,
          data: { requestId: id },
        });
      expect(response.status()).toBe(201);
      const capture = CcilLiquidityEditionSchema.parse(await response.json());
      expect(capture.sourceUrl).toBe(CCIL_LIQUIDITY_URL);
      expect(capture.data?.rows[0]?.metrics[0]).toBe('1.34254584763383E-3');
      const evidence = await (
        await request.get(`/api/v1/ops/bond-liquidity/${id}/evidence`)
      ).json();
      expect(
        createHash('sha256')
          .update(Buffer.from(evidence.body, 'base64'))
          .digest('hex'),
      ).toBe(capture.hash);
      expect(parseCcilLiquidity(Buffer.from(evidence.body, 'base64'))).toEqual(
        capture.data,
      );
      const db = await connectionDatabase(feedbackSandbox);
      try {
        await db.query(
          'UPDATE test_liquidity_provider SET enabled=false WHERE id=true',
        );
        const replay = await request.post('/api/v1/ops/bond-liquidity/fetch', {
          headers,
          data: { requestId: id },
        });
        expect(replay.status()).toBe(201);
        expect(CcilLiquidityEditionSchema.parse(await replay.json())).toEqual(
          capture,
        );
        expect(
          (
            await db.query(
              'SELECT calls FROM test_liquidity_provider WHERE id=true',
            )
          ).rows[0].calls,
        ).toBe(1);
        expect(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM ccil_liquidity_editions',
            )
          ).rows[0].n,
        ).toBe(1);
        const unavailable = randomUUID();
        expect(
          (
            await request.post('/api/v1/ops/bond-liquidity/fetch', {
              headers,
              data: { requestId: unavailable },
            })
          ).status(),
        ).toBe(503);
        expect(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM ccil_liquidity_editions',
            )
          ).rows[0].n,
        ).toBe(1);
        expect(
          (
            await request.post('/api/v1/ops/bond-liquidity/import', {
              headers,
              data: { requestId: id, body: evidence.body },
            })
          ).status(),
        ).toBe(409);
      } finally {
        await db.end();
      }

      await reviewLiquidity(actors.reviewer, id);
      expect(
        (await (await request.get('/api/v1/bond-liquidity')).json()).editions[0]
          .id,
      ).toBe(id);
    } finally {
      await actors.reviewer.dispose();
    }
  });
});
