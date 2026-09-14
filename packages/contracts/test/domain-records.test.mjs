import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainEvidenceGraphSchema,
  DomainLotSchema,
  DomainPortfolioSchema,
  DomainProfileSchema,
  DomainPolicyPackSchema,
  DomainPolicyResultSchema,
  MacroObservationSchema,
  IndianIsinSchema,
} from '../dist/index.js';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  at = '2026-09-14T00:00:00.000Z',
  ref = (n) => ({ id: id(n), version: 1 }),
  revision = (n) => ({
    ...ref(n),
    createdAt: at,
    supersedesVersion: null,
    revisionReason: null,
  });
function fixture() {
  const document = {
    ...revision(1),
    source: {
      name: 'Synthetic source only',
      url: 'https://example.com/synthetic',
      retrievedAt: at,
      rights: 'Synthetic fixture; no provider claim',
    },
    contentHash: 'a'.repeat(64),
    publishedAt: null,
    claimKind: 'scenario',
  };
  const event = {
    ...revision(2),
    title: 'Synthetic oil exercise',
    family: 'synthetic',
    geography: ['India'],
    claimKind: 'scenario',
    publicationState: 'reviewed',
    announcedAt: null,
    effectiveAt: null,
    evidence: [ref(3)],
  };
  const edge = {
    ...revision(4),
    from: ref(2),
    to: ref(5),
    direction: 'unknown',
    mechanism: 'Synthetic mechanism, not verified exposure',
    horizon: { minimumDays: 1, maximumDays: 30 },
    evidence: [ref(6)],
    reviewState: 'candidate',
    modelVersion: 'synthetic-v1',
    invalidation: 'Missing source invalidates this illustration',
    claimKind: 'inference',
  };
  const graph = {
    documents: [document],
    events: [event],
    nodes: [
      { ...ref(2), kind: 'event', label: 'Synthetic event', isin: null },
      {
        ...ref(5),
        kind: 'instrument',
        label: 'Synthetic instrument identifier fixture',
        isin: 'INE002A01018',
      },
    ],
    edges: [edge],
    evidence: [
      {
        ...revision(3),
        document: ref(1),
        contentHash: document.contentHash,
        claim: ref(2),
        relation: 'supports',
        locator: 'Synthetic paragraph1',
      },
      {
        ...revision(6),
        document: ref(1),
        contentHash: document.contentHash,
        claim: ref(4),
        relation: 'supports',
        locator: 'Synthetic paragraph2',
      },
    ],
  };
  const holding = {
    isin: 'INE002A01018',
    quantity: '1.000001',
    totalCostMinor: '9007199254740993',
  };
  const portfolio = {
    ...revision(10),
    ownerId: id(99),
    currency: 'INR',
    scale: 2,
    holdings: [holding],
    totalCostMinor: holding.totalCostMinor,
    lots: [
      {
        ...revision(11),
        ownerId: id(99),
        portfolioId: id(10),
        holding: {
          ...holding,
          quantity: '1',
          totalCostMinor: '9007199254740992',
        },
        acquiredOn: '2026-09-13',
        provenance: 'user-entered-unverified',
        currency: 'INR',
        scale: 2,
      },
      {
        ...revision(12),
        ownerId: id(99),
        portfolioId: id(10),
        holding: { ...holding, quantity: '0.000001', totalCostMinor: '1' },
        acquiredOn: null,
        provenance: 'user-entered-unverified',
        currency: 'INR',
        scale: 2,
      },
    ],
  };
  const profile = {
    ...revision(13),
    ownerId: id(99),
    currency: 'INR',
    scale: 2,
    monthlyIncomeMinor: null,
    monthlyCommittedMinor: null,
    liquidSavingsMinor: null,
    riskTolerance: 'unknown',
    horizonMonths: null,
    provenance: 'user-entered-unverified',
    consentedAt: at,
  };
  const result = {
    ...revision(14),
    ownerId: id(99),
    portfolio: ref(10),
    profile: ref(13),
    goals: [],
    evidence: [ref(3), ref(6)],
    policyVersion: 'synthetic-education-v1',
    evaluatedAt: at,
    freshness: { state: 'unknown', ruleVersion: 'synthetic-v1' },
    conflicting: false,
    status: 'unable_to_assess',
    reasons: ['Synthetic example only'],
    blockers: ['Freshness not established'],
    comparator: 'leave-recorded-portfolio-unchanged',
    claimKind: 'scenario',
    action: 'none',
  };
  return {
    portfolio,
    profile,
    goals: { ownerId: id(99), records: { goals: [] } },
    graph,
    result,
  };
}
function currentFixture() {
  const value = fixture();
  Object.assign(value.profile, {
    monthlyIncomeMinor: '10000000',
    monthlyCommittedMinor: '3000000',
    liquidSavingsMinor: '0',
    riskTolerance: 'medium',
    horizonMonths: 120,
  });
  value.graph.edges[0].reviewState = 'reviewed';
  Object.assign(value.result, {
    freshness: { state: 'current', ruleVersion: 'synthetic-v1' },
    status: 'no_review_trigger',
    blockers: [],
  });
  const goal = {
    ...ref(20),
    name: 'Synthetic education goal',
    type: 'education',
    targetMinor: '200000',
    savedMinor: '12345',
    monthlyMinor: '1001',
    horizonMonths: 120,
    currency: 'INR',
    scale: 2,
    assumptions: 'no-growth-nominal-v1',
    storageConsent: true,
    createdAt: at,
    updatedAt: at,
    projectedMinor: '132465',
    gapMinor: '67535',
  };
  value.goals.records.goals = [goal, { ...goal, id: id(21) }];
  value.result.goals = [ref(20), ref(21)];
  return value;
}
test('DOMAIN-CONTRACTS-002 exact golden pack preserves beyond-safe-integer cost and unknowns', () => {
  const value = fixture(),
    before = structuredClone(value);
  const parsed = DomainPolicyPackSchema.parse(value);
  assert.equal(parsed.portfolio.totalCostMinor, '9007199254740993');
  assert.equal(parsed.profile.monthlyIncomeMinor, null);
  assert.equal(parsed.graph.events[0].announcedAt, null);
  assert.deepEqual(value, before);
});
test('lot reconciliation rejects one paise/millionth mismatch, duplicate, orphan and foreign ownership', () => {
  for (const change of [
    (v) => (v.lots[1].holding.totalCostMinor = '2'),
    (v) => (v.lots[1].holding.quantity = '0.000002'),
    (v) => v.lots.push(v.lots[0]),
    (v) => (v.holdings = []),
    (v) => (v.lots[0].ownerId = id(98)),
    (v) => (v.currency = 'USD'),
    (v) => (v.lots[0].acquiredOn = '2026-02-30'),
    (v) => (v.lots[0].holding.quantity = 'NaN'),
    (v) => (v.totalCostMinor = 'Infinity'),
  ]) {
    const v = fixture().portfolio;
    change(v);
    assert.equal(DomainPortfolioSchema.safeParse(v).success, false);
  }
});
test('graph rejects dangling/mismatched evidence, wrong endpoint and causal cycles', () => {
  for (const change of [
    (g) => (g.evidence[0].contentHash = 'b'.repeat(64)),
    (g) => (g.events[0].evidence = [ref(6)]),
    (g) => (g.edges[0].to = ref(90)),
    (g) => (g.edges[0].to = ref(2)),
    (g) =>
      Object.assign(g.documents[0], {
        version: 2,
        supersedesVersion: 1,
        revisionReason: 'Synthetic corrected document',
      }),
    (g) => (g.edges[0].horizon.minimumDays = 31),
    (g) => (g.nodes[1].isin = null),
  ]) {
    const g = fixture().graph;
    change(g);
    assert.equal(DomainEvidenceGraphSchema.safeParse(g).success, false);
  }
});
test('educational result refuses confident stale/conflicting assessments and any trade field', () => {
  for (const change of [
    (r) => (r.status = 'review'),
    (r) => (r.action = 'buy'),
    (r) => (r.tradeQuantity = '1'),
    (r) => (r.blockers = []),
    (r) => (r.comparator = 'rebalance'),
  ]) {
    const r = fixture().result;
    change(r);
    assert.equal(DomainPolicyResultSchema.safeParse(r).success, false);
  }
  const r = fixture().result;
  r.freshness.state = 'current';
  r.blockers = [];
  r.status = 'no_review_trigger';
  assert.equal(DomainPolicyResultSchema.safeParse(r).success, true);
  r.freshness.state = 'stale';
  assert.equal(DomainPolicyResultSchema.safeParse(r).success, false);
  r.freshness.state = 'current';
  r.conflicting = true;
  assert.equal(DomainPolicyResultSchema.safeParse(r).success, false);
});
test('owned policy pack rejects wrong input owner/version and look-ahead evidence', () => {
  for (const change of [
    (v) => (v.graph.events[0].createdAt = '2026-09-15T00:00:00.000Z'),
    (v) => (v.graph.edges[0].createdAt = '2026-09-15T00:00:00.000Z'),
    (v) => (v.result.portfolio.version = 2),
    (v) => v.result.evidence.push(ref(3)),
    (v) => (v.graph.documents[0].createdAt = '2026-09-15T00:00:00.000Z'),
    (v) => (v.goals.ownerId = id(98)),
    (v) => (v.result.goals = [ref(99)]),
    (v) => (v.result.evidence = [ref(99)]),
    (v) =>
      (v.graph.documents[0].source.retrievedAt = '2026-09-15T00:00:00.000Z'),
  ]) {
    const v = fixture();
    change(v);
    assert.equal(DomainPolicyPackSchema.safeParse(v).success, false);
  }
});
test('profile and revision design rejects unknown fields and invalid predecessor/consent', () => {
  for (const change of [
    (v) => (v.guaranteedReturn = '12'),
    (v) => (v.version = 2),
    (v) => (v.consentedAt = '2026-09-15T00:00:00.000Z'),
    (v) => (v.monthlyIncomeMinor = '1.5'),
  ]) {
    const v = fixture().profile;
    change(v);
    assert.equal(DomainProfileSchema.safeParse(v).success, false);
  }
  const v = fixture().profile;
  v.version = 2;
  v.supersedesVersion = 1;
  v.revisionReason = 'Synthetic explicit correction';
  assert.equal(DomainProfileSchema.safeParse(v).success, true);
});

