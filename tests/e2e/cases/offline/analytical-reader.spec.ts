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
  EvidenceExplanationSchema,
  EventScenarioPublicSchema,
} from '../../../../packages/contracts/src/index';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
import { handleContent } from '../../../../apps/web/src/offline/content';
async function fixture() {
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
  const input = EventScenarioInputSchema.parse({
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: id,
      eventVersion: 1,
      revisionReason: 'Historical offline reader projection fixture',
      model: draft.lower,
    }),
    scenarioId = randomUUID();
  const scenario = EventScenarioPublicSchema.parse({
    id: scenarioId,
    state: 'published',
    reviewedAt: now,
    reviewReasons: ['Historical evidence beyond the 30-day context window.'],
    receipt: {
      id: scenarioId,
      version: 1,
      createdAt: now,
      policy: 'source-bound-event-delta-v1',
      input,
      event: publicEvent,
      result: calculateEventScenario(input, publicEvent, now),
    },
  });
  const base = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const bundle: OfflineBundle = {
    ...base,
    feed: sources,
    histories: {},
    events: [publicEvent],
    eventLineage: {},
    eventScenarios: { capturedAt: now, items: [scenario], histories: {} },
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request: OfflineRequest = {
    path: '/api/v1/discovery/items/' + sources[0]!.id + '/explanation',
    method: 'GET',
    query: new URLSearchParams({ expectedVersion: '1' }),
    headers: new Headers(),
    body: undefined,
  };
  return { bundle, state, request, sources };
}
test('E2E-OFFLINE-1500 snapshot analytical projection uses actual event admission and retains historical limits @DEV-016 @TEST-SIMULATION', async () => {
  const f = await fixture();
  const value = EvidenceExplanationSchema.parse(
    (await handleContent(f.request, f.state, f.bundle))?.body,
  );
  expect(value.analysis.scenarios).toBe('reviewed');
  expect(value.reviewedScenarios[0]?.receipt?.result.delta).toBe('-0.5');
  expect(value.bundleGeneratedAt).toBe(f.bundle.generatedAt);
});
test('E2E-OFFLINE-1501 withdrawn companion source removes downloaded scenario and old bundles remain explicit @DEV-016 @TEST-SIMULATION', async () => {
  const f = await fixture();
  const withdrawn = FeedItemSchema.parse({
    ...f.sources[1],
    version: 2,
    status: 'withdrawn',
  });
  const value = EvidenceExplanationSchema.parse(
    (
      await handleContent(f.request, f.state, {
        ...f.bundle,
        histories: { [withdrawn.id]: [withdrawn] },
      })
    )?.body,
  );
  expect(value.reviewedScenarios).toEqual([]);
  const older = { ...f.bundle };
  delete older.eventScenarios;
  const missing = EvidenceExplanationSchema.parse(
    (await handleContent(f.request, f.state, older))?.body,
  );
  expect(missing.analysis.scenarios).toBe('unavailable');
});
test('E2E-OFFLINE-1502 released qualitative snapshot context is admitted then removed when its review window expires @DEV-016 @TEST-SIMULATION', async () => {
  const f = await fixture(),
    now = new Date().toISOString(),
    id = randomUUID(),
    source = f.sources[0]!;
  const event = buildEventRevision(
    id,
    1,
    now,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic offline qualitative context fixture',
      editorial: {
        title: 'Synthetic qualitative interpretation',
        family: 'policy-rate',
        geography: ['United States'],
        claimKind: 'inference',
        explanation: 'Synthetic interpretation, no quantified effect.',
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
        links: [
          {
            kind: 'sector',
            label: 'Synthetic sector',
            citation: 0,
            rationale: 'Synthetic reviewed qualitative context only.',
          },
        ],
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
  });
  const revision = {
    id: randomUUID(),
    version: 1,
    recordedAt: now,
    event: publicEvent,
    input: {
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: id,
      eventVersion: 1,
      title: 'Synthetic released qualitative interpretation',
      reviewBy: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      rationale:
        'Synthetic retained interpretation for offline admission, not a forecast.',
      citations: [0],
      content: {
        kind: 'causal-context',
        sector: 'Synthetic sector',
        isin: null,
        direction: 'unknown',
        horizon: 'Synthetic future period',
        limitations:
          'No actual portfolio or causal magnitude is established by this test context.',
        quantifiedImpact: null,
      },
    },
  };
  const bundle = {
    ...f.bundle,
    events: [publicEvent],
    researchGovernance: { capturedAt: now, policies: [], contexts: [revision] },
    eventScenarios: undefined,
  };
  let value = EvidenceExplanationSchema.parse(
    (await handleContent(f.request, f.state, bundle))?.body,
  );
  expect(value.analysis.causalInference).toBe('reviewed-qualitative');
  expect(value.reviewedContexts).toHaveLength(1);
  revision.input.reviewBy = '2000-01-01';
  value = EvidenceExplanationSchema.parse(
    (await handleContent(f.request, f.state, bundle))?.body,
  );
  expect(value.reviewedContexts).toEqual([]);
});
