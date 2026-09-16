import {
  ResearchGovernanceRevisionSchema,
  type ResearchGovernanceRevision,
} from './research-governance.js';
import { EventScenarioPublicSchema } from './event-scenarios.js';
import { z } from 'zod';
import { FeedItemSchema, type FeedItem } from './discovery.js';

export const EvidenceExplanationQuerySchema = z.strictObject({
  expectedVersion: z
    .string()
    .regex(/^[1-9][0-9]{0,8}$/)
    .transform(Number),
});
const Field = z.enum(['title', 'summary', 'body']);
const ChangedField = z.enum([
  'title',
  'summary',
  'body',
  'effectiveLabel',
  'sourceHash',
]);
export const EvidenceExcerptSchema = z.strictObject({
  field: Field,
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  offsetUnit: z.literal('utf16-code-units'),
  text: z.string().min(1).max(10000),
  basis: z.literal('stored-reviewed-edition'),
  classification: z.literal('recorded-statement'),
});
export const EvidenceExplanationSchema = z
  .strictObject({
    method: z.literal('stored-edition-layers-v1'),
    edition: FeedItemSchema.refine((v) => v.status === 'published'),
    excerpts: z.array(EvidenceExcerptSchema).min(1).max(3),
    previous: z
      .strictObject({
        version: z.number().int().positive(),
        status: z.enum(['published', 'withdrawn']),
        publishedAt: z.iso.datetime(),
        reviewedAt: z.iso.datetime().nullable(),
        changedFields: z.array(ChangedField).max(5),
      })
      .nullable(),
    conflictAssessment: z.enum([
      'not-assessed',
      'opposing-reviewed-directions',
    ]),
    analysis: z.strictObject({
      independentVerification: z.literal('unavailable'),
      expectations: z.enum(['unavailable', 'reviewed']),
      scenarios: z.enum(['unavailable', 'reviewed']),
      causalInference: z.enum(['unavailable', 'reviewed-qualitative']),
      quantifiedPortfolioImpact: z.literal('unavailable'),
    }),
    reviewedContexts: z
      .array(ResearchGovernanceRevisionSchema)
      .max(20)
      .default([]),
    reviewedScenarios: z.array(EventScenarioPublicSchema).max(20).default([]),
    evaluatedAt: z.iso.datetime(),
    bundleGeneratedAt: z.iso.datetime().nullable(),
  })
  .superRefine((value, context) => {
    for (const revision of value.reviewedContexts) {
      if (
        !contextBindsEdition(revision, value.edition) ||
        revision.input.reviewBy < value.evaluatedAt.slice(0, 10)
      )
        context.addIssue({
          code: 'custom',
          message:
            'Released context must bind selected citations to this current source edition and review window.',
        });
    }
    if (
      new Set(value.reviewedContexts.map((v) => v.id)).size !==
        value.reviewedContexts.length ||
      value.analysis.causalInference !==
        (value.reviewedContexts.length
          ? 'reviewed-qualitative'
          : 'unavailable') ||
      value.conflictAssessment !==
        (opposingContextDirections(value.reviewedContexts)
          ? 'opposing-reviewed-directions'
          : 'not-assessed')
    )
      context.addIssue({
        code: 'custom',
        message:
          'Context availability/conflict must match the admitted qualitative releases.',
      });
    const seenScenario = new Set<string>();
    for (const scenario of value.reviewedScenarios) {
      const event = scenario.receipt?.event.event;
      if (
        scenario.state !== 'published' ||
        !scenario.reviewedAt ||
        !event ||
        seenScenario.has(scenario.id) ||
        !event.editorial.citations.some(
          (c) =>
            c.sourceId === value.edition.id &&
            c.version === value.edition.version &&
            c.hash === value.edition.sourceHash,
        ) ||
        !event.sources.some(
          (source) => JSON.stringify(source) === JSON.stringify(value.edition),
        )
      )
        context.addIssue({
          code: 'custom',
          message:
            'Analytical receipt must bind the exact reviewed source edition.',
        });
      seenScenario.add(scenario.id);
    }
    const expected = value.reviewedScenarios.some((s) => {
      const model = s.receipt?.input.model;
      return (
        model &&
        'reference' in model &&
        model.reference?.kind === 'published-expectation'
      );
    });
    if (
      value.analysis.scenarios !==
        (value.reviewedScenarios.length ? 'reviewed' : 'unavailable') ||
      value.analysis.expectations !== (expected ? 'reviewed' : 'unavailable')
    )
      context.addIssue({
        code: 'custom',
        message: 'Analysis availability must reflect actual reviewed receipts.',
      });
    const seen = new Set<string>();
    for (const [index, excerpt] of value.excerpts.entries()) {
      if (
        seen.has(excerpt.field) ||
        excerpt.start !== 0 ||
        excerpt.end !== value.edition[excerpt.field].length ||
        excerpt.text !==
          value.edition[excerpt.field].slice(excerpt.start, excerpt.end)
      )
        context.addIssue({
          code: 'custom',
          path: ['excerpts', index],
          message:
            'An excerpt must exactly identify its complete stored edition field.',
        });
      seen.add(excerpt.field);
    }
    if (
      !seen.has('title') ||
      (value.previous && value.previous.version >= value.edition.version)
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid explanation edition binding.',
      });
    if (
      (['title', 'summary', 'body'] as const).some(
        (field) => Boolean(value.edition[field]) !== seen.has(field),
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Every nonempty stored field must retain its evidence reference.',
      });
    if (
      value.previous?.status === 'withdrawn' &&
      value.previous.changedFields.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Withdrawn text is not compared publicly.',
      });
  });
