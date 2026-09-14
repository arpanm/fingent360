import { z } from 'zod';
import { AccountHoldingSchema, HoldingRowsSchema } from './holdings.js';
import { GoalMoneySchema, SavedGoalsSchema, goalProjection } from './goals.js';
import { quantityMillionths } from './allocations.js';
import { FeedItemSchema } from './discovery.js';
const UUID = z.uuid(),
  Hash = z.string().regex(/^[a-f0-9]{64}$/),
  Text = z.string().trim().min(1).max(2000);
// Zod validates UTC timestamps before these comparisons. Preserve fractional
// seconds rather than rounding different known-at instants to one millisecond.
function after(a: string, b: string): boolean {
  const [aw = '', af = ''] = a.slice(0, -1).split('.'),
    [bw = '', bf = ''] = b.slice(0, -1).split('.'),
    wholeA = aw.padEnd(19, ':00'),
    wholeB = bw.padEnd(19, ':00'),
    precision = Math.max(af.length, bf.length);
  return (
    wholeA > wholeB ||
    (wholeA === wholeB && af.padEnd(precision, '0') > bf.padEnd(precision, '0'))
  );
}
export const DomainRevisionRefSchema = z.strictObject({
  id: UUID,
  version: z.number().int().positive(),
});
const revision = {
  id: UUID,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  supersedesVersion: z.number().int().positive().nullable(),
  revisionReason: Text.nullable(),
};
function revisionValid(
  v: {
    version: number;
    supersedesVersion: number | null;
    revisionReason: string | null;
  },
  c: z.RefinementCtx,
) {
  if (
    v.version === 1
      ? v.supersedesVersion !== null || v.revisionReason !== null
      : v.supersedesVersion !== v.version - 1 || !v.revisionReason
  )
    c.addIssue({
      code: 'custom',
      message:
        'A revision requires its exact preceding version and reason; first versions have neither.',
    });
}
const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const t = Date.parse(v + 'T00:00:00.000Z');
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
  }, 'Invalid calendar date.');
export const DomainDocumentSchema = z
  .strictObject({
    ...revision,
    source: FeedItemSchema.shape.source,
    contentHash: Hash,
    publishedAt: z.iso.datetime().nullable(),
    claimKind: z.enum(['fact', 'expectation', 'scenario', 'inference']),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    if (after(v.source.retrievedAt, v.createdAt))
      c.addIssue({
        code: 'custom',
        message: 'Document capture precedes retrieval.',
      });
  });
export const DomainEvidenceSchema = z
  .strictObject({
    ...revision,
    document: DomainRevisionRefSchema,
    contentHash: Hash,
    claim: DomainRevisionRefSchema,
    relation: z.enum(['supports', 'contradicts']),
    locator: Text,
  })
  .superRefine(revisionValid);
export const DomainEventSchema = z
  .strictObject({
    ...revision,
    title: z.string().trim().min(1).max(500),
    family: z.string().trim().min(1).max(80),
    geography: z.array(z.string().min(1).max(80)).min(1).max(20),
    claimKind: z.enum(['fact', 'expectation', 'scenario', 'inference']),
    publicationState: z.enum([
      'candidate',
      'reviewed',
      'published',
      'withdrawn',
    ]),
    announcedAt: z.iso.datetime().nullable(),
    effectiveAt: z.iso.datetime().nullable(),
    evidence: z.array(DomainRevisionRefSchema).min(1).max(40),
  })
  .superRefine(revisionValid);
export const DomainNodeSchema = z
  .strictObject({
    id: UUID,
    version: z.number().int().positive(),
    kind: z.enum(['event', 'factor', 'sector', 'instrument']),
    label: z.string().trim().min(1).max(200),
    isin: AccountHoldingSchema.shape.isin.nullable(),
  })
  .superRefine((v, c) => {
    if ((v.kind === 'instrument') !== (v.isin !== null))
      c.addIssue({
        code: 'custom',
        message: 'Only instrument nodes require an Indian ISIN.',
      });
  });