test('DOMAIN-CONTRACTS-002 reconstructs current and revised packs with two independent goals of the same type', () => {
  const original = currentFixture(),
    before = structuredClone(original);
  const parsed = DomainPolicyPackSchema.parse(original);
  assert.deepEqual(parsed, before);
  assert.equal(parsed.goals.records.goals[0].projectedMinor, '132465');
  assert.equal(parsed.goals.records.goals[0].gapMinor, '67535');
  assert.notEqual(
    parsed.goals.records.goals[0].id,
    parsed.goals.records.goals[1].id,
  );
  const revised = structuredClone(original);
  Object.assign(revised.profile, {
    version: 2,
    supersedesVersion: 1,
    revisionReason: 'Synthetic explicit income correction',
    monthlyIncomeMinor: '10000001',
  });
  revised.result.profile.version = 2;
  Object.assign(revised.result, {
    version: 2,
    supersedesVersion: 1,
    revisionReason: 'Synthetic result using corrected inputs',
  });
  const rebuilt = DomainPolicyPackSchema.parse(
    JSON.parse(JSON.stringify(revised)),
  );
  assert.deepEqual(rebuilt, revised);
  assert.deepEqual(original, before);
  assert.equal(
    DomainPolicyPackSchema.safeParse({
      ...revised,
      result: { ...revised.result, profile: ref(13) },
    }).success,
    false,
  );
  const empty = fixture().portfolio;
  Object.assign(empty, { holdings: [], lots: [], totalCostMinor: '0' });
  assert.deepEqual(DomainPortfolioSchema.parse(empty), empty);
});

