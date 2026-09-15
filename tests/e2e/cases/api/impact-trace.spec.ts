import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { impactEventFixture } from '../../helpers/impact-trace';
import {
  prepareConnectionAccount,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import {
  ImpactTraceReceiptSchema,
  ImpactTraceListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-960 admitted source to owned goal saves exact immutable receipt replay privacy and delete @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { event } = await impactEventFixture(request, feedbackSandbox);
  const goal = await prepareConnectionAccount(request);
  const input = {
    eventId: event.id,
    eventVersion: event.event!.version,
    sector: 'Synthetic sector context',
    isin: 'INE002A01018',
    holdingsVersion: 1,
    goalId: goal.id,
    goalVersion: goal.version,
    storageConsent: true,
    acknowledgedLimits: true,
    equityBindings: [],
  };
  const path = '/api/v1/account/impact-traces/' + randomUUID();
  const before = await (await request.get('/api/v1/account/holdings')).json();
  const result = await request.put(path, { headers, data: input });
  expect(result.status()).toBe(200);
  const receipt = ImpactTraceReceiptSchema.parse(await result.json());
  expect(receipt.holding.quantity).toBe('3.000001');
  expect(receipt.noAction).toMatchObject({
    holdingCostMinor: '10000',
    projectedMinor: '2200',
    gapMinor: '97800',
  });
  expect(receipt.quantifiedImpact).toBeNull();
  expect(receipt.chain.map((step) => step.kind)).toEqual([
    'evidence',
    'factor',
    'sector',
    'company',
    'holding',
    'goal',
  ]);
  expect(
    await (await request.put(path, { headers, data: input })).json(),
  ).toEqual(receipt);
  expect(
    (
      await request.put(path, {
        headers,
        data: { ...input, sector: 'Unreviewed' },
      })
    ).status(),
  ).toBe(409);
  expect(await (await request.get('/api/v1/account/holdings')).json()).toEqual(
    before,
  );
  expect(
    (await (await request.get('/api/v1/account/privacy/export')).json())
      .impactTraces.traces,
  ).toContainEqual(receipt);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect((await other.delete(path, { headers })).status()).toBe(404);
  } finally {
    await other.dispose();
  }
  expect((await request.delete(path, { headers })).status()).toBe(200);
  expect(
    ImpactTraceListSchema.parse(
      await (await request.get('/api/v1/account/impact-traces')).json(),
    ).traces,
  ).toEqual([]);
  expect((await request.put(path, { headers, data: input })).status()).toBe(
    410,
  );
});
test('E2E-API-961 changed goal and withdrawn event stop new trace and flag retained receipt @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { event } = await impactEventFixture(request, feedbackSandbox),
    goal = await prepareConnectionAccount(request);
  const input = {
    eventId: event.id,
    eventVersion: event.event!.version,
    sector: 'Synthetic sector context',
    isin: 'INE002A01018',
    holdingsVersion: 1,
    goalId: goal.id,
    goalVersion: goal.version,
    storageConsent: true,
    acknowledgedLimits: true,
    equityBindings: [],
  };
  const base = '/api/v1/account/impact-traces';
  expect(
    (
      await request.put(base + '/' + randomUUID(), {
        headers,
        data: { ...input, goalVersion: 999 },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put(base + '/' + randomUUID(), { headers, data: input })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/v1/ops/events/' + event.id + '/review', {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: event.event!.version,
          status: 'withdrawn',
          note: 'Synthetic contrary evidence requires withdrawal.',
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put(base + '/' + randomUUID(), { headers, data: input })
    ).status(),
  ).toBe(409);
  const list = ImpactTraceListSchema.parse(
    await (await request.get(base)).json(),
  );
  expect(list.traces[0]!.reviewReasons).toContain(
    'Event or evidence is withdrawn, conflicting, or unavailable.',
  );
  expect(list.traces[0]!.receipt.event.status).toBe('published');
});
