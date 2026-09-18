import {
  transmissionFor,
  ResearchGovernanceRevisionSchema,
} from '../../../../packages/contracts/src/index';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  buildEventRevision,
  currentPublications,
  SecurityIdentitySchema,
  SavedGoalSchema,
  HoldingsSnapshotSchema,
  ImpactTraceReceiptSchema,
  ImpactTraceListSchema,
  EventPublicSchema,
  buildImpactTrace,
  impactEquityBindings,
  equityTraceWarnings,
  EquityCompanySchema,
} from '../../../../packages/contracts/src/index';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
async function fixture(family = 'Oil input context') {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (item) =>
      item.status === 'published' && item.sourceHash && item.title.length >= 8,
  )!;
  const now = new Date().toISOString(),
    id = randomUUID(),
    userId = randomUUID();
  const identity = SecurityIdentitySchema.parse({
    isin: 'INE002A01018',
    version: 1,
    resolution: 'matched',
    candidates: [
      {
        figi: 'BBG000000001',
        name: 'Synthetic impact identity',
        ticker: 'SYN',
        exchCode: 'IN',
        securityType: 'Common Stock',
        marketSector: 'Equity',
        compositeFIGI: null,
        shareClassFIGI: null,
      },
    ],
    retrievedAt: now,
    checkedAt: now,
    sourceHash: 'a'.repeat(64),
    source: 'OpenFIGI',
    sourceUrl: 'https://api.openfigi.com/v3/mapping',
    termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
    mappingPolicy: 'india-common-stock-v1',
  });
  const event = buildEventRevision(
    id,
    1,
    now,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic golden contextual trace',
      editorial: {
        title: 'Synthetic evidence trace',
        family,
        geography: ['India'],
        claimKind: 'inference',
        explanation:
          'Synthetic association; no measured economic transmission.',
        effectiveAt: null,
        announcedAt: null,
        citations: [
          {
            sourceId: source.id,
            version: source.version,
            hash: source.sourceHash!,
            field: 'title',
            quote: source.title,
          },
        ],
        links: [
          {
            kind: 'sector',
            label: 'Synthetic sector',
            citation: 0,
            rationale: 'Synthetic reviewed sector relationship.',
          },
          {
            kind: 'instrument',
            isin: identity.isin,
            identityVersion: 1,
            citation: 0,
            rationale: 'Synthetic reviewed company relationship.',
          },
        ],
      },
    },
    [source],
    [identity],
    randomUUID,
  );
  event.graph.events[0]!.publicationState = 'published';
  for (const edge of event.graph.edges) edge.reviewState = 'reviewed';
  expect(event.graph.events[0]!.publicationState).toBe('published');
  expect(event.graph.edges).not.toHaveLength(0);
  expect(
    event.graph.edges.every((edge) => edge.reviewState === 'reviewed'),
  ).toBe(true);
  const publicEvent = EventPublicSchema.parse({
    id,
    status: 'published',
    event,
    evaluatedAt: now,
    reviewedAt: now,
  });
  bundle.events = [publicEvent];
  bundle.securities = { items: [identity], limited: false };
  bundle.securityHistories = { [identity.isin]: { revisions: [identity] } };
  bundle.equityCoverage = { capturedAt: now, companies: [] };
  const goal = SavedGoalSchema.parse({
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
  });
  const holdings = HoldingsSnapshotSchema.parse({
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
  const state: LocalState = {
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
  };
  const input = {
    eventId: id,
    eventVersion: 1,
    sector: 'Synthetic sector',
    isin: identity.isin,
    holdingsVersion: 1,
    goalId: goal.id,
    goalVersion: 1,
    acknowledgedLimits: true as const,
    storageConsent: true as const,
    equityBindings: [],
  };
  return { bundle, state, input, publicEvent, holdings, goal, now };
}
test('E2E-OFFLINE-960 local trace exact receipt persists replay source withdrawal and deletion without network @IMPACT-TRACE-001 @TEST-SIMULATION', async () => {
  const { handleImpactTraces, exportLocalImpactTraces } =
    await import('../../../../apps/web/src/offline/impact-trace');
  const { bundle, state, input } = await fixture(),
    id = randomUUID(),
    originalFetch = globalThis.fetch;
  const financialBefore = JSON.stringify([
    state.data.localGoals,
    state.data.localHoldings,
  ]);
  globalThis.fetch = async () => {
    throw Error('Offline trace must never fetch.');
  };
  try {
    const request = {
      path: '/api/v1/account/impact-traces/' + id,
      method: 'PUT',
      headers: new Headers(),
      query: new URLSearchParams(),
      body: input,
    };
    const receipt = ImpactTraceReceiptSchema.parse(
      (await handleImpactTraces(request, state, bundle))!.body,
    );
    expect(receipt.holding.quantity).toBe('3.000001');
    expect(receipt.noAction.projectedMinor).toBe('2200');
    expect(receipt.quantifiedImpact).toBeNull();
    expect(
      (await handleImpactTraces(request, structuredClone(state), bundle))!.body,
    ).toEqual(receipt);
    expect(exportLocalImpactTraces(state, state.sessionUserId!).traces).toEqual(
      [receipt],
    );
    bundle.events = [{ ...receipt.event, status: 'withdrawn', event: null }];
    const list = ImpactTraceListSchema.parse(
      (await handleImpactTraces(
        { ...request, path: '/api/v1/account/impact-traces', method: 'GET' },
        state,
        bundle,
      ))!.body,
    );
    expect(list.traces[0]!.reviewReasons).toContain(
      'Event or evidence is withdrawn, conflicting, or unavailable.',
    );
    await expect(
      handleImpactTraces(
        { ...request, path: '/api/v1/account/impact-traces/' + randomUUID() },
        state,
        bundle,
      ),
    ).rejects.toThrow(/unavailable/);
    await handleImpactTraces({ ...request, method: 'DELETE' }, state, bundle);
    expect(exportLocalImpactTraces(state, state.sessionUserId!).traces).toEqual(
      [],
    );
    await expect(handleImpactTraces(request, state, bundle)).rejects.toThrow(
      /deleted/,
    );
    expect(
      JSON.stringify([state.data.localGoals, state.data.localHoldings]),
    ).toBe(financialBefore);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-961 golden equity conflict values and exact edition binding refuse silent replacement @IMPACT-TRACE-001 @TEST-SIMULATION', async () => {
  const { input, publicEvent, holdings, goal, now } = await fixture();
  const firstId = randomUUID(),
    secondId = randomUUID();
  const equity = EquityCompanySchema.parse({
    isin: input.isin,
    name: 'Synthetic company',
    truncated: false,
    records: [firstId, secondId].map((editionId, index) => ({
      editionId,
      sourceUrl: 'https://www.nseindia.com/',
      hash: String(index + 1).repeat(64),
      retrievedAt: now,
      publishedAt: now,
      observation: {
        kind: 'price',
        isin: input.isin,
        effectiveOn: now.slice(0, 10),
        sourceRow: index + 1,
        exchange: 'NSE',
        currency: 'INR',
        close: index ? '101.01' : '100.00',
        volume: '1000',
        adjusted: false,
      },
    })),
  });
  expect(
    equityTraceWarnings(equity).some((warning) =>
      warning.includes('Conflicting published equity values'),
    ),
  ).toBe(true);
  expect(() =>
    buildImpactTrace(
      randomUUID(),
      input,
      publicEvent,
      holdings,
      [goal],
      now,
      equity,
    ),
  ).toThrow(/company evidence changed/);
  const receipt = buildImpactTrace(
    randomUUID(),
    { ...input, equityBindings: impactEquityBindings(equity) },
    publicEvent,
    holdings,
    [goal],
    now,
    equity,
  );
  expect(
    ImpactTraceReceiptSchema.safeParse({
      ...receipt,
      noAction: { ...receipt.noAction, gapMinor: '1' },
    }).success,
  ).toBe(false);
  expect(receipt.equity).toEqual(equity);
  expect(receipt.quantifiedImpact).toBeNull();
  expect(receipt.noAction.holdingCostMinor).toBe('10000');
  expect(() =>
    buildImpactTrace(
      randomUUID(),
      { ...input, sector: 'Unreviewed' },
      publicEvent,
      holdings,
      [goal],
      now,
    ),
  ).toThrow(/same source excerpt/);
});

test('E2E-OFFLINE-1700 exact downloaded mechanism binds local receipt and removed release rejects new trace @IMPACT-TRACE-001 @TEST-SIMULATION', async () => {
  const { handleImpactTraces } =
    await import('../../../../apps/web/src/offline/impact-trace');
  const f = await fixture('earnings'),
    id = randomUUID();
  const revision = ResearchGovernanceRevisionSchema.parse({
    id,
    version: 1,
    recordedAt: f.now,
    event: f.publicEvent,
    input: {
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: f.input.eventId,
      eventVersion: 1,
      title: 'Synthetic released earnings channel',
      reviewBy: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      rationale:
        'Synthetic company mapping independently reviewed for offline acceptance.',
      citations: [0],
      content: {
        kind: 'causal-context',
        transmission: transmissionFor('earnings'),
        sector: f.input.sector,
        isin: f.input.isin,
        direction: 'mixed',
        horizon: 'Next reporting period',
        limitations:
          'No actual measured stock response or earnings sensitivity.',
        quantifiedImpact: null,
      },
    },
  });
  f.bundle.researchGovernance = {
    capturedAt: f.now,
    policies: [],
    contexts: [revision],
  };
  const request = {
    path: '/api/v1/account/impact-traces/' + randomUUID(),
    method: 'PUT',
    headers: new Headers(),
    query: new URLSearchParams(),
    body: { ...f.input, causalContext: { id, version: 1 } },
  };
  const receipt = ImpactTraceReceiptSchema.parse(
    (await handleImpactTraces(request, f.state, f.bundle))!.body,
  );
  expect(receipt.transmission).toMatchObject({
    reviewId: id,
    binding: { family: 'earnings' },
    holdingAction: 'unchanged',
    goalAction: 'unchanged',
    numericalImpact: null,
  });
  expect(() =>
    ImpactTraceReceiptSchema.parse({
      ...receipt,
      transmission: {
        ...receipt.transmission!,
        outcome: 'qualitative-context-only',
      },
    }),
  ).toThrow();
  f.bundle.researchGovernance = {
    capturedAt: f.now,
    policies: [],
    contexts: [],
  };
  await expect(
    handleImpactTraces(
      { ...request, path: '/api/v1/account/impact-traces/' + randomUUID() },
      f.state,
      f.bundle,
    ),
  ).rejects.toThrow();
});
