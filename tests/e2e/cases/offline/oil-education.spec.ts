import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  FeedItemSchema,
  SecurityIdentitySchema,
  EventPublicSchema,
  buildEventRevision,
  ResearchGovernanceRevisionSchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  ImpactTraceReceiptSchema,
  ImpactTraceListSchema,
  OIL_EDUCATION_ANCHOR,
  OIL_EDUCATION_SOURCE,
  OIL_EDUCATION_ISIN,
} from '../../../../packages/contracts/src/index';
import { handleImpactTraces } from '../../../../apps/web/src/offline/impact-trace';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1470 retained issuer fuel proof reconstructs six-step private receipt and rejects withdrawn context without network @DEV-010 @TEST-SIMULATION', async () => {
  const now = new Date().toISOString(),
    id = randomUUID(),
    userId = randomUUID(),
    source = FeedItemSchema.parse({
      id: 'oil-education-' + randomUUID(),
      version: 1,
      kind: 'news',
      title: 'Historical issuer fuel-cost excerpt; simulated admission',
      summary:
        'Actual minimal issuer excerpt, simulated publication admission.',
      body: OIL_EDUCATION_ANCHOR,
      topics: [],
      publishedAt: now,
      effectiveLabel:
        'Issuer report date 2026-04-01; exact release time unknown',
      source: {
        name: 'IndiGo',
        url: OIL_EDUCATION_SOURCE,
        retrievedAt: now,
        rights:
          'TEST-SIMULATION minimal quotation, no live source permission asserted.',
      },
      sourceHash: 'a'.repeat(64),
      importance: 1,
      relatedIds: [],
      status: 'published',
      reviewedAt: now,
      correctionNote: null,
    }),
    identity = SecurityIdentitySchema.parse({
      isin: OIL_EDUCATION_ISIN,
      version: 1,
      resolution: 'matched',
      candidates: [
        {
          figi: 'BBG000000001',
          name: 'Actual issuer identity; simulated provider admission',
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
    event = buildEventRevision(
      id,
      1,
      now,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason:
          'Historical minimal issuer excerpt; isolated admission.',
        editorial: {
          title: 'Historical fuel-cost evidence',
          family: 'Aviation fuel input-cost pressure',
          geography: ['India'],
          claimKind: 'fact',
          explanation:
            'Issuer reports partial fare pass-through, not a forecast.',
          announcedAt: null,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: 1,
              hash: source.sourceHash!,
              field: 'body',
              quote: OIL_EDUCATION_ANCHOR,
            },
          ],
          links: [
            {
              kind: 'sector',
              label: 'Airlines',
              citation: 0,
              rationale: 'Issuer airline fuel-cost context.',
            },
            {
              kind: 'instrument',
              isin: identity.isin,
              identityVersion: 1,
              citation: 0,
              rationale: 'Actual issuer ISIN; simulated provider admission.',
            },
          ],
        },
      },
      [source],
      [identity],
      randomUUID,
    );
  event.graph.events[0]!.publicationState = 'published';
  expect(event.graph.edges.length).toBeGreaterThan(0);
  for (const edge of event.graph.edges) edge.reviewState = 'reviewed';
  const publicEvent = EventPublicSchema.parse({
      id,
      status: 'published',
      event,
      reviewedAt: now,
      evaluatedAt: now,
    }),
    context = ResearchGovernanceRevisionSchema.parse({
      id: randomUUID(),
      version: 1,
      recordedAt: now,
      event: publicEvent,
      input: {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId: id,
        eventVersion: 1,
        title: 'Qualitative issuer fuel-cost context',
        reviewBy: now.slice(0, 10),
        rationale:
          'Actual issuer describes partial offset; no universal coefficient or share-price effect.',
        citations: [0],
        content: {
          kind: 'causal-context',
          sector: 'Airlines',
          isin: identity.isin,
          direction: 'mixed',
          horizon: 'Historical issuer reporting context',
          limitations:
            'Demand, fuel arrangements and FX can change operating effects.',
          quantifiedImpact: null,
        },
      },
    }),
    goal = SavedGoalSchema.parse({
      id: randomUUID(),
      version: 1,
      name: 'Synthetic goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '1000',
      monthlyMinor: '100',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
      createdAt: now,
      updatedAt: now,
      projectedMinor: '2200',
      gapMinor: '97800',
    }),
    holdings = HoldingsSnapshotSchema.parse({
      version: 1,
      holdings: [
        { isin: identity.isin, quantity: '3.000001', totalCostMinor: '10000' },
      ],
      totalCostMinor: '10000',
      currency: 'INR',
      scale: 2,
      provenance: 'user-entered-unverified',
      updatedAt: now,
    });
  const bundle: OfflineBundle = {
      generatedAt: now,
      feed: [source],
      histories: { [source.id]: [source] },
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
      events: [publicEvent],
      securities: { items: [identity], limited: false },
      securityHistories: { [identity.isin]: { revisions: [identity] } },
      equityCoverage: { capturedAt: now, companies: [] },
      researchGovernance: {
        capturedAt: now,
        policies: [],
        contexts: [context],
      },
    },
    state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      sessionUserId: userId,
      users: {
        [userId]: {
          id: userId,
          username: 'synthetic',
          createdAt: now,
          consentedAt: now,
          passwordHash: 'synthetic',
          passwordSalt: 'synthetic',
        },
      },
      data: {
        localGoals: {
          [userId]: { [goal.id]: { revisions: [goal], deletedAt: null } },
        },
        localHoldings: { [userId]: { revisions: [holdings], previews: {} } },
      },
    },
    input = {
      educationalPack: 'indigo-atf-context-2026-v1',
      causalContext: { id: context.id, version: 1 },
      eventId: id,
      eventVersion: 1,
      sector: 'Airlines',
      isin: identity.isin,
      holdingsVersion: 1,
      goalId: goal.id,
      goalVersion: 1,
      equityBindings: [],
      acknowledgedLimits: true,
      storageConsent: true,
    },
    request = {
      path: '/api/v1/account/impact-traces/' + randomUUID(),
      method: 'PUT',
      body: input,
      headers: new Headers(),
      query: new URLSearchParams(),
    },
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Offline oil trace must not fetch.');
  };
  try {
    const receipt = ImpactTraceReceiptSchema.parse(
      (await handleImpactTraces(request, state, bundle))!.body,
    );
    expect(receipt.oilEducation?.sourceDate).toBe('2026-04-01');
    expect(receipt.chain).toHaveLength(6);
    expect(receipt.noAction).toMatchObject({
      projectedMinor: '2200',
      gapMinor: '97800',
      holdingCostMinor: '10000',
    });
    expect(receipt.quantifiedImpact).toBeNull();
    expect((await handleImpactTraces(request, state, bundle))!.body).toEqual(
      receipt,
    );
    bundle.researchGovernance = { capturedAt: now, policies: [], contexts: [] };
    await expect(
      handleImpactTraces(
        { ...request, path: '/api/v1/account/impact-traces/' + randomUUID() },
        state,
        bundle,
      ),
    ).rejects.toThrow('context');
    const saved = ImpactTraceListSchema.parse(
      (await handleImpactTraces(
        { ...request, path: '/api/v1/account/impact-traces', method: 'GET' },
        state,
        bundle,
      ))!.body,
    );
    expect(saved.traces[0]!.reviewReasons.join(' ')).toContain('context');
    expect(saved.traces[0]!.receipt).toEqual(receipt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