export const DomainEdgeSchema = z
  .strictObject({
    ...revision,
    from: DomainRevisionRefSchema,
    to: DomainRevisionRefSchema,
    direction: z.enum(['positive', 'negative', 'mixed', 'unknown']),
    mechanism: Text,
    horizon: z.strictObject({
      minimumDays: z.number().int().min(0).max(36500),
      maximumDays: z.number().int().min(0).max(36500),
    }),
    evidence: z.array(DomainRevisionRefSchema).min(1).max(40),
    reviewState: z.enum(['candidate', 'reviewed', 'withdrawn']),
    modelVersion: z.string().min(1).max(80),
    invalidation: Text,
    claimKind: z.literal('inference'),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    if (v.horizon.minimumDays > v.horizon.maximumDays)
      c.addIssue({ code: 'custom', message: 'Horizon ends before it begins.' });
  });
const key = (r: { id: string; version: number }) => `${r.id}:${r.version}`;
export const DomainEvidenceGraphSchema = z
  .strictObject({
    documents: z.array(DomainDocumentSchema).max(100),
    evidence: z.array(DomainEvidenceSchema).max(400),
    events: z.array(DomainEventSchema).max(100),
    nodes: z.array(DomainNodeSchema).max(200),
    edges: z.array(DomainEdgeSchema).max(400),
  })
  .superRefine((g, c) => {
    const bad = (message: string) => c.addIssue({ code: 'custom', message });
    for (const rows of [g.documents, g.evidence, g.events, g.nodes, g.edges])
      if (new Set(rows.map(key)).size !== rows.length)
        bad('Duplicate record revision.');
    if (
      new Set([...g.events, ...g.edges].map(key)).size !==
      g.events.length + g.edges.length
    )
      bad('Ambiguous claim identity.');
    const documents = new Map(g.documents.map((v) => [key(v), v])),
      evidence = new Map(g.evidence.map((v) => [key(v), v])),
      nodes = new Map(g.nodes.map((v) => [key(v), v])),
      claims = new Map([...g.events, ...g.edges].map((v) => [key(v), v]));
    for (const e of g.evidence) {
      const d = documents.get(key(e.document));
      if (!d || d.contentHash !== e.contentHash)
        bad('Evidence document/version/hash mismatch.');
      else if (after(d.createdAt, e.createdAt))
        bad('Evidence predates its captured document.');
      const claim = claims.get(key(e.claim));
      if (!claim) bad('Evidence refers to an absent claim.');
      else if (!claim.evidence.some((ref) => key(ref) === key(e)))
        bad('Evidence is not listed by its claim revision.');
    }
    for (const claim of [...g.events, ...g.edges]) {
      if (new Set(claim.evidence.map(key)).size !== claim.evidence.length)
        bad('Repeated supporting evidence.');
      for (const ref of claim.evidence) {
        const e = evidence.get(key(ref));
        if (!e || key(e.claim) !== key(claim))
          bad('Claim evidence refers to another or absent claim.');
      }
    }
    for (const n of g.nodes)
      if (n.kind === 'event' && !g.events.some((e) => key(e) === key(n)))
        bad('Event node has no matching event revision.');
    const adjacency = new Map<string, string[]>();
    for (const e of g.edges) {
      if (!nodes.has(key(e.from)) || !nodes.has(key(e.to)))
        bad('Edge endpoint absent.');
      const a = adjacency.get(key(e.from)) ?? [];
      a.push(key(e.to));
      adjacency.set(key(e.from), a);
    }
    const visited = new Set<string>(),
      active = new Set<string>();
    function visit(k: string): boolean {
      if (active.has(k)) return false;
      if (visited.has(k)) return true;
      active.add(k);
      for (const next of adjacency.get(k) ?? []) if (!visit(next)) return false;
      active.delete(k);
      visited.add(k);
      return true;
    }
    for (const k of nodes.keys())
      if (!visit(k)) {
        bad('Cyclic causal path is unsupported.');
        break;
      }
  });
export const DomainLotSchema = z
  .strictObject({
    ...revision,
    ownerId: UUID,
    portfolioId: UUID,
    holding: AccountHoldingSchema,
    acquiredOn: DateOnly.nullable(),
    provenance: z.literal('user-entered-unverified'),
    currency: z.literal('INR'),
    scale: z.literal(2),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    if (v.acquiredOn && v.acquiredOn > v.createdAt.slice(0, 10))
      c.addIssue({
        code: 'custom',
        message: 'Acquisition follows lot capture.',
      });
  });