export type EvidenceExplanation = z.infer<typeof EvidenceExplanationSchema>;

export function explainEdition(
  current: FeedItem,
  previous: FeedItem | null,
  evaluatedAt: string,
  bundleGeneratedAt: string | null = null,
  reviewedScenarios: z.infer<typeof EventScenarioPublicSchema>[] = [],
  reviewedContexts: ResearchGovernanceRevision[] = [],
): EvidenceExplanation {
  const edition = FeedItemSchema.parse(current);
  if (edition.status !== 'published')
    throw new Error('Published explanation unavailable.');
  if (
    previous &&
    (previous.id !== edition.id ||
      previous.version >= edition.version ||
      previous.status === 'draft')
  )
    throw new Error('Invalid preceding publication.');
  return EvidenceExplanationSchema.parse({
    method: 'stored-edition-layers-v1',
    edition,
    excerpts: (['title', 'summary', 'body'] as const).flatMap((field) =>
      edition[field]
        ? [
            {
              field,
              start: 0,
              end: edition[field].length,
              offsetUnit: 'utf16-code-units',
              text: edition[field],
              basis: 'stored-reviewed-edition',
              classification: 'recorded-statement',
            },
          ]
        : [],
    ),
    previous: previous
      ? {
          version: previous.version,
          status: previous.status,
          publishedAt: previous.publishedAt,
          reviewedAt: previous.reviewedAt,
          changedFields:
            previous.status === 'published'
              ? (
                  [
                    'title',
                    'summary',
                    'body',
                    'effectiveLabel',
                    'sourceHash',
                  ] as const
                ).filter((field) => previous[field] !== edition[field])
              : [],
        }
      : null,
    conflictAssessment: opposingContextDirections(reviewedContexts)
      ? 'opposing-reviewed-directions'
      : 'not-assessed',
    analysis: {
      independentVerification: 'unavailable',
      expectations: reviewedScenarios.some((s) => {
        const model = s.receipt?.input.model;
        return (
          model &&
          'reference' in model &&
          model.reference?.kind === 'published-expectation'
        );
      })
        ? 'reviewed'
        : 'unavailable',
      scenarios: reviewedScenarios.length ? 'reviewed' : 'unavailable',
      causalInference: reviewedContexts.length
        ? 'reviewed-qualitative'
        : 'unavailable',
      quantifiedPortfolioImpact: 'unavailable',
    },
    reviewedScenarios,
    reviewedContexts,
    evaluatedAt,
    bundleGeneratedAt,
  });
}

export function contextBindsEdition(
  revision: ResearchGovernanceRevision,
  edition: FeedItem,
) {
  const event = revision.event.event;
  return (
    revision.input.content.kind === 'causal-context' &&
    !!event &&
    event.sources.some(
      (source) => JSON.stringify(source) === JSON.stringify(edition),
    ) &&
    revision.input.citations.some((index) => {
      const citation = event.editorial.citations[index];
      return (
        citation?.sourceId === edition.id &&
        citation.version === edition.version &&
        citation.hash === edition.sourceHash
      );
    })
  );
}
export function opposingContextDirections(
  revisions: ResearchGovernanceRevision[],
) {
  const groups = new Map<string, Set<string>>();
  for (const revision of revisions) {
    const content = revision.input.content;
    if (content.kind !== 'causal-context') continue;
    const key = JSON.stringify([content.sector, content.isin, content.horizon]),
      directions = groups.get(key) ?? new Set<string>();
    directions.add(content.direction);
    groups.set(key, directions);
  }
  return [...groups.values()].some(
    (directions) => directions.has('positive') && directions.has('negative'),
  );
}
