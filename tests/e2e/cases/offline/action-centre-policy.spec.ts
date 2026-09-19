import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  buildEventRevision,
  currentPublications,
  SecurityIdentitySchema,
  SavedGoalSchema,
  HoldingsSnapshotSchema,
  EventPublicSchema,
  ResearchGovernanceRevisionSchema,
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
  ActionCentreChoicesSchema,
} from '../../../../packages/contracts/src/index';
import { actionCentreInput } from '../../helpers/action-centre';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';
// Reuses the existing OFFLINE960 retained-source, reviewed synthetic event and financial fixture.
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

test('E2E-OFFLINE-1295 downloaded educational policy binds exact source and receipt and rejects expiry changed source and removed release without network @DEV-019 @ACTION-CENTRE-001 @TEST-SIMULATION', async () => {
  const { handleActionCentre, exportLocalActionCentre } =
    await import('../../../../apps/web/src/offline/action-centre');
  const f = await fixture(),
    id = randomUUID();
  // Same explicitly synthetic conservative limits as the real two-reviewer governance fixture.
  const revision = ResearchGovernanceRevisionSchema.parse({
    id,
    version: 1,
    recordedAt: f.now,
    event: f.publicEvent,
    input: {
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: f.publicEvent.id,
      eventVersion: 1,
      title: 'Synthetic conservative educational limits',
      reviewBy: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      rationale:
        'Synthetic editorial limits for invariant acceptance, not legal limits or investment advice.',
      citations: [0],
      content: {
        kind: 'educational-policy',
        rules: {
          maximumConcentrationBps: 5000,
          turnoverBudgetBps: 1000,
          minimumCooldownDays: 10,
          minimumDownsideStressBps: 2000,
        },
        adviceEnabled: false,
        tradeExecution: false,
      },
    },
  });
  f.bundle.researchGovernance = {
    capturedAt: f.now,
    policies: [revision],
    contexts: [],
  };
  const input = {
    ...actionCentreInput(f.goal.id),
    researchPolicy: { id, version: 1 },
  };
  const request = {
    path: '/api/v1/account/action-centre/' + randomUUID(),
    method: 'PUT',
    headers: new Headers(),
    query: new URLSearchParams(),
    body: input,
  };
  const originalFetch = globalThis.fetch,
    before = structuredClone({
      goals: f.state.data.localGoals,
      holdings: f.state.data.localHoldings,
    });
  let network = 0;
  globalThis.fetch = async () => {
    network++;
    throw Error('Downloaded action policy must not contact network.');
  };
  try {
    const choices = ActionCentreChoicesSchema.parse(
      (await handleActionCentre(
        {
          ...request,
          path: '/api/v1/account/action-centre/choices',
          method: 'GET',
        },
        f.state,
        f.bundle,
      ))!.body,
    );
    expect(choices.researchPolicies).toEqual([revision]);
    const receipt = ActionCentreReceiptSchema.parse(
      (await handleActionCentre(request, f.state, f.bundle))!.body,
    );
    expect(receipt.researchPolicy).toEqual(revision);
    expect(receipt.result.action).toBe('none-educational-comparison');
    expect(receipt.result.baseline.projectedGoalMinor).toBe('2200');
    expect(
      receipt.result.constraints.find((row) => row.id === 'turnover')?.status,
    ).toBe('breached');
    expect(
      (await handleActionCentre(request, structuredClone(f.state), f.bundle))!
        .body,
    ).toEqual(receipt);
    expect(
      exportLocalActionCentre(f.state, f.state.sessionUserId!).assessments,
    ).toEqual([receipt]);
    const changedSource = structuredClone(f.bundle),
      boundSource = revision.event.event!.sources[0]!;
    // Controlled downloaded source revision, retaining the exact original version in history.
    const replacement = { ...boundSource, version: boundSource.version + 1 };
    changedSource.feed = changedSource.feed.map((source) =>
      source.id === boundSource.id ? replacement : source,
    );
    changedSource.histories[boundSource.id] = [
      ...(changedSource.histories[boundSource.id] ?? []),
      boundSource,
      replacement,
    ];
    const expired = structuredClone(f.bundle);
    expired.researchGovernance = {
      capturedAt: f.now,
      policies: [
        {
          ...revision,
          input: {
            ...revision.input,
            reviewBy: new Date(Date.now() - 86400000)
              .toISOString()
              .slice(0, 10),
          },
        },
      ],
      contexts: [],
    };
    const removed = structuredClone(f.bundle);
    removed.researchGovernance = {
      capturedAt: f.now,
      policies: [],
      contexts: [],
    };
    for (const bundle of [expired, changedSource, removed]) {
      const unavailable = ActionCentreChoicesSchema.parse(
        (await handleActionCentre(
          {
            ...request,
            path: '/api/v1/account/action-centre/choices',
            method: 'GET',
          },
          f.state,
          bundle,
        ))!.body,
      );
      expect(unavailable.researchPolicies).toEqual([]);
      await expect(
        handleActionCentre(
          { ...request, path: '/api/v1/account/action-centre/' + randomUUID() },
          f.state,
          bundle,
        ),
      ).rejects.toThrow(/current admitted policy/);
      const listed = ActionCentreListSchema.parse(
        (await handleActionCentre(
          { ...request, path: '/api/v1/account/action-centre', method: 'GET' },
          f.state,
          bundle,
        ))!.body,
      );
      expect(listed.assessments).toHaveLength(1);
      expect(listed.assessments[0]!.receipt).toEqual(receipt);
      expect(listed.assessments[0]!.reviewReasons).toContain(
        'Bound policy is unavailable, expired or no longer admitted in this downloaded snapshot.',
      );
    }
    await expect(
      handleActionCentre(
        {
          ...request,
          path: '/api/v1/account/action-centre/' + randomUUID(),
          body: { ...input, researchPolicy: { id, version: 2 } },
        },
        f.state,
        f.bundle,
      ),
    ).rejects.toThrow(/current admitted policy/);
    expect({
      goals: f.state.data.localGoals,
      holdings: f.state.data.localHoldings,
    }).toEqual(before);
    expect(network).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
