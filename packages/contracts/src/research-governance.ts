import { TransmissionBindingSchema } from './transmission-context.js';
import { z } from 'zod';
import { EventPublicSchema } from './events.js';
export const ResearchPolicyBindingSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const EducationalPolicyRulesSchema = z.strictObject({
  maximumConcentrationBps: z.number().int().min(0).max(10000),
  turnoverBudgetBps: z.number().int().min(0).max(10000),
  minimumCooldownDays: z.number().int().min(0).max(3650),
  minimumDownsideStressBps: z.number().int().min(0).max(10000),
});
export const ResearchGovernanceDraftSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  title: z.string().trim().min(5).max(160),
  reviewBy: z.iso.date(),
  rationale: z.string().trim().min(20).max(2000),
  citations: z.array(z.number().int().min(0).max(4)).min(1).max(5),
  content: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('causal-context'),
      transmission: TransmissionBindingSchema.optional(),
      sector: z.string().trim().min(1).max(100),
      isin: z
        .string()
        .regex(/^IN[A-Z0-9]{9}[0-9]$/)
        .nullable(),
      direction: z.enum(['positive', 'negative', 'mixed', 'unknown']),
      horizon: z.string().trim().min(3).max(120),
      limitations: z.string().trim().min(20).max(2000),
      quantifiedImpact: z.null(),
    }),
    z.strictObject({
      kind: z.literal('educational-policy'),
      rules: EducationalPolicyRulesSchema,
      adviceEnabled: z.literal(false),
      tradeExecution: z.literal(false),
    }),
  ]),
});
export const ResearchGovernanceRevisionSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    recordedAt: z.iso.datetime(),
    input: ResearchGovernanceDraftSchema,
    event: EventPublicSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.version !== value.input.expectedVersion + 1 ||
      value.event.id !== value.input.eventId ||
      value.event.event?.version !== value.input.eventVersion ||
      value.event.status !== 'published' ||
      new Set(value.input.citations).size !== value.input.citations.length
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Governance revision must bind its exact published event and distinct citations.',
      });
  });
export const ResearchSimulationSchema = z.strictObject({
  id: z.uuid(),
  releaseId: z.uuid(),
  version: z.number().int().positive(),
  recordedAt: z.iso.datetime(),
  basis: z.literal('deterministic-governance-invariants-v1'),
  passed: z.boolean(),
  checks: z
    .array(
      z.strictObject({
        id: z.string(),
        passed: z.boolean(),
        detail: z.string(),
      }),
    )
    .min(1)
    .max(20),
});
export const ResearchReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['release', 'withdraw']),
  simulationId: z.uuid().nullable(),
  reason: z.string().trim().min(10).max(2000),
});
export const ResearchGovernanceViewSchema = z.strictObject({
  revision: ResearchGovernanceRevisionSchema,
  state: z.enum(['draft', 'released', 'withdrawn', 'unavailable']),
  publishedVersion: z.number().int().positive().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  simulation: ResearchSimulationSchema.nullable(),
  reviewReasons: z.array(z.string()),
});
export const ResearchGovernanceListSchema = z.strictObject({
  items: z.array(ResearchGovernanceViewSchema).max(50),
  next: z.uuid().nullable(),
});
export const ResearchGovernanceHistorySchema = z.strictObject({
  versions: z.array(ResearchGovernanceRevisionSchema).max(100),
  reviews: z
    .array(
      z.strictObject({
        version: z.number().int().positive(),
        decision: z.enum(['release', 'withdraw']),
        reason: z.string(),
        reviewedAt: z.iso.datetime(),
      }),
    )
    .max(100),
});
export type ResearchGovernanceRevision = z.infer<
  typeof ResearchGovernanceRevisionSchema
>;
export type EducationalPolicyRules = z.infer<
  typeof EducationalPolicyRulesSchema
