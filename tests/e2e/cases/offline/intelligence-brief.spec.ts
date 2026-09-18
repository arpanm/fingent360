import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  FeedItemSchema,
  SecurityIdentitySchema,
  EventPublicSchema,
  buildEventRevision,
  IntelligenceBriefReceiptSchema,
  IntelligenceBriefPublicSchema,
  projectIntelligenceBrief,
  OIL_EDUCATION_ANCHOR,
  OIL_EDUCATION_SOURCE,
  OIL_EDUCATION_ISIN,
  type FeedItem,
} from '../../../../packages/contracts/src/index';
import {
  parseHistoricalFedPolicy,
  FED_POLICY_HISTORY_URLS,
} from '../../../../apps/api/src/fed-policy-provider';
import { parseHistoricalBeaGdp } from '../../../../apps/api/src/bea-gdp-history-provider';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import { handleIntelligenceBriefs } from '../../../../apps/web/src/offline/intelligence-brief';
import type { OfflineBundle } from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1520 five retained actual-source points re-admit installed evidence and hide withdrawal without invented replacements @DEV-006 @TEST-SIMULATION', async () => {
  const now = new Date().toISOString(),
    sources: FeedItem[] = [
      FeedItemSchema.parse({
        id: 'oil-education-' + randomUUID(),
        version: 1,
        kind: 'news',
        title: 'Historical issuer fuel-cost evidence',
        summary: 'Historical issuer partial fare pass-through.',
        body: OIL_EDUCATION_ANCHOR,
        topics: [],
        publishedAt: now,
        effectiveLabel:
          'Issuer report date 2026-04-01; exact release time unknown',
        source: {
          name: 'IndiGo',
          url: OIL_EDUCATION_SOURCE,
          retrievedAt: now,
          rights: 'TEST-SIMULATION minimal excerpt and simulated admission.',
        },
        sourceHash: 'a'.repeat(64),
        importance: 1,
        relatedIds: [],
        status: 'published',
        reviewedAt: now,
        correctionNote: null,
      }),
    ];
  for (const [index, date] of ['20240731', '20240918'].entries()) {
    const url = FED_POLICY_HISTORY_URLS[index]!,
      body = await readFile(
        new URL(
          `../../../../packages/contracts/test/fixtures/fomc-${date}.html.txt`,
          import.meta.url,
        ),
        'utf8',
      );
    sources.push({
      ...parseHistoricalFedPolicy({
        url,
        body,
        hash: sourceHash(url, body),
        retrievedAt: now,
      }),
      status: 'published',
      reviewedAt: now,
    });
  }
  const pack = JSON.parse(
    await readFile(
      new URL(
        '../../../../packages/contracts/test/fixtures/bea-gdp-2025-vintages.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { sources: { url: string; quote: string }[] };
  for (const row of pack.sources)
    sources.push({
      ...parseHistoricalBeaGdp({
        url: row.url,
        body: row.quote,
        hash: sourceHash(row.url, row.quote),
        retrievedAt: now,
      }),
      status: 'published',
      reviewedAt: now,
    });
  const identity = SecurityIdentitySchema.parse({
      isin: OIL_EDUCATION_ISIN,
      version: 1,
      resolution: 'matched',
      candidates: [
        {
          figi: 'BBG000000001',
          name: 'Actual issuer identity; synthetic resolver admission',
          ticker: 'INDIGO',
          exchCode: 'IN',
          securityType: 'Common Stock',
          marketSector: 'Equity',
          compositeFIGI: null,
          shareClassFIGI: null,
        },
      ],
      retrievedAt: now,
      checkedAt: now,
      sourceHash: 'b'.repeat(64),
      source: 'OpenFIGI',
      sourceUrl: 'https://api.openfigi.com/v3/mapping',
      termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
      mappingPolicy: 'india-common-stock-v1',
    }),
    events = sources.map((source, index) => {
      const id = randomUUID(),
        event = buildEventRevision(
          id,
          1,
          now,
          {
            requestId: randomUUID(),
            expectedVersion: 0,
            revisionReason: 'Real historical source, synthetic admission only.',
            editorial: {
              title: source.title,
              family: 'Historical source context',
              geography: [index ? 'United States' : 'India'],
              claimKind: 'fact',
              explanation: source.summary,
              announcedAt: index ? source.publishedAt : null,
              effectiveAt: null,
              citations: [
                {
                  sourceId: source.id,
                  version: source.version,
                  hash: source.sourceHash!,
                  field: 'body',
                  quote: source.body,
                },
              ],
              links: index
                ? []
                : [
                    {
                      kind: 'sector',
                      label: 'Airlines',
                      citation: 0,
                      rationale: 'Issuer airline fuel-cost disclosure.',
                    },
                    {
                      kind: 'instrument',
                      isin: identity.isin,
                      identityVersion: 1,
                      citation: 0,
                      rationale: 'Actual issuer; synthetic resolver admission.',
                    },
                  ],
            },
          },
          [source],
          index ? [] : [identity],
          randomUUID,
        );
      event.graph.events[0]!.publicationState = 'published';
      for (const edge of event.graph.edges) edge.reviewState = 'reviewed';
      return EventPublicSchema.parse({
        id,
        status: 'published',
        event,
        reviewedAt: now,
        evaluatedAt: now,
      });
    }),
    id = randomUUID(),
    receipt = IntelligenceBriefReceiptSchema.parse({
      id,
      version: 1,
      preparedAt: now,
      input: {
        requestId: randomUUID(),
        expectedVersion: 0,
        title: 'Five historical sourced points',
        reason: 'Real historical source facts with simulated review admission.',
        events: events.map((event) => ({ id: event.id, version: 1 })),
      },
      events,
    }),
    view = projectIntelligenceBrief(receipt, events, now, now),
    bundle: OfflineBundle = {
      generatedAt: now,
      feed: sources,
      histories: Object.fromEntries(
        sources.map((source) => [source.id, [source]]),
      ),
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
      events,
      securities: { items: [identity], limited: false },
      securityHistories: { [identity.isin]: { revisions: [identity] } },
      intelligenceBriefs: {
        capturedAt: now,
        items: [view],
        histories: {
          [id]: { versions: [{ version: 1, issuedAt: now }], nextBefore: null },
        },
      },
    },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    request = {
      path: '/api/v1/intelligence-briefs/' + id,
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    },
    oldFetch = globalThis.fetch;
  expect(
    events.every((item) =>
      item.event!.graph.edges.every((edge) => edge.reviewState === 'reviewed'),
    ),
  ).toBe(true);
  globalThis.fetch = async () => {
    throw Error('Offline brief must not fetch.');
  };
  try {
    const admitted = IntelligenceBriefPublicSchema.parse(
      (await handleIntelligenceBriefs(request, state, bundle))!.body,
    );
    expect(
      admitted.points.filter((point) => point.status === 'current'),
    ).toHaveLength(5);
    bundle.events = events.slice(1);
    const missing = IntelligenceBriefPublicSchema.parse(
      (await handleIntelligenceBriefs(request, state, bundle))!.body,
    );
    expect(missing.points).toHaveLength(5);
    expect(missing.points[0]).toMatchObject({
      status: 'unavailable',
      event: null,
    });
    expect(
      missing.points.filter((point) => point.status === 'current'),
    ).toHaveLength(4);
    bundle.events = events;
    bundle.histories[sources[0]!.id] = [
      { ...sources[0]!, version: 2, status: 'withdrawn' },
    ];
    const changed = IntelligenceBriefPublicSchema.parse(
      (await handleIntelligenceBriefs(request, state, bundle))!.body,
    );
    expect(changed.points).toHaveLength(5);
    expect(changed.points[0]).toMatchObject({
      status: 'unavailable',
      event: null,
    });
    expect(
      changed.points.filter((point) => point.status === 'current'),
    ).toHaveLength(4);
    await expect(
      handleIntelligenceBriefs(
        { ...request, path: '/api/v1/ops/intelligence-briefs', method: 'PUT' },
        state,
        bundle,
      ),
    ).rejects.toThrow('connected API');
  } finally {
    globalThis.fetch = oldFetch;
  }
});
