import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  companyPackSources,
  governancePackSource,
} from '../../helpers/company-event-pack';
import {
  buildEventRevision,
  EventPublicSchema,
  extractCompanyPackDraft,
  extractGovernancePackDraft,
  calculateEventScenario,
  EventScenarioInputSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1394 exact issuer quarterly revenue and forward range remain distinct in retained reconstruction @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const { source, identity, quotes } = await companyPackSources(),
    now = new Date().toISOString(),
    id = randomUUID(),
    event = buildEventRevision(
      id,
      1,
      now,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason:
          'Historical issuer facts with synthetic canonical identity admission.',
        editorial: {
          title: 'Infosys reported and forward values',
          family: 'earnings',
          geography: ['India'],
          claimKind: 'fact',
          explanation:
            'Original minimal issuer facts; no live source permission.',
          announcedAt: null,
          effectiveAt: null,
          citations: quotes.map((quote) => ({
            sourceId: source.id,
            version: 1,
            hash: source.sourceHash!,
            field: 'body' as const,
            quote,
          })),
          links: [
            {
              kind: 'instrument',
              isin: identity.isin,
              identityVersion: 1,
              citation: 0,
              rationale:
                'Actual issuer ISIN, synthetic resolver admission only.',
            },
          ],
        },
      },
      [source],
      [identity],
      randomUUID,
    );
  event.graph.events[0]!.publicationState = 'published';
  const publicEvent = EventPublicSchema.parse({
      id,
      status: 'published',
      event,
      reviewedAt: now,
      evaluatedAt: now,
    }),
    draft = extractCompanyPackDraft(publicEvent);
  for (const model of [
    draft.earnings,
    draft.guidanceLower,
    draft.guidanceUpper,
  ]) {
    const input = EventScenarioInputSchema.parse({
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId: id,
        eventVersion: 1,
        revisionReason: 'Offline exact issuer comparison.',
        model,
      }),
      result = calculateEventScenario(input, publicEvent, now);
    expect(result.delta).toBe(model.family === 'earnings' ? '3002' : null);
  }
  expect(() =>
    extractCompanyPackDraft({
      ...publicEvent,
      event: { ...event, editorial: { ...event.editorial, links: [] } },
    }),
  ).toThrow('identity');
});
test('E2E-OFFLINE-1396 original FIU subject is preserved without listed-parent inference @EVENT-SCENARIOS-001', async () => {
  const source = await governancePackSource(),
    now = new Date().toISOString(),
    id = randomUUID(),
    event = buildEventRevision(
      id,
      1,
      now,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason: 'Original FIU historical context.',
        editorial: {
          title: 'FIU bank enforcement',
          family: 'regulatory',
          geography: ['India'],
          claimKind: 'fact',
          explanation: 'Historical original regulator subject only.',
          announcedAt: source.publishedAt,
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
  const publicEvent = EventPublicSchema.parse({
      id,
      status: 'published',
      event,
      reviewedAt: now,
      evaluatedAt: now,
    }),
    draft = extractGovernancePackDraft(publicEvent),
    result = calculateEventScenario(
      EventScenarioInputSchema.parse({
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId: id,
        eventVersion: 1,
        revisionReason: 'Original FIU context reconstruction.',
        model: draft.model,
      }),
      publicEvent,
      now,
    );
  expect(result.comparison).toBe('regulatory-context');
  expect(result.delta).toBeNull();
  expect(draft.model).toMatchObject({
    interpretation: expect.stringContaining('does not identify listed One97'),
  });
});
