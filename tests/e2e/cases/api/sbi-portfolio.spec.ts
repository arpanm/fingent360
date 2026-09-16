import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { syntheticSbiWorkbook } from '../../helpers/sbi-portfolio';
import {
  parseSbiPortfolio,
  sbiDisplayed,
} from '../../../../packages/contracts/src/index';
import {
  governanceFixture,
  governanceHeaders as headers,
} from '../../helpers/research-governance';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test.use({ namedOperators: true });
test('E2E-API-1530 synthetic verified-layout workbook preserves source precision discrepancy and separate derivatives @FUNDS-BONDS-001 @TEST-SIMULATION', async () => {
  const parsed = parseSbiPortfolio(syntheticSbiWorkbook());
  expect(parsed.aumLakh).toBe('940.00');
  expect(parsed.quality).toBe('source-discrepancy');
  expect(parsed.rows.find((r) => r.row === 153)?.reportedWeightPercent).toBe(
    '8.00',
  );
  expect(
    parsed.totals.find((r) => r.section === 'derivatives')?.amountLakh,
  ).toBe('50.00');
  expect(
    parsed.rows.filter((r) => r.section === 'derivatives').map((r) => r.row),
  ).toEqual([161, 162, 164, 165, 166]);
  expect(parsed.rows.some((r) => r.row === 163)).toBe(false);
  expect(parsed.completeExposure).toBe(false);
  expect(sbiDisplayed('4758939.3499999996')).toBe('4758939.35');
  expect(sbiDisplayed('-6.0000000000000005E-2')).toBe('-0.06');
  expect(() => parseSbiPortfolio(syntheticSbiWorkbook(true, true))).toThrow();
});
test('E2E-API-1531 retained raw capture quarantines unknown layout and requires separate named mapping review @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox),
    id = randomUUID();
  try {
    const capture = await request.post('/api/v1/ops/fund-lookthrough/import', {
      headers,
      data: {
        requestId: id,
        permissionReference: 'Synthetic isolated test permission',
        body: Buffer.from(syntheticSbiWorkbook()).toString('base64'),
      },
    });
    expect(capture.status()).toBe(201);
    expect((await capture.json()).portfolio.quality).toBe('source-discrepancy');
    expect(
      (
        await request.get('/api/v1/ops/fund-lookthrough/' + id + '/evidence')
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/fund-lookthrough/' + id + '/review', {
          headers,
          data: {
            requestId: randomUUID(),
            decision: 'publish',
            schemeCode: '123456',
            reason: 'Synthetic mapping reason with independent review.',
            acknowledgeDiscrepancy: true,
          },
        })
      ).status(),
    ).toBe(403);
    const invalid = randomUUID();
    const quarantine = await request.post(
      '/api/v1/ops/fund-lookthrough/import',
      {
        headers,
        data: {
          requestId: invalid,
          permissionReference: 'Synthetic isolated test permission',
          body: Buffer.from(syntheticSbiWorkbook(true, true)).toString(
            'base64',
          ),
        },
      },
    );
    expect((await quarantine.json()).state).toBe('quarantined');
    expect(
      (
        await fixture.reviewer.post(
          `/api/v1/ops/fund-lookthrough/${invalid}/review`,
          {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'publish',
              schemeCode: '123456',
              reason: 'Cannot publish malformed source workbook.',
            },
          },
        )
      ).status(),
    ).toBe(409);
    expect(
      (await (await request.get('/api/v1/fund-lookthrough')).json()).editions,
    ).toEqual([]);
    const db = await connectionDatabase(feedbackSandbox);
    try {
      expect(
        (
          await db.query(
            'SELECT portfolio,error FROM fund_portfolio_editions WHERE id=$1',
            [invalid],
          )
        ).rows[0].portfolio,
      ).toBeNull();
    } finally {
      await db.end();
    }
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-API-1532 actual independently mapped disclosure publishes with warnings then NAV withdrawal removes admission @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { publishedSbiFixture } =
    await import('../../helpers/sbi-portfolio-flow');
  const f = await publishedSbiFixture(request, playwright, feedbackSandbox);
  try {
    const first = await request.get(
      '/api/v1/fund-lookthrough?schemeCode=108001',
    );
    expect(first.status()).toBe(200);
    const edition = (await first.json()).editions[0];
    expect(edition.mapping.navEditionId).toBe(f.navId);
    expect(edition.portfolio.quality).toBe('source-discrepancy');
    expect(edition.portfolio.completeExposure).toBe(false);
    expect(
      (await (await request.get('/api/v1/fund-lookthrough/snapshot')).json())
        .editions,
    ).toHaveLength(1);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: f.navId,
            decision: 'withdraw',
            reason: 'Synthetic source withdrawal removes mapping admission.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await (
          await request.get('/api/v1/fund-lookthrough?schemeCode=108001')
        ).json()
      ).editions,
    ).toEqual([]);
    expect(
      (
        await (
          await request.get(
            '/api/v1/ops/fund-lookthrough/' + f.id + '/evidence',
          )
        ).json()
      ).hash,
    ).toBe(edition.hash);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-API-1533 structural archive parser discovers moved sections option premiums and original URL dates @FUNDS-BONDS-001 @TEST-SIMULATION', async () => {
  const {
    parseSbiPortfolioStructural,
    SBI_PORTFOLIO_JULY_URL,
    SBI_PORTFOLIO_URL,
  } = await import('../../../../packages/contracts/src/index');
  const { syntheticSbiJulyWorkbook } =
    await import('../../helpers/sbi-portfolio-structural');
  const july = parseSbiPortfolioStructural(
    syntheticSbiJulyWorkbook(),
    SBI_PORTFOLIO_JULY_URL,
  );
  expect(july.asOf).toBe('2026-07-31');
  expect(july.parser).toBe('sbi-contra-structural-v2');
  expect(july.rows.find((r) => r.section === 'stock-options')).toMatchObject({
    amountLakh: '-0.01',
    reportedWeightPercent: '#',
    quantity: '-1',
    isin: null,
  });
  expect(july.aumLakh).toBe('939.99');
  expect(july.rows.find((r) => r.section === 'reit')?.row).toBe(102);
  expect(() =>
    parseSbiPortfolioStructural(syntheticSbiJulyWorkbook(), SBI_PORTFOLIO_URL),
  ).toThrow();
  expect(() =>
    parseSbiPortfolioStructural(
      syntheticSbiJulyWorkbook(true),
      SBI_PORTFOLIO_JULY_URL,
    ),
  ).toThrow();
  expect(parseSbiPortfolioStructural(syntheticSbiWorkbook()).asOf).toBe(
    '2026-08-31',
  );
});
test('E2E-API-1534 archive capture binds actual selected source URL and quarantines mismatched month @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { SBI_PORTFOLIO_JULY_URL, SBI_PORTFOLIO_URL } =
    await import('../../../../packages/contracts/src/index');
  const { syntheticSbiJulyWorkbook } =
    await import('../../helpers/sbi-portfolio-structural');
  const f = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const id = randomUUID(),
      body = Buffer.from(syntheticSbiJulyWorkbook()).toString('base64');
    const input = {
      requestId: id,
      body,
      sourceUrl: SBI_PORTFOLIO_JULY_URL,
      permissionReference: 'Synthetic isolated archive permission only.',
    };
    const response = await request.post('/api/v1/ops/fund-lookthrough/import', {
      headers,
      data: input,
    });
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({
      sourceUrl: SBI_PORTFOLIO_JULY_URL,
      portfolio: { asOf: '2026-07-31', parser: 'sbi-contra-structural-v2' },
    });
    expect(
      (
        await request.post('/api/v1/ops/fund-lookthrough/import', {
          headers,
          data: { ...input, sourceUrl: SBI_PORTFOLIO_URL },
        })
      ).status(),
    ).toBe(409);
    const wrong = await request.post('/api/v1/ops/fund-lookthrough/import', {
      headers,
      data: { ...input, requestId: randomUUID(), sourceUrl: SBI_PORTFOLIO_URL },
    });
    expect((await wrong.json()).state).toBe('quarantined');
  } finally {
    await f.reviewer.dispose();
  }
});
