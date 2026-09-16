import {
  TransmissionOutcomeSchema,
  transmissionOutcome,
} from './transmission-context.js';
import { OilEducationProofSchema, oilEducationProof } from './oil-education.js';
import {
  ResearchPolicyBindingSchema,
  ResearchGovernanceRevisionSchema,
  governanceChecks,
  type ResearchGovernanceRevision,
} from './research-governance.js';
import { z } from 'zod';
import {
  EquityCompanySchema,
  equityObservationKey,
} from './equity-coverage.js';
import { EventPublicSchema, type EventRevision } from './events.js';
import {
  HoldingsSnapshotSchema,
  AccountHoldingSchema,
  type HoldingsSnapshot,
} from './holdings.js';
import { SavedGoalSchema, goalProjection, type SavedGoal } from './goals.js';

export const ImpactTraceInputSchema = z.strictObject({
  educationalPack: z.literal('indigo-atf-context-2026-v1').optional(),
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  causalContext: ResearchPolicyBindingSchema.optional(),
  sector: z.string().min(1).max(100),
  isin: AccountHoldingSchema.shape.isin,
  holdingsVersion: z.number().int().positive(),
  goalId: z.uuid(),
  goalVersion: z.number().int().positive(),
  equityBindings: z
    .array(
      z.strictObject({
        editionId: z.uuid(),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(1000),
  acknowledgedLimits: z.literal(true),
  storageConsent: z.literal(true),
});
export const ImpactTraceReceiptSchema = z
  .strictObject({
    oilEducation: OilEducationProofSchema.optional(),
    transmission: TransmissionOutcomeSchema.optional(),
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    policy: z.literal('reviewed-context-trace-v1'),
    input: ImpactTraceInputSchema,
    causalContext: ResearchGovernanceRevisionSchema.optional(),
    event: EventPublicSchema,
    holding: AccountHoldingSchema,
    goal: SavedGoalSchema,
    equity: EquityCompanySchema.nullable(),
    chain: z
      .array(
        z.strictObject({
          kind: z.enum([
            'evidence',
            'factor',
            'sector',
            'company',
            'holding',
            'goal',
          ]),
          claimKind: z.enum([
            'fact',
            'expectation',
            'scenario',
            'inference',
            'user-record',
          ]),
          label: z.string(),
          explanation: z.string(),
        }),
      )
      .length(6),
    uncertainties: z.array(z.string()).min(1),
    warnings: z.array(z.string()),
    quantifiedImpact: z.null(),
    noAction: z.strictObject({
      currency: z.literal('INR'),
      scale: z.literal(2),
      holdingCostMinor: z.string().regex(/^\d+$/),
      projectedMinor: z.string().regex(/^\d+$/),
      gapMinor: z.string().regex(/^\d+$/),
      assumption: z.literal('no-growth-nominal-v1'),
    }),
  })
  .superRefine((value, context) => {
    const expected = goalProjection(value.goal);
    try {
      if (
        JSON.stringify(
          traceTransmission(
            value.event,
            value.causalContext,
            value.input,
            value.createdAt,
            value.equity,
          ),
        ) !== JSON.stringify(value.transmission)
      )
        throw Error();
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Transmission outcome does not reconstruct from its exact released context and evidence.',
      });
    }
    try {
      const proof = value.input.educationalPack
        ? oilEducationProof(
            value.event,
            value.causalContext,
            value.input.isin,
            value.input.sector,
          )
        : undefined;
      if (JSON.stringify(proof) !== JSON.stringify(value.oilEducation))
        throw Error();
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Oil educational source proof does not reconstruct.',
      });
    }
    try {
      admittedTraceContext(
        value.input,
        value.event,
        value.createdAt,
        value.causalContext,
      );
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Released causal context does not match trace evidence and mapping.',
      });
    }
    if (
      !value.event.event ||
      value.event.status !== 'published' ||
      value.event.id !== value.input.eventId ||
      value.event.event.version !== value.input.eventVersion ||
      value.goal.id !== value.input.goalId ||
      value.goal.version !== value.input.goalVersion ||
      value.holding.isin !== value.input.isin ||
      value.noAction.holdingCostMinor !== value.holding.totalCostMinor ||
      value.noAction.projectedMinor !== expected.projectedMinor ||
      value.noAction.gapMinor !== expected.gapMinor ||
      (value.equity && value.equity.isin !== value.input.isin) ||
      JSON.stringify(value.input.equityBindings) !==
        JSON.stringify(impactEquityBindings(value.equity))
    )
      context.addIssue({
        code: 'custom',
        message:
          'Trace source, company, financial records and comparator must reconcile.',
      });
  });
