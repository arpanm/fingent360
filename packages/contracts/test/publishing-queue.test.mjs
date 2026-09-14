import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PublishingQuerySchema,
  PublishingPageSchema,
  comparePublishingPosition,
} from '../dist/index.js';
const item = {
  id: 'fed-synthetic-queue',
  version: 1,
  kind: 'news',
  title: 'Synthetic title',
  summary: 'Synthetic summary',
  body: 'Synthetic fixture, not live data.',
  topics: [],
  publishedAt: '2026-01-01T00:00:00.000Z',
  effectiveLabel: 'Synthetic date',
  source: {
    name: 'Synthetic source',
    url: 'https://example.invalid/source',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    rights: 'Synthetic test fixture only',
  },
  sourceHash: null,
  importance: 1,
  relatedIds: [],
  status: 'draft',
  correctionNote: null,
  reviewedAt: null,
};
const first = { item, changedAt: '2026-01-02T00:00:00.000002Z' };
const second = {
  item: { ...item, id: 'fed-synthetic-earlier' },
  changedAt: '2026-01-02T00:00:00.000001Z',
};
const page = {
  items: [first, second],
  filters: { source: 'fed', status: 'draft' },
  pageSize: 20,
  upper: { id: item.id, changedAt: first.changedAt },
  openedAt: '2026-01-02T00:00:00.000Z',
  evaluatedAt: '2026-01-02T00:00:00.000Z',
  nextCursor: null,
  latestRun: null,
};
test('publishing input accepts bounded literal text and rejects repeated unknown or unbounded controls', () => {
  assert.deepEqual(
    PublishingQuerySchema.parse({
      source: 'bea',
      status: 'withdrawn',
      q: '  %_  ',
    }),
    { source: 'bea', status: 'withdrawn', q: '%_' },
  );
  for (const input of [
    { source: 'unknown' },
    { status: ['draft', 'published'] },
    { source: ['fed'] },
    { q: 'x'.repeat(121) },
    { q: ' ' },
    { q: 'a\u0000b' },
    { q: 'a\nb' },
    { limit: '100' },
    { offset: '20' },
    { unknown: true },
    { cursor: 'bad' },
  ])
    assert.equal(PublishingQuerySchema.safeParse(input).success, false);
});
test('publishing pages enforce exact microseconds order source status uniqueness and bounded rows', () => {
  assert.equal(PublishingPageSchema.safeParse(page).success, true);
  assert.equal(
    comparePublishingPosition(page.upper, {
      id: second.item.id,
      changedAt: second.changedAt,
    }),
    1,
  );
  for (const changed of [
    { ...page, items: [second, first] },
    { ...page, items: [first, first] },
    { ...page, items: [{ ...first, changedAt: '2026-01-02T00:00:00.000Z' }] },
    { ...page, filters: { source: 'glossary' } },
    { ...page, filters: { status: 'published' } },
    { ...page, upper: { id: second.item.id, changedAt: second.changedAt } },
    { ...page, items: Array.from({ length: 21 }, () => first) },
  ])
    assert.equal(PublishingPageSchema.safeParse(changed).success, false);
});
test('publishing continuation cannot claim another page from incomplete results or invent totals', () => {
  for (const changed of [
    { ...page, total: 999 },
    { ...page, pageSize: 50 },
    { ...page, upper: null },
    { ...page, nextCursor: 'a'.repeat(50) + '.' + 'b'.repeat(43) },
  ])
    assert.equal(PublishingPageSchema.safeParse(changed).success, false);
});
