import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  fundFixture,
  fundAccount,
  retentionHeaders as headers,
} from '../../helpers/funds-bonds';
import { indiaActors } from '../../helpers/india-macro';
import {
  corporateRatingInput,
  corporateRatingReview,
} from '../../helpers/corporate-rating';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test.use({ namedOperators: true });
test('E2E-API-1980 exact historical credit attachment is encrypted and exported, withdrawn source prevents new save but preserves original receipt @FUNDS-BONDS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    db = await connectionDatabase(feedbackSandbox);
  try {
    const original = await corporateRatingInput();
    expect(
      (
        await request.post('/api/v1/ops/corporate-ratings/import', {
          headers,
          data: original,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + original.requestId + '/review',
          { headers, data: corporateRatingReview() },
        )
      ).status(),
    ).toBe(201);
    await fundAccount(request);
    const data = {
        ...(await fundFixture()).comparison,
        settlementOn: '2026-05-14',
        previousCouponOn: '2026-02-12',
        nextCouponOn: '2026-08-12',
        cashflows: [{ date: '2035-02-12', amountPaise: '120000' }],
        creditEvidence: { editionId: original.requestId, isin: 'INE031A08939' },
      },
      id = randomUUID(),
      path = '/api/v1/account/bond-comparisons/' + id;
    const response = await request.put(path, { headers, data });
    expect(response.status()).toBe(200);
    const saved = await response.json();
    expect(saved.result.evidencePolicy).toMatchObject({
      priceBasis: 'user-entered-estimate',
      tradingLiquidity: 'not-established',
      credit: {
        status: 'historical-original-attached',
        editionId: original.requestId,
        observation: { isin: 'INE031A08939' },
      },
    });
    const row = (
      await db.query(
        'SELECT payload,encrypted_payload FROM app_bond_comparisons WHERE id=$1',
        [id],
      )
    ).rows[0];
    expect(row.payload).toBeNull();
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(
      original.requestId,
    );
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + original.requestId + '/review',
          { headers, data: corporateRatingReview('withdraw') },
        )
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/account/bond-comparisons/' + randomUUID(), {
          headers,
          data,
        })
      ).status(),
    ).toBe(409);
    expect(await (await request.put(path, { headers, data })).json()).toEqual(
      saved,
    );
    const exported = await (
      await request.get('/api/v1/account/privacy/export')
    ).json();
    expect(exported.bondComparisons.comparisons[0]).toEqual(saved);
    expect((await request.delete(path, { headers })).status()).toBe(200);
    expect(
      (
        await db.query(
          'SELECT encrypted_payload FROM app_bond_comparisons WHERE id=$1',
          [id],
        )
      ).rows[0].encrypted_payload,
    ).toBeNull();
  } finally {
    await db.end();
    await reviewer.dispose();
  }
});
test('E2E-API-1981 agency-withdrawn ISIN and stale historical assessment never attach a credit opinion @FUNDS-BONDS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const source = await corporateRatingInput();
    await request.post('/api/v1/ops/corporate-ratings/import', {
      headers,
      data: source,
    });
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + source.requestId + '/review',
          { headers, data: corporateRatingReview() },
        )
      ).status(),
    ).toBe(201);
    await fundAccount(request);
    const base = {
      ...(await fundFixture()).comparison,
      previousCouponOn: '2026-01-01',
      nextCouponOn: '2027-01-01',
      cashflows: [{ date: '2035-02-12', amountPaise: '120000' }],
    };
    for (const change of [
      {
        settlementOn: '2026-05-14',
        creditEvidence: { editionId: source.requestId, isin: 'INE031A08848' },
      },
      {
        settlementOn: '2026-09-15',
        creditEvidence: { editionId: source.requestId, isin: 'INE031A08939' },
      },
    ])
      expect(
        (
          await request.put(
            '/api/v1/account/bond-comparisons/' + randomUUID(),
            { headers, data: { ...base, ...change } },
          )
        ).status(),
      ).toBe(409);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1982 saved receipt contract rejects altered source facts and unreferenced opinions while preserving historical originals @FUNDS-BONDS-001', async () => {
  const {
    SavedBondComparisonSchema,
    calculateBondComparison,
    CORPORATE_RATING_SOURCE,
    CORPORATE_RATING_VERSION,
    CORPORATE_RATINGS,
  } = await import('../../../../packages/contracts/src/index');
  const at = new Date().toISOString(),
    editionId = randomUUID(),
    source = {
      id: editionId,
      version: CORPORATE_RATING_VERSION,
      sourceUrl: CORPORATE_RATING_SOURCE.url,
      hash: CORPORATE_RATING_SOURCE.hash,
      recordedAt: at,
      retrievedAt: null,
      publishedOn: '2026-05-13',
      annexureAsOf: '2026-03-31',
      observations: CORPORATE_RATINGS,
      state: 'published',
      error: null,
      reviewedAt: at,
    },
    input = {
      ...(await fundFixture()).comparison,
      settlementOn: '2026-05-14',
      previousCouponOn: '2026-02-12',
      nextCouponOn: '2026-08-12',
      cashflows: [{ date: '2035-02-12', amountPaise: '120000' }],
      creditEvidence: { editionId, isin: 'INE031A08939' as const },
    },
    receipt = SavedBondComparisonSchema.parse({
      id: randomUUID(),
      createdAt: at,
      input,
      result: calculateBondComparison(input, source),
    });
  const policy = receipt.result.evidencePolicy!,
    credit = policy.credit;
  if (credit.status !== 'historical-original-attached')
    throw Error('Expected historical receipt');
  for (const changed of [
    { ...credit, CORPORATE_RATING_SOURCE },
    { ...credit, CORPORATE_RATING_VERSION },
    { ...credit, CORPORATE_RATINGS },
    { ...credit, sourceHash: 'a'.repeat(64) },
    { ...credit, sourceVersion: 'invented-v2' },
    { ...credit, publishedOn: '2026-05-14' },
    {
      ...credit,
      observation: { ...credit.observation, couponPercent: '5.62' },
    },
    {
      ...credit,
      observation: { ...credit.observation, maturityOn: '2036-02-12' },
    },
  ])
    expect(() =>
      SavedBondComparisonSchema.parse({
        ...receipt,
        result: {
          ...receipt.result,
          evidencePolicy: { ...policy, credit: changed },
        },
      }),
    ).toThrow();
  expect(() =>
    SavedBondComparisonSchema.parse({
      ...receipt,
      input: { ...input, creditEvidence: undefined },
    }),
  ).toThrow();
  expect(() =>
    SavedBondComparisonSchema.parse({
      ...receipt,
      input: {
        ...input,
        settlementOn: '2026-08-13',
        nextCouponOn: '2026-09-12',
      },
      result: {
        ...receipt.result,
        evidencePolicy: { ...policy, assessmentOn: '2026-08-13' },
      },
    }),
  ).toThrow();
  source.state = 'withdrawn';
  expect(SavedBondComparisonSchema.parse(receipt)).toEqual(receipt);
});
