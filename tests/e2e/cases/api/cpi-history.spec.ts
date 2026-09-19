import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
} from '../../helpers/cpi-expectations';
import {
  cpiHistoryInput,
  cpiHistoricalActualInput,
} from '../../helpers/cpi-history';
import {
  CpiExpectationPublicSchema,
  parseCpiCapture,
  compareCpiSnapshots,
} from '../../../../packages/contracts/src/index';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
test.use({ namedOperators: true });
test('E2E-API-1850 original dated Cleveland model and matching BLS release retain exact historical error @EVENT-SCENARIOS-001 @SOURCE-EXCERPT', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    n = cpiHistoryInput(),
    a = cpiHistoricalActualInput();
  try {
    for (const data of [n, a]) {
      const saved = await request.post('/api/v1/ops/cpi-expectations/import', {
        headers: retentionHeaders,
        data,
      });
      expect(saved.status()).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/cpi-expectations/review', {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              editionId: data.requestId,
              decision: 'publish',
              reason:
                'Independent original historical measure, vintage and permission review.',
            },
          })
        ).status(),
      ).toBe(201);
    }
    const view = CpiExpectationPublicSchema.parse(
        await (await request.get('/api/v1/cpi-expectations')).json(),
      ),
      model = view.editions.find((e) => e.id === n.requestId)!,
      actual = view.editions.find((e) => e.id === a.requestId)!;
    expect(model.expectation.history?.asOf).toBe('2025-02-11');
    expect(model.expectation.points[0]?.value).toBe('0.242424629147151');
    expect(compareCpiSnapshots(model, actual, '2025-01')).toMatchObject({
      difference: '0.257575370852849',
      prospective: false,
      priorHistoricalVintage: true,
    });
    const original = await (
      await reviewer.get(`/api/v1/ops/cpi-expectations/${n.requestId}/evidence`)
    ).json();
    expect(original.body).toBe(n.body);
    expect(
      (
        await reviewer.post('/api/v1/ops/cpi-expectations/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: n.requestId,
            decision: 'withdraw',
            reason: 'Withdraw historical comparison source.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      CpiExpectationPublicSchema.parse(
        await (await request.get('/api/v1/cpi-expectations')).json(),
      ).editions.some((e) => e.id === n.requestId),
    ).toBe(false);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1851 chart vintage selection rejects blank actual days and wrong measure while preserving source precision @EVENT-SCENARIOS-001 @SOURCE-EXCERPT', async () => {
  const data = cpiHistoryInput(),
    parse = (value: typeof data) =>
      parseCpiCapture({
        ...value,
        hash: sourceHash(value.url, value.body),
        retrievedAt: '2026-09-15T00:00:00.000Z',
      });
  expect(parse(data).sourcePublishedOn).toBeNull();
  expect(parse(data).points[0]?.value).toBe('0.242424629147151');
  // Keep strict provider validation even though known chart decoration is allowed.
  expect(data.body).toContain('anchorradius');
  expect(() =>
    parse({
      ...data,
      body: data.body.replace('"anchorradius"', '"unknownMarker"'),
    }),
  ).toThrow();
  expect(() =>
    parse({
      ...data,
      body: data.body.replace(
        /"anchorradius"\s*:\s*"6"/,
        '"anchorradius":"invalid"',
      ),
    }),
  ).toThrow();
  expect(() =>
    parse({
      ...data,
      historySelection: { ...data.historySelection, asOf: '2025-02-12' },
    }),
  ).toThrow();
  expect(() =>
    parse({
      ...data,
      historySelection: { ...data.historySelection, asOf: '2026-02-11' },
    }),
  ).toThrow();
  expect(() =>
    parse({
      ...data,
      body: data.body.replace(
        'Month-over-month percent change',
        'Year-over-year percent change',
      ),
    }),
  ).toThrow();
  expect(() =>
    parse({ ...data, body: data.body.replace('0.242424629147151', '0.9') }),
  ).toThrow();
});