export const ImpactTraceViewSchema = z.strictObject({
  receipt: ImpactTraceReceiptSchema,
  reviewReasons: z.array(z.string()),
});
export const ImpactTraceListSchema = z.strictObject({
  traces: z.array(ImpactTraceViewSchema).max(100),
});
export const ImpactTraceChoicesSchema = z.strictObject({
  contexts: z.array(ResearchGovernanceRevisionSchema).max(100).default([]),
  events: z.array(EventPublicSchema).max(50),
  next: z.uuid().nullable(),
  holdings: HoldingsSnapshotSchema,
  goals: z.array(SavedGoalSchema).max(100),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
export type ImpactTraceInput = z.infer<typeof ImpactTraceInputSchema>;
export type ImpactTraceReceipt = z.infer<typeof ImpactTraceReceiptSchema>;
export type ImpactTraceChoices = z.infer<typeof ImpactTraceChoicesSchema>;
export function impactWarnings(event: EventRevision, now: string): string[] {
  const age = 30 * 86400000;
  const warnings = event.sources.some(
    (source) => Date.parse(now) - Date.parse(source.publishedAt) > age,
  )
    ? [
        'Evidence is older than the 30-day review window; this is historical context.',
      ]
    : [];
  if (
    event.sources.some(
      (source) => Date.parse(source.publishedAt) > Date.parse(now),
    )
  )
    warnings.push('A source publication time is in the future.');
  if (!event.editorial.effectiveAt)
    warnings.push('The effective time is not established.');
  if (event.editorial.claimKind !== 'fact')
    warnings.push(
      `The event is labelled ${event.editorial.claimKind}, not an established outcome.`,
    );
  return warnings;
}
export function impactEquityBindings(
  equity: z.infer<typeof EquityCompanySchema> | null,
) {
  return [
    ...new Map(
      (equity?.records ?? []).map((record) => [
        record.editionId,
        { editionId: record.editionId, hash: record.hash },
      ]),
    ).values(),
  ].sort((a, b) => a.editionId.localeCompare(b.editionId));
}
export function equityTraceWarnings(
  equity: z.infer<typeof EquityCompanySchema> | null,
): string[] {
  if (!equity?.records.length)
    return [
      'No admitted exchange equity evidence is available for this company.',
    ];
  const keys = new Map<string, string>();
  const warnings: string[] = [];
  for (const record of equity.records) {
    const key = equityObservationKey(record.observation);
    const value = JSON.stringify(
      Object.fromEntries(
        Object.entries(record.observation).filter(
          ([name]) => name !== 'sourceRow',
        ),
      ),
    );
    if (keys.has(key) && keys.get(key) !== value)
      warnings.push(
        'Conflicting published equity values exist for ' +
          key +
          '. No value was selected or used for valuation.',
      );
    keys.set(key, value);
  }
  if (equity.truncated)
    warnings.push(
      'Equity evidence exceeds the 1000-record window; coverage is incomplete.',
    );
  return [...new Set(warnings)];
}
export function buildImpactTrace(
  id: string,
  raw: ImpactTraceInput,
  publicEvent: z.infer<typeof EventPublicSchema>,
  holdings: HoldingsSnapshot,
  goals: SavedGoal[],
  now: string,
  equity: z.infer<typeof EquityCompanySchema> | null = null,
  causalContext?: ResearchGovernanceRevision,
): ImpactTraceReceipt {
  const input = ImpactTraceInputSchema.parse(raw);
  const context = admittedTraceContext(input, publicEvent, now, causalContext);
  if (equity && equity.isin !== input.isin)
    throw new Error('Company evidence identity does not match your holding.');
  if (
    JSON.stringify(input.equityBindings) !==
    JSON.stringify(impactEquityBindings(equity))
  )
    throw new Error(
      'Published company evidence changed. Review the current company receipts.',
    );
  const admitted = EventPublicSchema.parse(publicEvent);
  const event = admitted.event;
  if (
    admitted.status !== 'published' ||
    !event ||
    event.id !== input.eventId ||
    event.version !== input.eventVersion
  )
    throw new Error(
      'Event changed or is unavailable. Reload and review its current evidence.',
    );
  const sector = event.editorial.links.find(
    (link) => link.kind === 'sector' && link.label === input.sector,
  );
  const company = event.editorial.links.find(
    (link) => link.kind === 'instrument' && link.isin === input.isin,
  );
  if (!sector || !company || sector.citation !== company.citation)
    throw new Error(
      'Choose sector and company context reviewed against the same source excerpt.',
    );
  const holding = holdings.holdings.find((item) => item.isin === input.isin);
  const goal = goals.find((item) => item.id === input.goalId);
  if (
    !holding ||
    holdings.version !== input.holdingsVersion ||
    !goal ||
    goal.version !== input.goalVersion
  )
    throw new Error(
      'Your holding or goal changed. Reload and review the current records.',
    );
  const identity = event.identities.find((item) => item.isin === input.isin);
  if (!identity) throw new Error('A retained company identity is required.');
  const citation = event.editorial.citations[sector.citation]!;
  const projection = goalProjection(goal);
  return ImpactTraceReceiptSchema.parse({
    id,
    createdAt: now,
    policy: 'reviewed-context-trace-v1',
    ...(context?.transmission
      ? {
          transmission: traceTransmission(
            admitted,
            causalContext,
            input,
            now,
            equity,
          ),
        }
      : {}),
    ...(input.educationalPack
      ? {
          oilEducation: oilEducationProof(
            admitted,
            causalContext,
            input.isin,
            input.sector,
          ),
        }
      : {}),
    input,
    ...(causalContext ? { causalContext } : {}),
    event: admitted,
    holding,
    goal,
    equity,
    chain: [
      {
        kind: 'evidence',
        claimKind: 'fact',
        label: 'Retained source excerpt',
        explanation: citation.quote,
      },
      {
        kind: 'factor',
        claimKind: event.editorial.claimKind,
        label: event.editorial.family,
        explanation: event.editorial.explanation,
      },
      {
        kind: 'sector',
        claimKind: 'inference',
        label: input.sector,
        explanation: context
          ? `${context.direction} over ${context.horizon}. ${causalContext!.input.rationale}`
          : sector.rationale,
      },
      {
        kind: 'company',
        claimKind: 'inference',
        label: input.isin,
        explanation: company.rationale,
      },
      {
        kind: 'holding',
        claimKind: 'user-record',
        label: `${holding.quantity} units`,
        explanation:
          'Your saved acquisition-cost record; not market value or verified ownership.',
      },
      {
        kind: 'goal',
        claimKind: 'user-record',
        label: goal.name,
        explanation:
          'You selected this goal for context. This selection does not allocate the holding to the goal.',
      },
    ],
    uncertainties: [
      ...(context
        ? [
            `Independent reviewed context: ${context.limitations}. Direction is an interpretation, not a measured sensitivity.`,
          ]
        : []),
      'Reviewed associations explain possible relevance; they do not establish causation or direction.',
      'No price response, portfolio loss, probability or goal change has been estimated.',
      'This source set is not an exhaustive conflict search; contrary evidence may exist.',
      'The comparator assumes unchanged contributions and no investment growth; taxes, inflation and sale proceeds are not modelled.',
    ],
    warnings: [
      ...impactWarnings(event, now),
      ...equityTraceWarnings(equity),
      ...(input.educationalPack
        ? [
            'Historical issuer report dated 2026-04-01; a later editorial publication does not establish current fuel prices or cost exposure.',
          ]
        : []),
    ],
    quantifiedImpact: null,
    noAction: {
      currency: 'INR',
      scale: 2,
      holdingCostMinor: holding.totalCostMinor,
      ...projection,
      assumption: 'no-growth-nominal-v1',
    },
  });
}
export function impactReviewReasons(
  receipt: ImpactTraceReceipt,
  current: z.infer<typeof EventPublicSchema> | null,
  holdings: HoldingsSnapshot,
  goals: SavedGoal[],
  now: string,
  equity: z.infer<typeof EquityCompanySchema> | null = null,
) {
  const reasons = [
    ...(receipt.input.educationalPack
      ? [
          'Oil educational context remains historical; current fuel costs, mitigations and company conditions need new evidence before any decision.',
        ]
      : []),
    ...impactWarnings(receipt.event.event!, now),
    ...equityTraceWarnings(equity),
  ];
  if (JSON.stringify(receipt.equity) !== JSON.stringify(equity))
    reasons.push(
      'Published exchange equity evidence changed; review a new trace.',
    );
  if (!current?.event || current.status !== 'published')
    reasons.push(
      'Event or evidence is withdrawn, conflicting, or unavailable.',
    );
  else if (current.event.version !== receipt.input.eventVersion)
    reasons.push('The reviewed event has a newer edition.');
  if (
    holdings.version !== receipt.input.holdingsVersion ||
    !holdings.holdings.some((item) => item.isin === receipt.input.isin)
  )
    reasons.push('Your holdings changed or were removed.');
  if (
    !goals.some(
      (item) =>
        item.id === receipt.input.goalId &&
        item.version === receipt.input.goalVersion,
    )
  )
    reasons.push('Your goal changed or was removed.');
  return [...new Set(reasons)];
}

export function admittedTraceContext(
  input: ImpactTraceInput,
  event: z.infer<typeof EventPublicSchema>,
  at: string,
  revision?: ResearchGovernanceRevision,
) {
  if (!input.causalContext) {
    if (revision) throw Error('Unexpected causal context snapshot.');
    return null;
  }
  if (!revision) throw Error('Released causal context snapshot required.');
  const value = ResearchGovernanceRevisionSchema.parse(revision),
    content = value.input.content;
  if (governanceChecks(value).some((check) => !check.passed))
    throw Error('Causal context has invalid retained mapping invariants.');
  if (
    value.id !== input.causalContext.id ||
    value.version !== input.causalContext.version ||
    content.kind !== 'causal-context' ||
    content.isin !== input.isin ||
    content.sector !== input.sector ||
    value.input.reviewBy < at.slice(0, 10) ||
    JSON.stringify(value.event.event) !== JSON.stringify(event.event)
  )
    throw Error(
      'Causal context is expired or does not match this event, sector and company.',
    );
  return content;
}

function traceTransmission(
  event: z.infer<typeof EventPublicSchema>,
  revision: ResearchGovernanceRevision | undefined,
  input: ImpactTraceInput,
  at: string,
  equity: z.infer<typeof EquityCompanySchema> | null,
) {
  const content = revision?.input.content;
  if (!revision || content?.kind !== 'causal-context' || !content.transmission)
    return undefined;
  if (!event.event) throw Error('Reviewed event required.');
  return transmissionOutcome(content.transmission, {
    reviewId: revision.id,
    reviewVersion: revision.version,
    eventId: event.id,
    eventVersion: event.event.version,
    sector: input.sector,
    isin: input.isin,
    eventFamily: event.event.editorial.family,
    direction: content.direction,
    stale: event.event.sources.some(
      (source) =>
        Date.parse(at) - Date.parse(source.publishedAt) > 30 * 86400000,
    ),
    warnings: [
      ...impactWarnings(event.event, at),
      ...equityTraceWarnings(equity),
    ],
  });
}
