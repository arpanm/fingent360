import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import {
  corporateRatingInput,
  corporateRatingReview,
} from '../../helpers/corporate-rating';
import {
  CorporateRatingListSchema,
  CORPORATE_RATING_SOURCE,
} from '../../../../packages/contracts/src/corporate-rating';
test.use({ namedOperators: true });
test('E2E-API-1960 genuine ICRA original requires independent review and preserves agency withdrawal separately from editorial withdrawal @SRC-018', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = await corporateRatingInput(),
      ops = '/api/v1/ops/corporate-ratings/' + input.requestId;
    expect(
      (
        await request.post('/api/v1/ops/corporate-ratings/import', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(ops + '/review', {
          headers,
          data: corporateRatingReview(),
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: { ...corporateRatingReview(), sourceHash: '0'.repeat(64) },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: corporateRatingReview(),
        })
      ).status(),
    ).toBe(201);
    const list = CorporateRatingListSchema.parse(
        await (await request.get('/api/v1/corporate-ratings')).json(),
      ),
      edition = list.editions[0]!;
    expect(edition.hash).toBe(CORPORATE_RATING_SOURCE.hash);
    expect(
      edition.observations.find((o) => o.isin === 'INE031A08848'),
    ).toMatchObject({
      agencyStatus: 'withdrawn-by-agency',
      defaultClaim: false,
      marketPrice: null,
      tradingLiquidity: 'not-established',
    });
    expect(
      edition.observations.find((o) => o.isin === 'INE031A08939'),
    ).toMatchObject({
      couponPercent: '7.29',
      maturityOn: '2035-02-12',
      agencyStatus: 'rated-in-original',
    });
    const originalResponse = await request.get(ops + '/evidence');
    expect(originalResponse.status()).toBe(200);
    const raw = await originalResponse.json();
    expect(raw.body).toBe(input.body);
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: corporateRatingReview('withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      CorporateRatingListSchema.parse(
        await (await request.get('/api/v1/corporate-ratings')).json(),
      ).editions,
    ).toEqual([]);
    expect((await request.get(ops + '/evidence')).status()).toBe(200);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1961 altered valid PDF quarantines without inheriting known credit facts and request replay cannot change original @SRC-018 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = await corporateRatingInput();
    input.body = Buffer.concat([
      Buffer.from(input.body, 'base64'),
      Buffer.from('\n% TEST-SIMULATION changed original'),
    ]).toString('base64');
    const response = await request.post(
      '/api/v1/ops/corporate-ratings/import',
      { headers, data: input },
    );
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({
      state: 'quarantined',
      observations: [],
    });
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + input.requestId + '/review',
          { headers, data: corporateRatingReview() },
        )
      ).status(),
    ).toBe(409);
    const actual = await corporateRatingInput();
    expect(
      (
        await request.post('/api/v1/ops/corporate-ratings/import', {
          headers,
          data: { ...actual, requestId: input.requestId },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await reviewer.dispose();
  }
});
