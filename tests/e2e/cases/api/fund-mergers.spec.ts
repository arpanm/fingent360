import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { retentionHeaders as headers } from '../../helpers/india-macro';
import { mergerFixture, mergerInput } from '../../helpers/fund-mergers';
import { FundMergerListSchema } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1900 retained merger original requires independent exact plan review and disappears after NAV withdrawal @DEV-022 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await mergerFixture(request, playwright, feedbackSandbox);
  try {
    const base = '/api/v1/ops/fund-mergers/' + f.input.requestId;
    expect(
      (
        await request.post(base + '/review', { headers, data: f.review })
      ).status(),
    ).toBe(403);
    expect(
      (
        await f.reviewer.post(base + '/review', {
          headers,
          data: { ...f.review, toCode: '108001' },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await f.reviewer.post(base + '/review', { headers, data: f.review })
      ).status(),
    ).toBe(201);
    const value = FundMergerListSchema.parse(
      await (
        await request.get('/api/v1/fund-mergers?schemeCode=108001')
      ).json(),
    );
    expect(value.editions[0]?.terms).toMatchObject({
      effectiveOn: '2022-01-14',
      conversionRatio: null,
      portfolioMutation: false,
      navSeriesContinuity: 'not-established',
    });
    expect(value.editions[0]?.mapping?.to.observation.schemeCode).toBe(
      '108002',
    );
    expect((await request.get(base + '/evidence')).status()).toBe(200);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: f.navId,
            decision: 'withdraw',
            reason: 'Withdraw exact synthetic identity source.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      FundMergerListSchema.parse(
        await (await request.get('/api/v1/fund-mergers')).json(),
      ).editions,
    ).toEqual([]);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-API-1901 malformed original quarantine and capture replay cannot change notice identity @DEV-022 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await mergerFixture(request, playwright, feedbackSandbox);
  try {
    const input = {
      ...mergerInput(),
      body: Buffer.from('unsupported original envelope').toString('base64'),
    };
    const response = await request.post('/api/v1/ops/fund-mergers/import', {
      headers,
      data: input,
    });
    expect(response.status()).toBe(201);
    expect((await response.json()).state).toBe('quarantined');
    expect(
      (
        await f.reviewer.post(
          '/api/v1/ops/fund-mergers/' + input.requestId + '/review',
          { headers, data: f.review },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/ops/fund-mergers/import', {
          headers,
          data: { ...f.input, from: 'HDFC EOF - II - 1100D June 2017 (1)' },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await f.reviewer.dispose();
  }
});
