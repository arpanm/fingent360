import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { axisFixture } from '../../helpers/axis-portfolio-flow';
import { syntheticAxisWorkbook } from '../../helpers/axis-portfolio';
import { governanceHeaders as headers } from '../../helpers/research-governance';
import {
  parseAxisPortfolio,
  AXIS_PORTFOLIO_URL,
  SbiPortfolioSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1720 original Axis grammar preserves quantity fractional weights yield and rejects tampered lexical proof @FUNDS-BONDS-001 @TEST-SIMULATION', async () => {
  const parsed = parseAxisPortfolio(
    syntheticAxisWorkbook(),
    AXIS_PORTFOLIO_URL,
  );
  expect(parsed).toMatchObject({
    parser: 'axis-nifty50-february-2026-v1',
    scheme: 'Axis NIFTY 50 ETF',
    asOf: '2026-02-28',
    aumLakh: '100.00',
    quality: 'reconciled-disclosure',
  });
  expect(parsed.rows).toHaveLength(52);
  expect(parsed.rows[0]).toMatchObject({
    quantity: '10',
    reportedWeightPercent: '1.00',
  });
  expect(parsed.rows.find((r) => r.section === 'treps')?.yieldPercent).toBe(
    '5.00',
  );
  expect(() =>
    SbiPortfolioSchema.parse({
      ...parsed,
      rows: [
        { ...parsed.rows[0]!, reportedWeightPercent: '99.00' },
        ...parsed.rows.slice(1),
      ],
    }),
  ).toThrow();
  expect(() =>
    parseAxisPortfolio(
      syntheticAxisWorkbook(),
      'https://example.com/private.xlsx',
    ),
  ).toThrow();
});
test('E2E-API-1721 Axis capture independent exact-AMFI mapping and NAV withdrawal use retained original receipts @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await axisFixture(request, playwright, feedbackSandbox);
  try {
    const captured = await request.post('/api/v1/ops/fund-lookthrough/import', {
      headers,
      data: f.input,
    });
    expect(captured.status()).toBe(201);
    expect((await captured.json()).portfolio.parser).toBe(
      'axis-nifty50-february-2026-v1',
    );
    const review = {
      requestId: randomUUID(),
      decision: 'publish',
      schemeCode: '108001',
      reason: 'Independent synthetic original workbook and AMFI scheme review.',
    };
    expect(
      (
        await request.post(`/api/v1/ops/fund-lookthrough/${f.id}/review`, {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await f.reviewer.post(`/api/v1/ops/fund-lookthrough/${f.id}/review`, {
          headers,
          data: { ...review, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await (
          await request.get('/api/v1/fund-lookthrough?schemeCode=108001')
        ).json()
      ).editions[0].mapping.navEditionId,
    ).toBe(f.navId);
    const evidence = await request.get(
      `/api/v1/ops/fund-lookthrough/${f.id}/evidence`,
    );
    expect((await evidence.json()).body).toBe(f.input.body);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: f.navId,
            decision: 'withdraw',
            reason: 'Synthetic NAV mapping withdrawal.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await (await request.get('/api/v1/fund-lookthrough')).json()).editions,
    ).toEqual([]);
  } finally {
    await f.reviewer.dispose();
  }
});
