import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { rbiPolicySource } from '../../helpers/rbi-policy-scenario';
import {
  buildEventRevision,
  EventPublicSchema,
  extractRbiPolicyDraft,
  calculateEventScenario,
  EventScenarioInputSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1380 retained RBI repo direction rejects swapped levels and stays prior-change without network @RBI-POLICY-PACK-001 @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const source = await rbiPolicySource(),
    now = new Date().toISOString(),
    id = randomUUID();
  const event = buildEventRevision(
    id,
    1,
    now,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason:
        'Test-only original date and minimal quote reconstruction.',
      editorial: {
        title: 'RBI historical repo decision',
        family: 'policy-rate',
        geography: ['India'],
        claimKind: 'fact',
        explanation:
          'Historical repo from/to levels; no release time or consensus inferred.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: 1,
            hash: source.sourceHash!,
            field: 'body',
            quote: source.body,
          },
        ],
        links: [],
      },
    },
    [source],
    [],
    randomUUID,
  );
  event.graph.events[0]!.publicationState = 'published';
  const published = EventPublicSchema.parse({
      id,
      status: 'published',
      event,
      reviewedAt: now,
      evaluatedAt: now,
    }),
    draft = extractRbiPolicyDraft(published);
  const input = EventScenarioInputSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    eventId: id,
    eventVersion: 1,
    revisionReason: 'Reconstruct original repo comparison offline.',
    model: draft.model,
  });
  const result = calculateEventScenario(input, published, now);
  expect(result.delta).toBe('-0.5');
  expect(result.comparison).toBe('prior-change');
  expect(result.meaning).toContain('not a consensus surprise');
  const model = input.model;
  if (model.family !== 'policy-rate') throw Error('Expected policy rate.');
  expect(() =>
    calculateEventScenario(
      {
        ...input,
        model: {
          ...model,
          observed: { ...model.observed, value: '6' },
        },
      },
      published,
      now,
    ),
  ).toThrow(/Observed value/);
  expect(() =>
    extractRbiPolicyDraft({ ...published, status: 'withdrawn', event: null }),
  ).toThrow(/published/);
});
