import { z } from 'zod';
import { FeedItemSchema, type FeedItem } from './discovery.js';
export const SourceReviewQuerySchema = z.strictObject({
  expectedVersion: z.string().regex(/^[1-9][0-9]{0,8}$/),
});
export const sourceReviewFields = [
  'title',
  'summary',
  'body',
  'topics',
  'importance',
  'relatedIds',
  'kind',
  'publishedAt',
  'retrievedAt',
  'effectiveLabel',
  'source',
  'sourceHash',
  'status',
  'correctionNote',
  'reviewedAt',
] as const;
export const SourceReviewDifferenceSchema = z.strictObject({
  field: z.enum(sourceReviewFields),
  before: z.string().nullable(),
  after: z.string(),
  changed: z.boolean(),
});
export const SourceReviewComparisonSchema = z
  .strictObject({
    head: FeedItemSchema,
    previous: FeedItemSchema.nullable(),
    checkedAt: z.iso.datetime(),
    differences: z
      .array(SourceReviewDifferenceSchema)
      .length(sourceReviewFields.length),
  })
  .superRefine((v, c) => {
    if (
      v.previous &&
      (v.previous.id !== v.head.id ||
        v.previous.version >= v.head.version ||
        v.previous.status === 'draft')
    )
      c.addIssue({ code: 'custom', message: 'Invalid predecessor.' });
    const expected = sourceReviewDifferences(v.head, v.previous);
    if (JSON.stringify(expected) !== JSON.stringify(v.differences))
      c.addIssue({
        code: 'custom',
        message: 'Differences do not match retained originals.',
      });
  });
export function sourceReviewDifferences(
  head: FeedItem,
  previous: FeedItem | null,
) {
  return sourceReviewFields.map((field) => {
    const render = (item: FeedItem) =>
      JSON.stringify(
        field === 'retrievedAt' ? item.source.retrievedAt : item[field],
      );
    const before = previous ? render(previous) : null,
      after = render(head);
    return { field, before, after, changed: before !== after };
  });
}
export type SourceReviewComparison = z.infer<
  typeof SourceReviewComparisonSchema
>;
