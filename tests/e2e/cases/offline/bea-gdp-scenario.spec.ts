import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  buildEventRevision,
  EventPublicSchema,
  EventScenarioInputSchema,
  extractBeaGdpDraft,
  calculateEventScenario,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1390 original GDP vintages yield the same exact revision receipt without network @BEA-GDP-PACK-001 @EVENT-SCENARIOS-001', async () => {
  const pack = JSON.parse(
    await readFile(
      new URL(
        '../../../../packages/contracts/test/fixtures/bea-gdp-2025-vintages.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { sources: { url: string; publishedAt: string; quote: string }[] };
  const now = new Date().toISOString();
  const sources = pack.sources.map((item, index) =>
    FeedItemSchema.parse({
      id: 'historical-bea-fixture-' + index,
      version: 1,
      kind: 'news',
      title: 'Historical original GDP estimate',
      summary: item.quote,
      body: item.quote,
      topics: [],
      publishedAt: item.publishedAt,
      effectiveLabel: 'Historical evidence',
      source: {
        name: 'U.S. Bureau of Economic Analysis',
        url: item.url,
        retrievedAt: now,
        rights:
          'BEA-authored public-domain statistical information with attribution.',
      },
      sourceHash: sourceHash(item.url, item.quote),
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
          title: 'Historical GDP revision',
          family: 'gdp',
          geography: ['United States'],
          claimKind: 'fact',
          explanation:
            'Historical original same-quarter real annualized GDP estimates only.',
          announcedAt: '2025-09-25T12:30:00.000Z',
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
    draft = extractBeaGdpDraft(publicEvent);
  for (const model of [draft.model]) {
    const input = EventScenarioInputSchema.parse({
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: id,
      eventVersion: 1,
      revisionReason: 'Historical retained offline calculation',
      model,
    });
    const result = calculateEventScenario(input, publicEvent, now);
    expect(result.delta).toBe('0.5');
    expect(result.comparison).toBe('vintage-revision');
    expect(result.meaning).toContain('not a consensus surprise');
    if (model.family !== 'gdp') throw Error('Expected GDP model.');
    expect(() =>
      calculateEventScenario(
        { ...input, model: { ...model, basis: 'nominal-year-on-year' } },
        publicEvent,
        now,
      ),
    ).toThrow();
  }
});
