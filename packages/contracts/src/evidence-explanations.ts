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
    conflictAssessment: z.literal('not-assessed'),
    analysis: z.strictObject({
      independentVerification: z.literal('unavailable'),
      expectations: z.literal('unavailable'),
      scenarios: z.literal('unavailable'),
      causalInference: z.literal('unavailable'),
      quantifiedPortfolioImpact: z.literal('unavailable'),
    }),
    evaluatedAt: z.iso.datetime(),
    bundleGeneratedAt: z.iso.datetime().nullable(),
  })
  .superRefine((value, context) => {
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
    conflictAssessment: 'not-assessed',
    analysis: {
      independentVerification: 'unavailable',
      expectations: 'unavailable',
      scenarios: 'unavailable',
      causalInference: 'unavailable',
      quantifiedPortfolioImpact: 'unavailable',
    },
    evaluatedAt,
    bundleGeneratedAt,
  });
}
