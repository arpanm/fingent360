import test from 'node:test';
import assert from 'node:assert/strict';
import {
  researchSelection,
  enrichResearchItem,
  researchGlossaryItems,
  buildResearchContext,
  learningContentItems,
  learningReferences,
} from '@fingent360/contracts';
const item = (id, extra = {}) => ({
  id,
  version: 1,
  kind: 'news',
  title: 'Synthetic inflation policy fixture',
  summary: 'Synthetic consumer prices release.',
  body: 'Exact synthetic source wording: 2.75%.',
  topics: ['Inflation'],
  publishedAt: '2026-09-12T00:00:00.000Z',
  effectiveLabel: 'Synthetic acceptance fixture',
  source: {
    name: 'Federal Reserve Board',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/example.htm',
    retrievedAt: '2026-09-13T00:00:00.000Z',
    rights: 'Synthetic fixture only',
  },
  sourceHash: null,
  importance: 1,
  relatedIds: [],
  status: 'published',
  correctionNote: null,
  reviewedAt: '2026-09-13T00:00:00.000Z',
  ...extra,
});
test('research filters retain only matching published source, region, topic, kind and text', () => {
  const india = item('pib-fixture', {
      topics: ['India', 'Trade'],
      title: 'Synthetic freight fixture',
    }),
    global = item('fed-fixture'),
    draft = item('pib-draft', { ...india, id: 'pib-draft', status: 'draft' });
  assert.deepEqual(
    researchSelection([india, global, draft], {
      source: 'pib',
      region: 'india',
      topic: 'Trade',
      kind: 'news',
      q: 'freight',
      view: 'explore',
    }).map((v) => v.id),
    [india.id],
  );
  assert.equal(
    researchSelection([india, global], { source: 'missing' }).length,
    0,
  );
});
test('Today has bounded provider variety and one annual period per series while Explore retains history', () => {
  const records = [
    ...Array.from({ length: 15 }, (_, i) => item(`fed-fixture-${i}`)),
    item('ecb-press-fixture'),
    ...[2025, 2024, 2023].map((year) =>
      item(`annual-gdp-${year}`, {
        kind: 'annual',
        title: `India GDP: ${year}`,
        topics: ['India', 'Annual data'],
        publishedAt: `${year}-12-31T00:00:00.000Z`,
        source: { ...item('x').source, name: 'World Bank' },
      }),
    ),
  ];
  const today = researchSelection(records, { view: 'today' });
  assert.ok(today.length <= 24);
  assert.ok(today.some((v) => v.id === 'ecb-press-fixture'));
  assert.equal(today.filter((v) => v.kind === 'annual').length, 1);
  assert.equal(today.find((v) => v.kind === 'annual').id, 'annual-gdp-2025');
  assert.equal(
    researchSelection(records, { view: 'explore' }).length,
    records.length,
  );
});
test('deterministic enrichment adds context without rewriting facts, dates or provenance', () => {
  const original = item('fed-fixture');
  const enriched = enrichResearchItem(original);
  assert.deepEqual(enrichResearchItem(original), enriched);
  for (const key of [
    'title',
    'summary',
    'body',
    'source',
    'sourceHash',
    'publishedAt',
    'effectiveLabel',
    'version',
  ])
    assert.deepEqual(enriched[key], original[key]);
  assert.ok(enriched.relatedIds.includes('term-inflation'));
  assert.ok(enriched.topics.includes('Global economy'));
  assert.ok(!enriched.relatedIds.includes(enriched.id));
});
test('context excludes drafts/withdrawals, links published terms and valid authored learning IDs', () => {
  const base = enrichResearchItem(item('fed-fixture'));
  const terms = researchGlossaryItems('2026-09-13T00:00:00.000Z').map((v) => ({
    ...v,
    status: 'published',
  }));
  const context = buildResearchContext(base, [
    ...terms,
    item('pib-published'),
    item('fed-draft', { status: 'draft' }),
    item('fed-withdrawn', { status: 'withdrawn' }),
    base,
  ]);
  assert.ok(
    context.related.every((v) => v.status === 'published' && v.id !== base.id),
  );
  assert.ok(context.terms.every((v) => v.status === 'published'));
  assert.ok(
    !context.related.some(
      (v) => v.id === 'fed-draft' || v.id === 'fed-withdrawn',
    ),
  );
  for (const lesson of context.learning) {
    assert.ok(learningContentItems.some((v) => v.id === lesson.id));
    assert.ok(learningReferences[lesson.id]);
    assert.equal(lesson.href, `#learning?question=${lesson.id}`);
  }
  assert.match(context.caveat, /do not establish causation/);
});