export const DomainPortfolioSchema = z
  .strictObject({
    ...revision,
    ownerId: UUID,
    currency: z.literal('INR'),
    scale: z.literal(2),
    holdings: HoldingRowsSchema,
    lots: z.array(DomainLotSchema).max(2000),
    totalCostMinor: z.string().regex(/^(0|[1-9][0-9]{0,19})$/),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    const bad = (message: string) => c.addIssue({ code: 'custom', message });
    if (
      !v.holdings.every((h) => AccountHoldingSchema.safeParse(h).success) ||
      !v.lots.every((l) => AccountHoldingSchema.safeParse(l.holding).success) ||
      !/^(0|[1-9][0-9]{0,19})$/.test(v.totalCostMinor)
    )
      return;
    if (new Set(v.lots.map((l) => l.id)).size !== v.lots.length)
      bad('Duplicate lot identity.');
    const totals = new Map<string, { quantity: bigint; cost: bigint }>();
    for (const lot of v.lots) {
      if (lot.ownerId !== v.ownerId || lot.portfolioId !== v.id)
        bad('Foreign lot ownership or portfolio.');
      if (after(lot.createdAt, v.createdAt))
        bad('Lot revision was recorded after the portfolio snapshot.');
      if (lot.acquiredOn && lot.acquiredOn > v.createdAt.slice(0, 10))
        bad('Acquisition after snapshot.');
      const old = totals.get(lot.holding.isin) ?? { quantity: 0n, cost: 0n };
      old.quantity += quantityMillionths(lot.holding.quantity);
      old.cost += BigInt(lot.holding.totalCostMinor);
      totals.set(lot.holding.isin, old);
    }
    let cost = 0n;
    for (const h of v.holdings) {
      const lots = totals.get(h.isin);
      if (
        !lots ||
        lots.quantity !== quantityMillionths(h.quantity) ||
        lots.cost !== BigInt(h.totalCostMinor)
      )
        bad('Lots must reconcile exactly to each holding.');
      cost += BigInt(h.totalCostMinor);
      totals.delete(h.isin);
    }
    if (totals.size) bad('Orphan lot without declared holding.');
    if (cost !== BigInt(v.totalCostMinor))
      bad('Declared portfolio cost mismatch.');
  });
export const DomainProfileSchema = z
  .strictObject({
    ...revision,
    ownerId: UUID,
    currency: z.literal('INR'),
    scale: z.literal(2),
    monthlyIncomeMinor: GoalMoneySchema.nullable(),
    monthlyCommittedMinor: GoalMoneySchema.nullable(),
    liquidSavingsMinor: GoalMoneySchema.nullable(),
    riskTolerance: z.enum(['low', 'medium', 'high', 'unknown']),
    horizonMonths: z.number().int().min(1).max(1200).nullable(),
    provenance: z.literal('user-entered-unverified'),
    consentedAt: z.iso.datetime(),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    if (after(v.consentedAt, v.createdAt))
      c.addIssue({
        code: 'custom',
        message: 'Consent follows recorded profile.',
      });
  });
export const DomainPolicyResultSchema = z
  .strictObject({
    ...revision,
    ownerId: UUID,
    portfolio: DomainRevisionRefSchema,
    profile: DomainRevisionRefSchema,
    goals: z.array(DomainRevisionRefSchema).max(100),
    evidence: z.array(DomainRevisionRefSchema).max(400),
    policyVersion: z.string().min(1).max(80),
    evaluatedAt: z.iso.datetime(),
    freshness: z.strictObject({
      state: z.enum(['current', 'stale', 'unknown']),
      ruleVersion: z.string().min(1).max(80),
    }),
    conflicting: z.boolean(),
    status: z.enum(['unable_to_assess', 'review', 'no_review_trigger']),
    reasons: z.array(Text).min(1).max(30),
    blockers: z.array(Text).max(30),
    comparator: z.literal('leave-recorded-portfolio-unchanged'),
    claimKind: z.literal('scenario'),
    action: z.literal('none'),
  })
  .superRefine((v, c) => {
    revisionValid(v, c);
    if (
      (v.freshness.state !== 'current' ||
        v.conflicting ||
        v.blockers.length > 0) &&
      v.status !== 'unable_to_assess'
    )
      c.addIssue({
        code: 'custom',
        message:
          'Uncertain/conflicting inputs cannot produce a confident assessment.',
      });
    if (v.status === 'unable_to_assess' && !v.blockers.length)
      c.addIssue({
        code: 'custom',
        message: 'Unavailable assessment requires explicit blockers.',
      });
    if (after(v.evaluatedAt, v.createdAt))
      c.addIssue({
        code: 'custom',
        message: 'Evaluation follows result capture.',
      });
  });
