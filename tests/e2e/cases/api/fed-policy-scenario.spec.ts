import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { fedPolicyScenarioFixture } from '../../helpers/fed-policy-scenario';
import { eventHeaders } from '../../helpers/event-fixture';
import {
  FedPolicyDraftSchema,
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-API-1260 actual historical FOMC fractions extract save review and retain exact source-bound outcome @EVENT-SCENARIOS-001 @FED-POLICY-PACK-001', async ({
  request,
  feedbackSandbox,
}) => {
  expect(
    (
      await request.get('/api/v1/ops/event-scenarios/fed-draft/' + randomUUID())
    ).status(),
  ).toBe(401);
  const event = await fedPolicyScenarioFixture(request, feedbackSandbox);
  const extracted = FedPolicyDraftSchema.parse(
    await (
      await request.get('/api/v1/ops/event-scenarios/fed-draft/' + event.id)
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
      model: extracted.lower,
    };
  const response = await request.put('/api/v1/ops/event-scenarios/' + id, {
    headers: eventHeaders,
    data: input,
  });
  expect(response.status()).toBe(200);
  const receipt = EventScenarioReceiptSchema.parse(await response.json());
  expect(receipt.result.delta).toBe('-0.5');
  expect(receipt.result.comparison).toBe('prior-change');
  expect(receipt.result.warnings.join(' ')).toContain('4-3/4');
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
  expect(published.receipt?.result.delta).toBe('-0.5');
  expect(published.receipt?.event.event?.sources[0]?.sourceHash).toMatch(
    /^[a-f0-9]{64}$/,
  );
  if (extracted.lower.family !== 'policy-rate')
    throw Error('Expected policy extraction.');
  const invalid = {
    ...input,
    requestId: randomUUID(),
    model: {
      ...extracted.lower,
      observed: { ...extracted.lower.observed, value: '4.5' },
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
