import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { scenarioEventFixture } from '../../helpers/event-scenarios';
import { eventHeaders as headers } from '../../helpers/event-fixture';
import {
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
  EventScenarioHistorySchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-1020 actual retained event scenario draft review replay history and withdrawal admission @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { event, input } = await scenarioEventFixture(request, feedbackSandbox),
    id = randomUUID(),
    path = '/api/v1/ops/event-scenarios/' + id;
  const draft = await request.put(path, { headers, data: input });
  expect(draft.status()).toBe(200);
  const receipt = EventScenarioReceiptSchema.parse(await draft.json());
  expect(receipt.result.direction).toBe('not-quantified');
  expect(
    await (await request.put(path, { headers, data: input })).json(),
  ).toEqual(receipt);
  expect((await request.get('/api/v1/event-scenarios/' + id)).status()).toBe(
    404,
  );
  const review = {
    requestId: randomUUID(),
    expectedVersion: 1,
    decision: 'publish',
    reason: 'Synthetic separate review of source and model.',
  };
  expect(
    (await request.post(path + '/review', { headers, data: review })).status(),
  ).toBe(201);
  expect(
    (await request.post(path + '/review', { headers, data: review })).status(),
  ).toBe(201);
  expect(
    EventScenarioPublicSchema.parse(
      await (await request.get('/api/v1/event-scenarios/' + id)).json(),
    ).receipt,
  ).toEqual(receipt);
  expect(
    EventScenarioHistorySchema.parse(
      await (
        await request.get('/api/v1/event-scenarios/' + id + '/history')
      ).json(),
    ).versions.map((v) => v.version),
  ).toEqual([1]);
  expect(
    (
      await request.put(path, {
        headers,
        data: { ...input, revisionReason: 'Different same request' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post('/api/v1/ops/events/' + event.id + '/review', {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: event.event!.version,
          status: 'withdrawn',
          note: 'Synthetic underlying source context withdrawal.',
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    EventScenarioPublicSchema.parse(
      await (await request.get('/api/v1/event-scenarios/' + id)).json(),
    ),
  ).toMatchObject({ state: 'unavailable', receipt: null });
  expect(
    (
      await request.post(path + '/review', {
        headers,
        data: { ...review, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-1021 missing numeric support and stale source model reject without publishing @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { input } = await scenarioEventFixture(request, feedbackSandbox),
    path = '/api/v1/ops/event-scenarios/' + randomUUID();
  const numerical = {
    ...input,
    model: {
      family: 'inflation',
      index: 'headline-CPI',
      basis: 'year-on-year',
      adjustment: 'not-seasonally-adjusted',
      unit: 'percent',
      observed: {
        value: '9876543210.12345678',
        period: 'Synthetic period',
        citation: 0,
      },
      reference: null,
    },
  };
  expect((await request.put(path, { headers, data: numerical })).status()).toBe(
    400,
  );
  expect(
    (
      await request.put(path, {
        headers,
        data: { ...input, eventVersion: 999 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get('/api/v1/event-scenarios/' + path.split('/').at(-1))
    ).status(),
  ).toBe(404);
});
