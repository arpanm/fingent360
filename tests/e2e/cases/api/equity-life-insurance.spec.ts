import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  lifeInsuranceInput,
} from '../../helpers/equity-life-insurance';
import {
  EquityCompanySchema,
  parseEquitySource,
  NSE_LI_PARSER,
  EquityObservationSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1840 life-insurance accounts retain exact surplus PAT and transfer evidence under independent publication @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await lifeInsuranceInput();
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
      reason: 'Reconstructed life-insurance accounts independently reviewed.',
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
      await (await request.get('/api/v1/equities/INE795G01014')).json(),
    );
    expect(company.records).toHaveLength(29);
    expect(company.records.map((row) => row.observation)).toContainEqual(
      expect.objectContaining({
        metric: 'life-policy-net-surplus',
        value: '31722.00',
        basis: 'consolidated',
        audited: false,
      }),
    );
    expect(company.records.map((row) => row.observation)).toContainEqual(
      expect.objectContaining({
        metric: 'life-shareholder-profit-after-tax',
        value: '61119.00',
        lifeInsuranceContext: expect.objectContaining({
          ratios: 'not-interpreted',
          reportingColumns: ['current-quarter', 'year-to-date'],
        }),
      }),
    );
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
    expect((await request.get('/api/v1/equities/INE795G01014')).status()).toBe(
      404,
    );
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1841 life-insurance cross-account transfers totals extra items and duplicate period columns fail closed @SRC-004 @TEST-SIMULATION', async () => {
  const input = await lifeInsuranceInput();
  const rows = parseEquitySource(
    NSE_LI_PARSER,
    input.body,
    input.effectiveOn,
  ).observations;
  expect(rows).toHaveLength(29);
  for (const body of [
    input.body.replace('37260.00', '37261.00'),
    input.body.replace('2106831.00', '2106832.00'),
    input.body.replace(
      'Extraordinary Items (Net of tax expenses)</td><td>0.00',
      'Extraordinary Items (Net of tax expenses)</td><td>1.00',
    ),
    input.body.replace('Year to Date Figures', 'Previous Quarter'),
    input.body.replace('Amount in (Lakhs)', 'Amount in (Crores)'),
  ])
    expect(() =>
      parseEquitySource(NSE_LI_PARSER, body, input.effectiveOn),
    ).toThrow();
  expect(
    EquityObservationSchema.safeParse({ ...rows[0], basis: 'standalone' })
      .success,
  ).toBe(false);
});
