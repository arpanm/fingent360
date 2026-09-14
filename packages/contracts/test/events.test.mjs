import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  FeedItemSchema,
  EventRevisionSchema,
  EventPublicSchema,
  EventSaveSchema,
  buildEventRevision,
  DomainEvidenceGraphSchema,
  eventSourcesCurrent,
} from '../dist/index.js';
test('event graph adapts an actual captured source with explicit unknown editorial context and exact revision references', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const source = bundle.feed
    .map((value) => FeedItemSchema.parse(value))
    .find(
      (value) =>
        value.status === 'published' &&
        value.sourceHash &&
        value.title.length >= 8,
    );
  assert.ok(source);
  const input = EventSaveSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    revisionReason: 'Synthetic contract fixture',
    editorial: {
      title: 'Synthetic context',
      family: 'Policy',
      geography: ['India'],
      claimKind: 'inference',
      explanation: 'Synthetic authored context, not a market effect.',
      announcedAt: null,
      effectiveAt: null,
      citations: [
        {
          sourceId: source.id,
          version: source.version,
          hash: source.sourceHash,
          field: 'title',
          quote: source.title,
        },
      ],
      links: [
        {
          kind: 'sector',
          label: 'Synthetic editorial sector',
          citation: 0,
          rationale: 'Explicit contextual association only.',
        },
      ],
    },
  });
  const event = buildEventRevision(
    randomUUID(),
    1,
    new Date(
      Math.max(Date.now(), Date.parse(source.source.retrievedAt)),
    ).toISOString(),
    input,
    [source],
    [],
    randomUUID,
  );
  assert.equal(event.graph.edges[0].direction, 'unknown');
  assert.equal(event.graph.edges[0].horizon, null);
  assert.equal(event.graph.edges[0].claimKind, 'inference');
  assert.equal(event.graph.events[0].publicationState, 'candidate');
  assert.equal(eventSourcesCurrent(event, [source]), true);
  assert.equal(
    eventSourcesCurrent(event, [{ ...source, version: source.version + 1 }]),
    false,
  );
  const mismatched = structuredClone(event);
  mismatched.sources[0].body = 'Invented replacement body';
  assert.equal(eventSourcesCurrent(mismatched, [source]), false);
  const mismatchedId = structuredClone(event);
  mismatchedId.id = randomUUID();
  assert.equal(EventRevisionSchema.safeParse(mismatchedId).success, false);
  assert.equal(
    EventPublicSchema.safeParse({
      id: randomUUID(),
      status: 'published',
      event,
      evaluatedAt: event.recordedAt,
      reviewedAt: event.recordedAt,
    }).success,
    false,
  );
  const malformed = structuredClone(event.graph);
  malformed.evidence[0].document.version = 2;
  assert.equal(DomainEvidenceGraphSchema.safeParse(malformed).success, false);
  const invalid = structuredClone(input);
  invalid.editorial.links[0].citation = 1;
  assert.equal(EventSaveSchema.safeParse(invalid).success, false);
  assert.equal(
    EventSaveSchema.safeParse({ ...input, marketEffect: 'positive' }).success,
    false,
  );
});
