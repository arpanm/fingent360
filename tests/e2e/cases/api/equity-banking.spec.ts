import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  bankingInput,
} from '../../helpers/equity-banking';
import {
  EquityCompanySchema,
  parseEquitySource,
  NSE_BANKING_PARSER,
  EquityObservationSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1730 bank rendered source requires independent review retains exact report and withdraws company rows @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await bankingInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data: {
            ...input,
            sourceUrl: input.sourceUrl.replace('BANKING', 'INDAS'),
          },
        })
      ).status(),
    ).toBe(400);
    const capture = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: input.requestId,
      decision: 'publish',
      reason: 'Synthetic independent banking rendered report review.',
    };
    expect(
      (
        await request.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const company = EquityCompanySchema.parse(
      await (await request.get('/api/v1/equities/INE545U01014')).json(),
    );
    expect(company.records.map((record) => record.observation)).toContainEqual(
      expect.objectContaining({
        metric: 'bank-interest-earned',
        value: '100000.00',
        scale: 'lakhs',
        bankContext: expect.objectContaining({
          captureBasis: 'uploaded-rendered-nse-report',
          ratios: expect.objectContaining({ unit: 'percent', cet1: '18.0400' }),
        }),
      }),
    );
    expect(
      company.records.some(
        (record) =>
          record.observation.kind === 'fundamental' &&
          record.observation.metric === 'revenue',
      ),
    ).toBe(false);
    expect(
      (
        await (
          await request.get(
            '/api/v1/ops/equities/' + input.requestId + '/evidence',
          )
        ).json()
      ).body,
    ).toBe(input.body);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: { ...review, requestId: randomUUID(), decision: 'withdraw' },
        })
      ).status(),
    ).toBe(201);
    expect((await request.get('/api/v1/equities/INE545U01014')).status()).toBe(
      404,
    );
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1731 bank decimal grouping totals units columns approval and ratios fail closed @SRC-004 @TEST-SIMULATION', async () => {
  const input = await bankingInput(),
    parsed = parseEquitySource(
      NSE_BANKING_PARSER,
      input.body,
      input.effectiveOn,
    );
  expect(parsed.observations).toHaveLength(26);
  for (const body of [
    input.body.replace('1,00,000.00', '1,000,00.00'),
    input.body.replace('1,20,000.00', '1,21,000.00'),
    input.body.replace('Amount in (Lakhs)', 'Amount in (Crores)'),
    input.body.replace('18.0400', '118.0400'),
    input.body.replace(
      'Exceptional items</th><td>0.00',
      'Exceptional items</th><td>1.00',
    ),
    input.body.replace('<td>0.9700</td>', ''),
    input.body.replace('31-03-2026', '31-03-2027'),
  ])
    expect(() =>
      parseEquitySource(NSE_BANKING_PARSER, body, input.effectiveOn),
    ).toThrow();
  expect(() =>
    parseEquitySource(NSE_BANKING_PARSER, input.body, '2026-04-27'),
  ).toThrow();
  const row = parsed.observations[0]!;
  expect(
    EquityObservationSchema.safeParse({ ...row, scale: 'crores' }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({ ...row, periodStart: '2025-01-01' })
      .success,
  ).toBe(false);
});
