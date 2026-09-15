import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import {
  EventPublicSchema,
  EventScenarioInputSchema,
} from '../../../packages/contracts/src/index';
import { eventFixture, eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function scenarioEventFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const fixture = await eventFixture(request, sandbox),
    path = '/api/v1/ops/events/' + fixture.id;
  const draft = await request.put(path, {
    headers: eventHeaders,
    data: fixture.input,
  });
  if (!draft.ok()) throw Error('Scenario event fixture draft failed.');
  const review = await request.post(path + '/review', {
    headers: eventHeaders,
    data: {
      requestId: randomUUID(),
      expectedVersion: 1,
      status: 'published',
      note: 'Synthetic review of actual retained source context.',
    },
  });
  if (!review.ok()) throw Error('Scenario event fixture review failed.');
  const event = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + fixture.id)).json(),
  );
  const input = EventScenarioInputSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    eventId: event.id,
    eventVersion: event.event!.version,
    revisionReason: 'Synthetic scenario of actual stored source context.',
    model: {
      family: 'regulatory',
      authority: 'other-regulator',
      category: 'governance-disclosure',
      citation: 0,
      interpretation:
        'Synthetic editorial governance interpretation; not an actual legal determination.',
    },
  });
  return { event, input };
}
