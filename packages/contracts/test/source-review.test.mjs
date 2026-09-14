import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SourceReviewComparisonSchema,
  sourceReviewDifferences,
} from '../dist/index.js';
const head = {
  id: 'synthetic-review',
  version: 2,
  kind: 'news',
  title: '<script>literal</script>',
  summary: 'Synthetic',
  body: 'Synthetic retained text',
  topics: ['Inflation'],
  publishedAt: '2026-09-13T00:00:00.000Z',
  effectiveLabel: 'Synthetic',
  source: {
    name: 'Synthetic',
    url: 'https://example.com/source',
    retrievedAt: '2026-09-13T00:00:00.000Z',
    rights: 'Synthetic only',
  },
  sourceHash: null,
  importance: 1,
  relatedIds: [],
  status: 'draft',
  correctionNote: null,
  reviewedAt: null,
};
test('source comparison reconstructs exact originals and rejects fabricated differences', () => {
  const previous = {
    ...head,
    version: 1,
    status: 'withdrawn',
    title: 'Earlier',
  };
  const value = {
    head,
    previous,
    checkedAt: head.publishedAt,
    differences: sourceReviewDifferences(head, previous),
  };
  assert.equal(
    SourceReviewComparisonSchema.parse(value).previous.status,
    'withdrawn',
  );
  assert.equal(
    value.differences.find((d) => d.field === 'body').changed,
    false,
  );
  assert.equal(
    SourceReviewComparisonSchema.safeParse({
      ...value,
      differences: value.differences.map((d) => ({ ...d, changed: true })),
    }).success,
    false,
  );
  assert.equal(
    SourceReviewComparisonSchema.safeParse({
      ...value,
      previous: { ...previous, id: 'other' },
    }).success,
    false,
  );
  assert.equal(
    sourceReviewDifferences(head, null).every((d) => d.before === null),
    true,
  );
});