test('DOMAIN-CONTRACTS-002 rejects lots unavailable at capture, including a one-microsecond difference', () => {
  const lot = fixture().portfolio.lots[0];
  lot.acquiredOn = '2026-09-15';
  assert.equal(DomainLotSchema.safeParse(lot).success, false);
  for (const createdAt of [
    '2026-09-15T00:00:00.000Z',
    '2026-09-14T00:00:00.000001Z',
  ]) {
    const value = fixture().portfolio;
    value.lots[0].createdAt = createdAt;
    assert.equal(DomainPortfolioSchema.safeParse(value).success, false);
  }
  const value = fixture().portfolio;
  value.createdAt = '2026-09-14T00:00:00.000001Z';
  value.lots[0].createdAt = '2026-09-14T00:00:00.000001000Z';
  assert.deepEqual(DomainPortfolioSchema.parse(value), value);
});

test('DOMAIN-CONTRACTS-002 enforces exact selected-goal projections and known-at chronology', () => {
  for (const change of [
    (v) => (v.goals.records.goals[0].projectedMinor = '132466'),
    (v) => (v.goals.records.goals[0].gapMinor = '67534'),
    (v) => (v.goals.records.goals[0].createdAt = '2026-09-14T00:00:00.000001Z'),
    (v) => (v.goals.records.goals[0].updatedAt = '2026-09-14T00:00:00.000001Z'),
    (v) => (v.graph.events[0].createdAt = '2026-09-14T00:00:00.000001Z'),
    (v) => (v.result.evaluatedAt = '2026-09-14T00:00:00.000001Z'),
    (v) => (v.profile.consentedAt = '2026-09-14T00:00:00.000001Z'),
  ]) {
    const value = currentFixture();
    change(value);
    assert.equal(DomainPolicyPackSchema.safeParse(value).success, false);
  }
});

