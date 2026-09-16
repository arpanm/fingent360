import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  FedPolicyDraftSchema,
  EventScenarioPublicSchema,
} from '../../../packages/contracts/src/index';
import { fedPolicyScenarioFixture } from './fed-policy-scenario';
import { eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function analyticalScenarioFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const event = await fedPolicyScenarioFixture(request, sandbox),
    draft = FedPolicyDraftSchema.parse(
      await (
        await request.get('/api/v1/ops/event-scenarios/fed-draft/' + event.id)
      ).json(),
    ),
    id = randomUUID();
  expect(
    (
      await request.put('/api/v1/ops/event-scenarios/' + id, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          eventId: event.id,
          eventVersion: event.event!.version,
          revisionReason: 'Historical analytical reader binding acceptance.',
          model: draft.lower,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(`/api/v1/ops/event-scenarios/${id}/review`, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          decision: 'publish',
          reason:
            'Review original Federal Reserve evidence for analytical reading.',
        },
      })
    ).status(),
  ).toBe(201);
  const scenario = EventScenarioPublicSchema.parse(
    await (await request.get('/api/v1/event-scenarios/' + id)).json(),
  );
  return { source: event.event!.sources[0]!, event, scenario };
}
