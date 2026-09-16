import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  cpiNowcastInput,
  cpiActualInput,
} from '../../helpers/cpi-expectations';
import {
  CpiExpectationPublicSchema,
  parseCpiCapture,
  compareCpiSnapshots,
} from '../../../../packages/contracts/src/index';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
test.use({ namedOperators: true });
test('E2E-API-1670 retained model and actual require independent publication and persist comparison then withdraw @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  try {
    const nowcast = cpiNowcastInput(),
      actual = cpiActualInput();
    for (const input of [nowcast, actual]) {
      expect(
        (
          await request.post('/api/v1/ops/cpi-expectations/import', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await request.post('/api/v1/ops/cpi-expectations/review', {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              editionId: input.requestId,
              decision: 'publish',
              reason: 'Same actor must not publish.',
            },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await reviewer.post('/api/v1/ops/cpi-expectations/review', {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              editionId: input.requestId,
              decision: 'publish',
              reason: 'Independent synthetic evidence inspection.',
            },
          })
        ).status(),
      ).toBe(201);
    }
    const view = CpiExpectationPublicSchema.parse(
      await (await request.get('/api/v1/cpi-expectations')).json(),
    );
    expect(
      compareCpiSnapshots(
        view.editions.find((e) => e.id === nowcast.requestId)!,
        view.editions.find((e) => e.id === actual.requestId)!,
        '2026-08',
      ),
    ).toMatchObject({ difference: '0.03', prospective: false });
    expect(
      (
        await reviewer.get(
          `/api/v1/ops/cpi-expectations/${nowcast.requestId}/evidence`,
        )
      ).status(),
    ).toBe(200);
    const retained = await pool.query(
      'SELECT payload FROM cpi_expectation_views',
    );
    expect(retained.rows).toHaveLength(1);
    expect(retained.rows[0].payload.comparisons[0].result.difference).toBe(
      '0.03',
    );
    expect(
      (
        await reviewer.post('/api/v1/ops/cpi-expectations/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: actual.requestId,
            decision: 'withdraw',
            reason: 'Withdraw actual from public comparisons.',
          },
        })
      ).status(),
    ).toBe(201);
    const changed = CpiExpectationPublicSchema.parse(
      await (await request.get('/api/v1/cpi-expectations')).json(),
    );
    expect(changed.editions.map((e) => e.id)).toEqual([nowcast.requestId]);
  } finally {
    await Promise.allSettled([reviewer.dispose(), pool.end()]);
  }
});
test('E2E-API-1671 monthly measure, blank actual cell, original claim and availability stay strict @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const n = cpiNowcastInput(),
    a = cpiActualInput(),
    parse = (input: typeof n) =>
      parseCpiCapture({
        ...input,
        hash: sourceHash(input.url, input.body),
        retrievedAt: '2026-09-15T00:00:00.000Z',
      }),
    nowcast = parse(n),
    actual = parse(a);
  expect(nowcast.sourcePublishedOn).toBeNull();
  for (const body of [
    n.body.replace('month-over-month', 'year-over-year'),
    n.body.replace('<td>0.37</td>', '<td></td>'),
    n.body.replace('<th>CPI</th>', '<th>Core CPI</th>'),
  ])
    expect(() => parse({ ...n, body })).toThrow();
  const nc = {
      id: n.requestId,
      expectation: nowcast,
      reviewedAt: '2026-09-15T00:00:01.000Z',
    },
    ac = {
      id: a.requestId,
      expectation: actual,
      reviewedAt: '2026-09-15T00:00:01.000Z',
    };
  expect(compareCpiSnapshots(nc, ac, '2026-08').prospective).toBe(false);
  expect(
    compareCpiSnapshots(
      {
        ...nc,
        expectation: { ...nowcast, retrievedAt: '2026-09-10T12:00:00.000Z' },
        reviewedAt: '2026-09-10T13:00:00.000Z',
      },
      ac,
      '2026-08',
    ).prospective,
  ).toBe(true);
  expect(
    compareCpiSnapshots(
      {
        ...nc,
        expectation: { ...nowcast, retrievedAt: '2026-09-11T01:00:00.000Z' },
        reviewedAt: '2026-09-11T02:00:00.000Z',
      },
      ac,
      '2026-08',
    ).prospective,
  ).toBe(false);
  expect(() =>
    compareCpiSnapshots(
      nc,
      {
        ...ac,
        expectation: {
          ...actual,
          points: [{ ...actual.points[0]!, value: '8.8' }],
        },
      },
      '2026-08',
    ),
  ).toThrow();
});
