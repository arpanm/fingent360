import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  insuranceInput,
} from '../../helpers/equity-insurance';
import {
  EquityCompanySchema,
  parseEquitySource,
  NSE_GI_PARSER,
  EquityObservationSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1820 general-insurance original operating source requires independent review and retains solvency times and percentage proof @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await insuranceInput();
  try {
    const capture = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: input.requestId,
      decision: 'publish',
      reason: 'Reconstructed GI operating report reviewed independently.',
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
      await (await request.get('/api/v1/equities/INE765G01017')).json(),
    );
    expect(company.records).toHaveLength(17);
    expect(company.records.map((row) => row.observation)).toContainEqual(
      expect.objectContaining({
        metric: 'insurance-underwriting-result',
        value: '-62988.00',
        insuranceContext: expect.objectContaining({
          reportingColumns: ['current-quarter', 'year-to-date'],
          ratios: {
            solvencyTimes: '2.7100',
            incurredClaimPercent: '76.400',
            combinedPercent: '107.200',
          },
        }),
      }),
    );
    expect(
      company.records.some(
        (row) =>
          row.observation.kind === 'fundamental' &&
          row.observation.metric === 'profit-after-tax',
      ),
    ).toBe(false);
    expect(
      (
        await (
          await request.get(`/api/v1/ops/equities/${input.requestId}/evidence`)
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
    expect((await request.get('/api/v1/equities/INE765G01017')).status()).toBe(
      404,
    );
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1821 GI exact totals duplicate period columns and ratio unit evidence reject silent accounting substitutions @SRC-004 @TEST-SIMULATION', async () => {
  const input = await insuranceInput();
  const rows = parseEquitySource(
    NSE_GI_PARSER,
    input.body,
    input.effectiveOn,
  ).observations;
  expect(rows).toHaveLength(17);
  for (const body of [
    input.body.replace('4,54,452.00', '4,54,453.00'),
    input.body.replace('8,86,027.00', '8,86,028.00'),
    input.body.replace(
      'Solvency ratio are in times',
      'Solvency ratio are in percent',
    ),
    input.body.replace('Amount in (Lakhs)', 'Amount in (Crores)'),
    input.body.replace('01-04-2026', '01-04-2027'),
  ])
    expect(() =>
      parseEquitySource(NSE_GI_PARSER, body, input.effectiveOn),
    ).toThrow();
  expect(
    EquityObservationSchema.safeParse({ ...rows[0], scale: 'crores' }).success,
  ).toBe(false);
});