export const DomainPolicyPackSchema = z
  .strictObject({
    portfolio: DomainPortfolioSchema,
    profile: DomainProfileSchema,
    goals: z.strictObject({ ownerId: UUID, records: SavedGoalsSchema }),
    graph: DomainEvidenceGraphSchema,
    result: DomainPolicyResultSchema,
  })
  .superRefine((v, c) => {
    const bad = (message: string) => c.addIssue({ code: 'custom', message });
    const r = v.result;
    let unavailable =
      v.profile.monthlyIncomeMinor === null ||
      v.profile.monthlyCommittedMinor === null ||
      v.profile.liquidSavingsMinor === null ||
      v.profile.riskTolerance === 'unknown' ||
      v.profile.horizonMonths === null;
    let contradictory = false;
    if (
      r.ownerId !== v.portfolio.ownerId ||
      r.ownerId !== v.profile.ownerId ||
      r.ownerId !== v.goals.ownerId ||
      key(r.portfolio) !== key(v.portfolio) ||
      key(r.profile) !== key(v.profile)
    )
      bad('Policy input ownership/version mismatch.');
    if (
      new Set(r.goals.map(key)).size !== r.goals.length ||
      new Set(r.evidence.map(key)).size !== r.evidence.length
    )
      bad('Repeated policy input revision.');
    if (
      new Set(v.goals.records.goals.map(key)).size !==
      v.goals.records.goals.length
    )
      bad('Duplicate supplied goal revision.');
    for (const ref of r.goals) {
      const goal = v.goals.records.goals.find((g) => key(g) === key(ref));
      if (!goal) bad('Policy goal revision absent.');
      else {
        if (
          after(goal.createdAt, goal.updatedAt) ||
          after(goal.updatedAt, r.evaluatedAt)
        )
          bad('Goal unavailable at evaluation time.');
        if (
          [goal.targetMinor, goal.savedMinor, goal.monthlyMinor].every(
            (amount) => GoalMoneySchema.safeParse(amount).success,
          )
        ) {
          const expected = goalProjection(goal);
          if (
            goal.projectedMinor !== expected.projectedMinor ||
            goal.gapMinor !== expected.gapMinor
          )
            bad('Goal projection does not reconcile to its saved inputs.');
        }
      }
    }
    for (const ref of r.evidence) {
      const evidence = v.graph.evidence.find((e) => key(e) === key(ref));
      if (!evidence) bad('Policy evidence revision absent.');
      else {
        const claim = [...v.graph.events, ...v.graph.edges].find(
          (item) => key(item) === key(evidence.claim),
        );
        if (!claim || after(claim.createdAt, r.evaluatedAt))
          bad('Claim unavailable at evaluation time.');
        if (claim) {
          const state =
            'publicationState' in claim
              ? claim.publicationState
              : claim.reviewState;
          if (state === 'candidate' || state === 'withdrawn')
            unavailable = true;
          for (const related of claim.evidence) {
            const attached = v.graph.evidence.find(
              (e) => key(e) === key(related),
            );
            if (!attached) {
              bad('Claim evidence revision absent.');
              continue;
            }
            if (attached.relation === 'contradicts') contradictory = true;
            const document = v.graph.documents.find(
              (d) => key(d) === key(attached.document),
            );
            if (
              after(attached.createdAt, r.evaluatedAt) ||
              !document ||
              after(document.createdAt, r.evaluatedAt) ||
              after(document.source.retrievedAt, r.evaluatedAt)
            )
              bad('Evidence unavailable at evaluation time.');
          }
        }
      }
    }
    if (
      after(v.portfolio.createdAt, r.evaluatedAt) ||
      after(v.profile.createdAt, r.evaluatedAt)
    )
      bad('Policy input was recorded after evaluation.');
    if (contradictory && !r.conflicting)
      bad('Contradictory claim evidence must remain explicit in the result.');
    if ((unavailable || contradictory) && r.status !== 'unable_to_assess')
      bad(
        'Unknown, unreviewed, withdrawn or conflicting inputs require an unavailable assessment.',
      );
  });
