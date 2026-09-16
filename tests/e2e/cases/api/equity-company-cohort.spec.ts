import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  loadCompanyCohort,
  companyCohortInput,
  expectedCohort,
  cohortDay,
} from '../../helpers/equity-company-cohort';
import {
  parseEquitySource,
  EquityCompanySchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1890 twenty five original-linked IndAS companies match independent period unit revenue and profit expectations @SRC-005 @TEST-SIMULATION', async () => {
  const cohort = await loadCompanyCohort();
  expect(cohort).toHaveLength(25);
  expect(new Set(cohort.map((c) => c.isin)).size).toBe(25);
  for (const [symbol, revenue, profit] of expectedCohort) {
    const company = cohort.find((c) => c.symbol === symbol)!;
    const input = await companyCohortInput(company);
    const rows = parseEquitySource(
      input.parser,
      input.body,
      input.effectiveOn,
    ).observations;
    const period = {
      isin: company.isin,
      periodStart: cohortDay(company.starts[0]!),
      periodEnd: cohortDay(company.ends[0]!),
      basis: company.bases[0]!.toLowerCase(),
      currency: 'INR',
      scale: 'lakhs',
      audited: company.audits[0] === 'Audited',
    };
    expect(rows, symbol).toContainEqual(
      expect.objectContaining({ ...period, metric: 'revenue', value: revenue }),
    );
    expect(rows, symbol).toContainEqual(
      expect.objectContaining({
        ...period,
        metric: 'profit-after-tax',
        value: profit,
      }),
    );
    expect(rows, symbol).toHaveLength(
      symbol === 'ASMS' || symbol === 'CMICABLES' ? 4 : 2,
    );
    if (symbol === 'ASMS')
      expect(rows).toContainEqual(
        expect.objectContaining({
          periodStart: '2025-04-01',
          metric: 'revenue',
          value: '10395.78',
        }),
      );
    if (symbol === 'CMICABLES')
      expect(rows).toContainEqual(
        expect.objectContaining({
          periodStart: '2025-04-01',
          metric: 'profit-after-tax',
          value: '-607.39',
        }),
      );
  }
});
test('E2E-API-1891 actual retained cohort filing publishes repeated quarter once and retains source withdrawal @SRC-005 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const company = (await loadCompanyCohort()).find(
        (c) => c.symbol === 'GOKULAGRO',
      )!,
      input = await companyCohortInput(company);
    const retained = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(retained.status(), await retained.text()).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: input.requestId,
      decision: 'publish',
      reason: 'Independently checked reconstructed public cohort facts.',
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
    const result = EquityCompanySchema.parse(
      await (await request.get(`/api/v1/equities/${company.isin}`)).json(),
    );
    expect(result.records).toHaveLength(2);
    expect(result.records.map((r) => r.observation)).toContainEqual(
      expect.objectContaining({
        metric: 'revenue',
        value: '462494.57',
        scale: 'lakhs',
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
    expect(
      (await request.get(`/api/v1/equities/${company.isin}`)).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1892 contradictory duplicate periods malformed grouping and scale changes are not silently admitted @SRC-005 @TEST-SIMULATION', async () => {
  const company = (await loadCompanyCohort()).find(
      (c) => c.symbol === 'GOKULAGRO',
    )!,
    input = await companyCohortInput(company);
  for (const body of [
    input.body.replace('4,62,494.57', '4,62,495.57'),
    input.body.replaceAll('4,62,494.57', '46,2,494.57'),
    input.body.replace('Lakhs', 'Unspecified'),
  ])
    expect(() =>
      parseEquitySource(input.parser, body, input.effectiveOn),
    ).toThrow();
});
