import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import { sovereignInput, sovereignReview } from '../../helpers/sovereign-bond';
import {
  SovereignListSchema,
  SovereignCalculationSchema,
} from '../../../../packages/contracts/src/sovereign-bond';
test.use({ namedOperators: true });
test('E2E-API-1920 retained historical auction requires independent review and exact accrued settlement stops on withdrawal @SRC-017 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = sovereignInput(),
      ops = '/api/v1/ops/sovereign-bonds/' + input.requestId;
    expect(
      (
        await request.post('/api/v1/ops/sovereign-bonds/import', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(ops + '/review', {
          headers,
          data: sovereignReview(),
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: {
            ...sovereignReview(),
            sourceHashes: Array(4).fill('0'.repeat(64)),
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: sovereignReview(),
        })
      ).status(),
    ).toBe(201);
    const rows = SovereignListSchema.parse(
      await (await request.get('/api/v1/sovereign-bonds')).json(),
    );
    expect(rows.editions[0]?.terms.isin).toBe('IN0020250091');
    expect((await request.get(ops + '/evidence/terms')).status()).toBe(200);
    const url = '/api/v1/sovereign-bonds/' + input.requestId + '/calculate';
    const response = await request.post(url, {
      data: { nominalPaise: '1000000', price: 'cutoff' },
    });
    expect(response.status()).toBe(201);
    expect(
      SovereignCalculationSchema.parse(await response.json()),
    ).toMatchObject({
      cleanPaise: '966700',
      accruedPaise: '1260',
      dirtyPaise: '967960',
      executionPrice: false,
      holdingMutation: false,
    });
    expect(
      (
        await (
          await request.post(url, {
            data: { nominalPaise: '1000000', price: 'weighted' },
          })
        ).json()
      ).dirtyPaise,
    ).toBe('968160');
    expect(
      (
        await reviewer.post(ops + '/review', {
          headers,
          data: sovereignReview('withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(url, {
          data: { nominalPaise: '1000000', price: 'cutoff' },
        })
      ).status(),
    ).toBe(409);
    expect(
      SovereignListSchema.parse(
        await (await request.get('/api/v1/sovereign-bonds')).json(),
      ).editions,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1921 missing original rejected, unsupported envelope quarantined and replay changes rejected @SRC-017 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = sovereignInput();
    expect(
      (
        await request.post('/api/v1/ops/sovereign-bonds/import', {
          headers,
          data: { ...input, originals: input.originals.slice(1) },
        })
      ).status(),
    ).toBe(400);
    input.originals[0]!.body = Buffer.from('unsupported envelope').toString(
      'base64',
    );
    const result = await request.post('/api/v1/ops/sovereign-bonds/import', {
      headers,
      data: input,
    });
    expect(result.status()).toBe(201);
    expect((await result.json()).state).toBe('quarantined');
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/sovereign-bonds/' + input.requestId + '/review',
          { headers, data: sovereignReview() },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/ops/sovereign-bonds/import', {
          headers,
          data: {
            ...input,
            permissionReference: 'TEST-SIMULATION changed permission record',
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await reviewer.dispose();
  }
});
