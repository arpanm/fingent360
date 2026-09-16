import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { beaGdpScenarioFixture } from '../../helpers/bea-gdp-scenario';
import { eventHeaders } from '../../helpers/event-fixture';
import {
  BeaGdpDraftSchema,
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-API-1390 actual historical BEA GDP vintages extract save review and retain exact source-bound outcome @EVENT-SCENARIOS-001 @BEA-GDP-PACK-001', async ({
  request,
  feedbackSandbox,
}) => {
  expect(
    (
      await request.get('/api/v1/ops/event-scenarios/bea-draft/' + randomUUID())
    ).status(),
  ).toBe(401);
  const event = await beaGdpScenarioFixture(request, feedbackSandbox);
  const extracted = BeaGdpDraftSchema.parse(
    await (
      await request.get('/api/v1/ops/event-scenarios/bea-draft/' + event.id)
    ).json(),
  );
  const id = randomUUID(),
    input = {
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: event.id,
      eventVersion: event.event!.version,
      revisionReason:
        'Historical corresponding-bound comparison from exact retained official excerpts.',
      model: extracted.model,
    };
  const response = await request.put('/api/v1/ops/event-scenarios/' + id, {
    headers: eventHeaders,
    data: input,
  });
  expect(response.status()).toBe(200);
  const receipt = EventScenarioReceiptSchema.parse(await response.json());
  expect(receipt.result.delta).toBe('0.5');
  expect(receipt.result.comparison).toBe('vintage-revision');
  expect(
    (
      await request.post(`/api/v1/ops/event-scenarios/${id}/review`, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          decision: 'publish',
          reason:
            'Actual historical statement and conversion review in isolated test.',
        },
      })
    ).status(),
  ).toBe(201);
  const published = EventScenarioPublicSchema.parse(
    await (await request.get('/api/v1/event-scenarios/' + id)).json(),
  );
  expect(published.receipt?.result.delta).toBe('0.5');
  expect(published.receipt?.event.event?.sources[0]?.sourceHash).toMatch(
    /^[a-f0-9]{64}$/,
  );
  if (extracted.model.family !== 'gdp')
    throw Error('Expected policy extraction.');
  const invalid = {
    ...input,
    requestId: randomUUID(),
    model: {
      ...extracted.model,
      observed: { ...extracted.model.observed, value: '3.3' },
    },
  };
  expect(
    (
      await request.put('/api/v1/ops/event-scenarios/' + randomUUID(), {
        headers: eventHeaders,
        data: invalid,
      })
    ).status(),
  ).toBe(400);
});