test('DOMAIN-CONTRACTS-002 cannot hide unknown profile or unreviewed and withdrawn claim inputs behind current freshness', () => {
  for (const change of [
    (v) => (v.profile.monthlyIncomeMinor = null),
    (v) => (v.profile.monthlyCommittedMinor = null),
    (v) => (v.profile.liquidSavingsMinor = null),
    (v) => (v.profile.riskTolerance = 'unknown'),
    (v) => (v.profile.horizonMonths = null),
    (v) => (v.graph.events[0].publicationState = 'candidate'),
    (v) => (v.graph.events[0].publicationState = 'withdrawn'),
    (v) => (v.graph.edges[0].reviewState = 'candidate'),
    (v) => (v.graph.edges[0].reviewState = 'withdrawn'),
  ]) {
    const value = currentFixture();
    change(value);
    assert.equal(DomainPolicyPackSchema.safeParse(value).success, false);
    value.result.status = 'unable_to_assess';
    value.result.blockers = ['Synthetic unavailable input retained'];
    assert.equal(DomainPolicyPackSchema.safeParse(value).success, true);
  }
});

test('DOMAIN-CONTRACTS-002 retains contradictory evidence even when a result selects only supporting evidence', () => {
  const value = currentFixture();
  value.graph.evidence.push({
    ...value.graph.evidence[0],
    ...revision(30),
    relation: 'contradicts',
    locator: 'Synthetic opposing paragraph',
  });
  // A back-reference alone cannot add evidence outside the immutable claim.
  assert.equal(DomainEvidenceGraphSchema.safeParse(value.graph).success, false);
  value.graph.events[0].evidence.push(ref(30));
  assert.equal(DomainEvidenceGraphSchema.safeParse(value.graph).success, true);
  assert.equal(
    value.result.evidence.some((r) => r.id === id(30)),
    false,
  );
  assert.equal(DomainPolicyPackSchema.safeParse(value).success, false);
  Object.assign(value.result, {
    conflicting: true,
    status: 'unable_to_assess',
    blockers: ['Synthetic unresolved contradictory evidence'],
  });
  assert.equal(DomainPolicyPackSchema.safeParse(value).success, true);
  value.graph.evidence[2].createdAt = '2026-09-14T00:00:00.000001Z';
  assert.equal(DomainPolicyPackSchema.safeParse(value).success, false);
});

test('DOMAIN-CONTRACTS-002 reuses instrument and observation primitives without a live provider fixture', () => {
  assert.equal(IndianIsinSchema.parse('INE002A01018'), 'INE002A01018');
  assert.equal(IndianIsinSchema.safeParse('INE002A01019').success, false);
  const observation = {
    id: id(40),
    indicator: 'FP.CPI.TOTL.ZG',
    year: 2025,
    value: '-0.123456789012345678901234567890',
    unit: 'annual_percent',
    country: 'IND',
    providerUpdatedAt: '2026-09-13',
    retrievedAt: at,
    sourceHash: 'c'.repeat(64),
    sourceUrl: 'https://example.com/synthetic-observation',
    revision: 1,
    supersedesId: null,
  };
  assert.deepEqual(MacroObservationSchema.parse(observation), observation);
  assert.equal(
    MacroObservationSchema.parse({ ...observation, value: null }).value,
    null,
  );
  for (const change of [
    { value: '-1e-3' },
    { value: 'NaN' },
    { value: 0.1 },
    { value: '0.1234567890123456789012345678901' },
    { unit: 'percentage_points' },
    { claimOfLiveData: true },
  ])
    assert.equal(
      MacroObservationSchema.safeParse({ ...observation, ...change }).success,
      false,
    );
});

test('DOMAIN-CONTRACTS-002 reconstructs all graph node kinds and rejects a multi-edge cycle', () => {
  const graph = fixture().graph;
  graph.nodes.push(
    { ...ref(7), kind: 'factor', label: 'Synthetic factor', isin: null },
    { ...ref(8), kind: 'sector', label: 'Synthetic sector', isin: null },
  );
  graph.edges[0].to = ref(7);
  graph.edges.push(
    {
      ...graph.edges[0],
      ...revision(31),
      from: ref(7),
      to: ref(8),
      evidence: [ref(33)],
    },
    {
      ...graph.edges[0],
      ...revision(32),
      from: ref(8),
      to: ref(5),
      evidence: [ref(34)],
    },
  );
  graph.evidence.push(
    { ...graph.evidence[1], ...revision(33), claim: ref(31) },
    { ...graph.evidence[1], ...revision(34), claim: ref(32) },
  );
  const before = structuredClone(graph);
  assert.deepEqual(
    DomainEvidenceGraphSchema.parse(JSON.parse(JSON.stringify(graph))),
    before,
  );
  assert.deepEqual(graph, before);
  graph.edges[2].to = ref(2);
  assert.equal(DomainEvidenceGraphSchema.safeParse(graph).success, false);
});