>;
/** Only policy bounds are evaluated; never a buy/sell recommendation or executable action. */
export function evaluateReleasedPolicy(
  rules: EducationalPolicyRules,
  observation: {
    concentrationBps: number;
    turnoverBps: number;
    cooldownDays: number;
    downsideStressBps: number;
  },
) {
  EducationalPolicyRulesSchema.parse(rules);
  return {
    concentration:
      observation.concentrationBps <= rules.maximumConcentrationBps,
    turnover: observation.turnoverBps <= rules.turnoverBudgetBps,
    cooldown: observation.cooldownDays >= rules.minimumCooldownDays,
    downside: observation.downsideStressBps >= rules.minimumDownsideStressBps,
  };
}
export function governanceChecks(revision: ResearchGovernanceRevision) {
  const input = revision.input,
    event = revision.event.event;
  const citationValid =
    !!event &&
    input.citations.every((index) => !!event.editorial.citations[index]);
  const checks = [
    {
      id: 'review-window',
      passed: input.reviewBy >= revision.recordedAt.slice(0, 10),
      detail: 'The explicit review-by date has not elapsed at preparation.',
    },
    {
      id: 'retained-citations',
      passed: citationValid,
      detail:
        'Each selected citation exists in the exact admitted reviewed event.',
    },
  ];
  if (input.content.kind === 'causal-context') {
    const content = input.content;
    if (content.transmission)
      checks.push({
        id: 'transmission-family',
        passed: content.transmission.family === event?.editorial.family,
        detail:
          'The exact retained mechanism version matches the reviewed event family; it supplies no automatic issuer mapping or numerical effect.',
      });
    checks.push({
      id: 'sector-mapping',
      passed: !!event?.editorial.links.some(
        (link) =>
          link.kind === 'sector' &&
          link.label === content.sector &&
          input.citations.includes(link.citation),
      ),
      detail: 'Sector matches a reviewed source-bound event link.',
    });
    checks.push({
      id: 'company-mapping',
      passed:
        content.isin === null ||
        !!event?.editorial.links.some(
          (link) =>
            link.kind === 'instrument' &&
            link.isin === content.isin &&
            input.citations.includes(link.citation),
        ),
      detail: 'Optional company matches a reviewed source-bound identity link.',
    });
    checks.push({
      id: 'no-quantified-claim',
      passed: content.quantifiedImpact === null,
      detail: 'The relationship remains explicit qualitative inference.',
    });
  } else {
    const rules = input.content.rules,
      at = {
        concentrationBps: rules.maximumConcentrationBps,
        turnoverBps: rules.turnoverBudgetBps,
        cooldownDays: rules.minimumCooldownDays,
        downsideStressBps: rules.minimumDownsideStressBps,
      };
    const valid = evaluateReleasedPolicy(rules, at);
    checks.push({
      id: 'inclusive-boundaries',
      passed: Object.values(valid).every(Boolean),
      detail: 'Exact explicit bounds are admitted.',
    });
    checks.push({
      id: 'concentration-breach',
      passed: !evaluateReleasedPolicy(rules, {
        ...at,
        concentrationBps: at.concentrationBps + 1,
      }).concentration,
      detail: 'One basis point beyond the concentration cap is rejected.',
    });
    checks.push({
      id: 'turnover-breach',
      passed: !evaluateReleasedPolicy(rules, {
        ...at,
        turnoverBps: at.turnoverBps + 1,
      }).turnover,
      detail: 'One basis point beyond the turnover cap is rejected.',
    });
    checks.push({
      id: 'cooldown-breach',
      passed: !evaluateReleasedPolicy(rules, {
        ...at,
        cooldownDays: at.cooldownDays - 1,
      }).cooldown,
      detail: 'One day below the cooldown minimum is rejected.',
    });
    checks.push({
      id: 'downside-breach',
      passed: !evaluateReleasedPolicy(rules, {
        ...at,
        downsideStressBps: at.downsideStressBps - 1,
      }).downside,
      detail: 'One basis point below the downside-test minimum is rejected.',
    });
  }
  return checks;
}
export const ResearchGovernanceSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  policies: z.array(ResearchGovernanceRevisionSchema).max(100),
  contexts: z.array(ResearchGovernanceRevisionSchema).max(100).default([]),
});
