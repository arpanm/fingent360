import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  buildEventRevision,
  EventPublicSchema,
  EventScenarioInputSchema,
  extractFedPolicyDraft,
  calculateEventScenario,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1260 historical Fed evidence yields the same source-bound fraction receipt without network @FED-POLICY-PACK-001 @EVENT-SCENARIOS-001', async () => {
  const pack = JSON.parse(
    await readFile(
      new URL(
        '../../../../packages/contracts/test/fixtures/fomc-2024-policy-pack.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    sources: {
      url: string;
      publishedAt: string;
      retrievedAt: string;
      rawHash: string;
      quote: string;
    }[];
  };
  const now = new Date().toISOString();
  const sources = pack.sources.map((item, index) =>
    FeedItemSchema.parse({
      id: 'historical-fomc-fixture-' + index,
      version: 1,
      kind: 'news',
      title: 'Historical official FOMC statement',
      summary: item.quote,
      body: item.quote,
      topics: [],
      publishedAt: item.publishedAt,
      effectiveLabel: 'Historical evidence',
      source: {
        name: 'Federal Reserve Board',
        url: item.url,
        retrievedAt: new Date(item.retrievedAt).toISOString(),
        rights: 'Board-authored public-domain information with attribution.',
      },
      sourceHash: item.rawHash,
      importance: 1,
      relatedIds: [],
      status: 'published',
      reviewedAt: now,
      correctionNote: null,
    }),
  );
  const id = randomUUID(),
    event = buildEventRevision(
      id,
      1,
      now,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason: 'Historical source pack isolated offline acceptance',
        editorial: {
          title: 'Historical Fed comparison',
          family: 'policy-rate',
          geography: ['United States'],
          claimKind: 'fact',
          explanation: 'Historical corresponding target bounds only.',
          announcedAt: '2024-09-18T18:00:00.000Z',
          effectiveAt: null,
          citations: sources.map((source) => ({
            sourceId: source.id,
            version: 1,
            hash: source.sourceHash!,
            field: 'body' as const,
            quote: source.body,
          })),
          links: [],
        },
      },
      sources,
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
    draft = extractFedPolicyDraft(publicEvent);
  for (const model of [draft.lower, draft.upper]) {
    const input = EventScenarioInputSchema.parse({
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: id,
      eventVersion: 1,
      revisionReason: 'Historical retained offline calculation',
      model,
    });
    const result = calculateEventScenario(input, publicEvent, now);
    expect(result.delta).toBe('-0.5');
    expect(result.comparison).toBe('prior-change');
    expect(result.warnings.join(' ')).toContain('4-3/4');
  }
});
