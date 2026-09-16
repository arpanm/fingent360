import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  consolidationActors,
  consolidationInput,
  consolidationReview,
  retentionHeaders,
} from '../../helpers/equity-consolidation';
import { ConsolidationPublicSchema } from '../../../../packages/contracts/src/equity-consolidation';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { createRequire } from 'node:module';
test.use({ namedOperators: true });
test('E2E-API-1780 actual consolidation review reconstructs both security histories and withdrawal hides bridge @SRC-003 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer, equityIds } = await consolidationActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = consolidationInput(),
      response = await request.post(
        '/api/v1/ops/equity-consolidations/prepare',
        { headers: retentionHeaders, data: input },
      );
    expect(response.status(), await response.text()).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/equity-consolidations/review', {
          headers: retentionHeaders,
          data: consolidationReview(input.requestId),
        })
      ).status(),
    ).toBe(403);
    const review = consolidationReview(input.requestId);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await reviewer.post('/api/v1/ops/equity-consolidations/review', {
            headers: retentionHeaders,
            data: review,
          })
        ).status(),
      ).toBe(201);
    for (const isin of [input.oldIsin, input.newIsin]) {
      const publicReceipt = ConsolidationPublicSchema.parse(
        await (
          await request.get(`/api/v1/equity-consolidations/${isin}`)
        ).json(),
      );
      expect(publicReceipt.bridges).toHaveLength(1);
      expect(publicReceipt.bridges[0]).toMatchObject({
        oldClose: '12.345',
        oldCloseInNewShareUnits: '123.45',
        newClose: '125',
        numerator: '10',
        denominator: '1',
        calibrationEligibility: 'ineligible-suspended-trading-transition',
      });
    }
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/equity-consolidations/${input.requestId}/evidence`,
          )
        ).json()
      ).documents,
    ).toEqual(input.documents);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: equityIds[0],
            decision: 'withdraw',
            reason: 'Synthetic original price withdrawal.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      ConsolidationPublicSchema.parse(
        await (
          await request.get(`/api/v1/equity-consolidations/${input.newIsin}`)
        ).json(),
      ).bridges,
    ).toEqual([]);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-consolidations/review', {
          headers: retentionHeaders,
          data: consolidationReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1781 conflicting face value reordered dates and incomplete evidence cannot prepare a consolidation @SRC-003 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await consolidationActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = consolidationInput();
    for (const patch of [
      { newFaceValue: '5' },
      { resumedOn: '2025-06-24' },
      { documents: input.documents.slice(0, 2) },
      {
        documents: input.documents.map((d) => ({
          ...d,
          pdfBase64: Buffer.from('not a PDF').toString('base64'),
        })),
      },
      { oldIsin: input.newIsin },
    ])
      expect(
        (
          await request.post('/api/v1/ops/equity-consolidations/prepare', {
            headers: retentionHeaders,
            data: { ...input, ...patch, requestId: randomUUID() },
          })
        ).status(),
      ).toBe(400);
    expect(
      (await (await request.get('/api/v1/ops/equity-consolidations')).json())
        .items,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1782 same-time consolidation queue continuation visits every draft once and rejects invalid cursors @SRC-003 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await consolidationActors(
      request,
      playwright,
      feedbackSandbox,
    ),
    pool = await connectionDatabase(feedbackSandbox);
  try {
    const input = consolidationInput();
    expect(
      (
        await request.post('/api/v1/ops/equity-consolidations/prepare', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    const source = (
        await pool.query('SELECT * FROM equity_consolidations WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0],
      ids = Array.from({ length: 21 }, () => randomUUID())
        .sort()
        .reverse();
    for (const id of ids)
      await pool.query(
        'INSERT INTO equity_consolidations(id,old_isin,new_isin,actor_id,fingerprint,input,receipt,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          id,
          source.old_isin,
          source.new_isin,
          'synthetic-pagination-actor',
          source.fingerprint,
          source.input,
          { ...source.receipt, id },
          '2099-01-01T00:00:00.000Z',
        ],
      );
    const first = await (
      await request.get('/api/v1/ops/equity-consolidations')
    ).json();
    expect(
      first.items.map((r: { receipt: { id: string } }) => r.receipt.id),
    ).toEqual(ids.slice(0, 20));
    const second = await (
      await request.get('/api/v1/ops/equity-consolidations?after=' + first.next)
    ).json();
    expect(
      second.items.map((r: { receipt: { id: string } }) => r.receipt.id),
    ).toEqual([ids[20], input.requestId]);
    expect(second.next).toBeNull();
    expect(
      (
        await request.get(
          '/api/v1/ops/equity-consolidations?after=' + randomUUID(),
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get('/api/v1/ops/equity-consolidations?after=bad')
      ).status(),
    ).toBe(400);
  } finally {
    await pool.end();
    await reviewer.dispose();
  }
});
test('E2E-API-1783 actual published suspension blocks daily-window qualification only across its transition @SRC-003 @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await consolidationActors(
      request,
      playwright,
      feedbackSandbox,
    ),
    pool = await connectionDatabase(feedbackSandbox);
  const require = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const { consolidationBlocksDailyWindow } = await import(
    new URL(
      '../../../../apps/api/dist/equity-consolidation.js',
      import.meta.url,
    ).href
  );
  try {
    const input = consolidationInput();
    expect(
      (
        await request.post('/api/v1/ops/equity-consolidations/prepare', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-consolidations/review', {
          headers: retentionHeaders,
          data: consolidationReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      for (const isin of [input.oldIsin, input.newIsin])
        expect(
          await consolidationBlocksDailyWindow(
            c,
            isin,
            '2025-06-24',
            '2025-07-11',
          ),
        ).toBe(true);
      expect(
        await consolidationBlocksDailyWindow(
          c,
          input.oldIsin,
          '2025-06-20',
          '2025-06-24',
        ),
      ).toBe(false);
      expect(
        await consolidationBlocksDailyWindow(
          c,
          input.newIsin,
          '2025-07-11',
          '2025-07-18',
        ),
      ).toBe(false);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  } finally {
    await pool.end();
    await reviewer.dispose();
  }
});
