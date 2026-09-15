import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import {
  FeedItemSchema,
  EventPublicSchema,
  EventScenarioInputSchema,
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
  calculateEventScenario,
  exactEventDelta,
  buildEventRevision,
  SecurityIdentitySchema,
} from '../../../../packages/contracts/src/index';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
async function fixture() {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const original = bundle.feed.find(
    (item) => item.id.startsWith('fed-') && item.sourceHash,
  )!;
  const now = new Date().toISOString(),
    title = 'Synthetic reported value 2.9 percent; previous value 3.0 percent.';
  const source = FeedItemSchema.parse({
    ...original,
    title,
    summary: title,
    body: title,
    sourceHash: createHash('sha256').update(title).digest('hex'),
    publishedAt: now,
    source: { ...original.source, retrievedAt: now },
  });
  const identity = SecurityIdentitySchema.parse({
    isin: 'INE002A01018',
    version: 1,
    resolution: 'matched',
    candidates: [
      {
        figi: 'BBG000000001',
        name: 'Synthetic company',
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
  const id = randomUUID();
  const event = buildEventRevision(
    id,
    1,
    now,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic family golden fixture',
      editorial: {
        title: 'Synthetic event family measurement',
        family: 'Synthetic test family',
        geography: ['India'],
        claimKind: 'fact',
        explanation: 'Synthetic fixture only, not a live market observation.',
        announcedAt: now,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: source.version,
            hash: source.sourceHash!,
            field: 'title',
            quote: title,
          },
        ],
        links: [
          {
            kind: 'instrument',
            isin: identity.isin,
            identityVersion: 1,
            citation: 0,
            rationale: 'Synthetic company evidence context.',
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
  });
  bundle.feed = [source];
  bundle.histories = { [source.id]: [source] };
  bundle.events = [publicEvent];
  bundle.securities = { items: [identity], limited: false };
  bundle.securityHistories = { [identity.isin]: { revisions: [identity] } };
  const input = EventScenarioInputSchema.parse({
    requestId: randomUUID(),
    expectedVersion: 0,
    eventId: id,
    eventVersion: 1,
    revisionReason: 'Synthetic golden measurement comparison.',
    model: {
      family: 'inflation',
      index: 'headline-CPI',
      basis: 'year-on-year',
      adjustment: 'not-seasonally-adjusted',
      unit: 'percent',
      observed: { value: '2.9', citation: 0, period: 'Synthetic July' },
      reference: {
        value: '3.0',
        citation: 0,
        period: 'Synthetic June',
        kind: 'prior-observation',
      },
    },
  });
  return { bundle, input, publicEvent, now };
}
test('E2E-OFFLINE-1020 installed source-bound scenario re-admits exact event and hides changed source without network @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const { handleEventScenarios } =
    await import('../../../../apps/web/src/offline/event-scenarios');
  const { bundle, input, publicEvent, now } = await fixture(),
    id = randomUUID();
  const receipt = EventScenarioReceiptSchema.parse({
    id,
    version: 1,
    createdAt: now,
    policy: 'source-bound-event-delta-v1',
    input,
    event: publicEvent,
    result: calculateEventScenario(input, publicEvent, now),
  });
  const snapshot = {
    capturedAt: now,
    items: [
      { id, state: 'published', receipt, reviewedAt: now, reviewReasons: [] },
    ],
    histories: {
      [id]: { versions: [{ version: 1, createdAt: now }], nextBefore: null },
    },
  };
  const extended = bundle as OfflineBundle & { eventScenarios?: unknown };
  extended.eventScenarios = snapshot;
  const state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Scenario offline read must not use network.');
  };
  try {
    const request = {
      path: '/api/v1/event-scenarios/' + id,
      method: 'GET',
      headers: new Headers(),
      body: undefined,
      query: new URLSearchParams(),
    };
    expect(
      EventScenarioPublicSchema.parse(
        (await handleEventScenarios(request, state, extended))!.body,
      ).receipt?.result.delta,
    ).toBe('-0.1');
    bundle.events = [{ ...publicEvent, status: 'withdrawn', event: null }];
    expect(
      EventScenarioPublicSchema.parse(
        (await handleEventScenarios(request, state, extended))!.body,
      ),
    ).toMatchObject({ state: 'unavailable', receipt: null });
    await expect(
      handleEventScenarios(
        { ...request, path: '/api/v1/ops/event-scenarios', method: 'PUT' },
        state,
        extended,
      ),
    ).rejects.toThrow(/connected Operations/);
    expect(state.data).toEqual({});
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-1021 seven family golden comparisons distinguish prior expectation scenario and regulatory context @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const { input, publicEvent, now } = await fixture();
  const numericModel = input.model;
  if (!('observed' in numericModel)) throw Error('Numeric fixture required.');
  const common = {
    observed: numericModel.observed,
    reference: numericModel.reference,
  };
  const models = [
    {
      family: 'policy-rate',
      authority: 'RBI',
      measure: 'policy-rate',
      unit: 'percent',
      ...common,
    },
    {
      family: 'policy-rate',
      authority: 'Federal Reserve',
      measure: 'target-upper-bound',
      unit: 'percent',
      ...common,
    },
    numericModel,
    {
      family: 'gdp',
      basis: 'real-year-on-year',
      vintage: 'advance',
      unit: 'percent',
      ...common,
    },
    {
      family: 'earnings',
      isin: 'INE002A01018',
      metric: 'profit-after-tax',
      basis: 'consolidated',
      unit: 'INR-crore',
      ...common,
    },
    {
      family: 'guidance',
      isin: 'INE002A01018',
      measure: 'margin',
      unit: 'percent',
      ...common,
    },
    {
      family: 'flows',
      participant: 'FPI',
      segment: 'cash-equity-provisional',
      unit: 'INR-crore',
      ...common,
    },
  ];
  for (const model of models) {
    const result = calculateEventScenario(
      EventScenarioInputSchema.parse({ ...input, model }),
      publicEvent,
      now,
    );
    expect(result.delta).toBe('-0.1');
    expect(result.direction).toBe('down');
    expect(result.comparison).toBe('prior-change');
  }
  const regulation = calculateEventScenario(
    EventScenarioInputSchema.parse({
      ...input,
      model: {
        family: 'regulatory',
        authority: 'SEBI',
        category: 'rule-change',
        citation: 0,
        interpretation: 'Synthetic legal interpretation; requires review.',
      },
    }),
    publicEvent,
    now,
  );
  expect(regulation.direction).toBe('not-quantified');
  expect(regulation.delta).toBeNull();
  const noReference = calculateEventScenario(
    { ...input, model: { ...numericModel, reference: null } },
    publicEvent,
    now,
  );
  expect(noReference.comparison).toBe('no-reference');
  expect(() =>
    calculateEventScenario(
      {
        ...input,
        model: {
          ...numericModel,
          observed: { ...numericModel.observed, value: '2' },
        },
      },
      publicEvent,
      now,
    ),
  ).toThrow(/exact standalone token/);
  expect(() =>
    calculateEventScenario(
      {
        ...input,
        model: {
          ...numericModel,
          reference: {
            value: '3.0',
            period: numericModel.observed.period,
            citation: 0,
            kind: 'published-expectation',
          },
        },
      },
      publicEvent,
      now,
    ),
  ).toThrow(/predate/);
  expect(
    calculateEventScenario(
      {
        ...input,
        model: {
          ...numericModel,
          reference: {
            value: '3.0',
            period: numericModel.observed.period,
            citation: null,
            kind: 'scenario-assumption',
          },
        },
      },
      publicEvent,
      now,
    ).comparison,
  ).toBe('hypothetical');
  expect(calculateEventScenario(input, publicEvent, now)).toMatchObject({
    delta: '-0.1',
    direction: 'down',
    comparison: 'prior-change',
  });
});
test('E2E-OFFLINE-1022 official historical CPI arithmetic golden is a prior change not invented consensus @EVENT-SCENARIOS-001', () => {
  // BLS July 2024 archived release, Table4 US city average July/June annual rates.
  // Primary source consulted read-only 2026-09-14; not a provider-ingestion acceptance claim.
  const evidence = {
    url: 'https://www.bls.gov/news.release/archives/cpi_08142024.htm',
    publishedOn: '2024-08-14',
    observedPeriod: 'July 2024',
    observed: '2.9',
    referencePeriod: 'June 2024',
    reference: '3.0',
    basis: 'CPI-U annual change, not seasonally adjusted',
    referenceKind: 'prior-observation',
  };
  expect(exactEventDelta(evidence.observed, evidence.reference)).toBe('-0.1');
  expect(evidence.referenceKind).toBe('prior-observation');
  expect(exactEventDelta('0.00000001', '-0.00000001')).toBe('0.00000002');
  expect(exactEventDelta('3.0', '3')).toBe('0');
});
