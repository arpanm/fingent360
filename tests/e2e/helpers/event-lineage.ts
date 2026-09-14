import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { eventFixture, eventHeaders, expect } from './event-fixture';
import { EventLineagePlanSchema } from '../../../packages/contracts/src/index';
export async function prepareLineage(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const fixture = await eventFixture(request, sandbox),
    inputs = [];
  for (let index = 0; index < 2; index++) {
    const id = randomUUID();
    const saved = await request.put('/api/v1/ops/events/' + id, {
      headers: eventHeaders,
      data: {
        ...fixture.input,
        requestId: randomUUID(),
        editorial: {
          ...fixture.input.editorial,
          title: 'Synthetic original ' + index,
        },
      },
    });
    expect(saved.status()).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/events/' + id + '/review', {
          headers: eventHeaders,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            status: 'published',
            note: 'Synthetic reviewed original for lineage',
          },
        })
      ).status(),
    ).toBe(201);
    inputs.push({ id, version: 2 });
  }
  const input = {
    kind: 'merge',
    inputs,
    outputs: [
      {
        id: randomUUID(),
        editorial: {
          ...fixture.input.editorial,
          title: 'Synthetic merged context',
          links: [],
        },
      },
    ],
    reason: 'Synthetic duplicate context consolidated after explicit review.',
  };
  return { ...fixture, input };
}
export async function saveLineage(
  request: APIRequestContext,
  input: unknown,
  id: string = randomUUID(),
) {
  const response = await request.put('/api/v1/ops/event-lineage/' + id, {
    headers: eventHeaders,
    data: input,
  });
  expect(response.status(), await response.text()).toBe(200);
  return EventLineagePlanSchema.parse(await response.json());
}
