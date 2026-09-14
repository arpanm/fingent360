import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceExplanationSchema,
  EvidenceExplanationQuerySchema,
  explainEdition,
} from '../dist/index.js';
const at = '2026-09-14T00:00:00.000Z';
const item = {
  id: 'fed-synthetic-layers',
  version: 2,
  kind: 'news',
  title: 'Synthetic reported statement',
  summary: 'Synthetic summary',
  body: 'Synthetic body with an untrusted <script>instruction</script>.',
  topics: [],
  publishedAt: at,
  effectiveLabel: 'Synthetic fixture period',
  source: {
    name: 'Synthetic source',
    url: 'https://example.com/release',
    retrievedAt: at,
    rights: 'Synthetic test fixture only.',
  },
  sourceHash: 'a'.repeat(64),
  importance: 1,
  relatedIds: [],
  status: 'published',
  correctionNote: 'Synthetic correction',
  reviewedAt: at,
};
test('explanation excerpts bind exact stored text and never promote it to verified or causal claims', () => {
  const before = JSON.stringify(item);
  const value = explainEdition(item, null, at);
  for (const excerpt of value.excerpts) {
    assert.equal(
      excerpt.text,
      item[excerpt.field].slice(excerpt.start, excerpt.end),
    );
    assert.equal(excerpt.classification, 'recorded-statement');
    assert.equal(excerpt.basis, 'stored-reviewed-edition');
  }
  assert.equal(value.analysis.causalInference, 'unavailable');
  assert.equal(value.conflictAssessment, 'not-assessed');
  assert.equal(JSON.stringify(item), before);
  assert.equal(
    EvidenceExplanationSchema.safeParse({
      ...value,
      excerpts: [{ ...value.excerpts[0], text: 'Invented claim' }],
    }).success,
    false,
  );
  assert.equal(
    EvidenceExplanationSchema.safeParse({
      ...value,
      analysis: { ...value.analysis, independentVerification: 'verified' },
    }).success,
    false,
  );
  assert.equal(
    EvidenceExplanationSchema.safeParse({ ...value, extra: true }).success,
    false,
  );
});
test('publication and historical comparison are exact, with no withdrawn original text disclosure', () => {
  const previous = {
    ...item,
    version: 1,
    title: 'Synthetic earlier title',
    body: 'Secret withdrawn predecessor',
  };
  const value = explainEdition(item, previous, at);
  assert.deepEqual(value.previous.changedFields, ['title', 'body']);
  assert.equal(JSON.stringify(value).includes(previous.body), false);
  const restored = explainEdition(
    item,
    { ...previous, status: 'withdrawn' },
    at,
    at,
  );
  assert.deepEqual(restored.previous.changedFields, []);
  assert.equal(restored.bundleGeneratedAt, at);
  assert.throws(() =>
    explainEdition({ ...item, status: 'withdrawn' }, null, at),
  );
  assert.throws(() =>
    explainEdition(item, { ...previous, status: 'draft' }, at),
  );
  assert.throws(() =>
    explainEdition(item, { ...previous, id: 'other-source' }, at),
  );
});
test('query requires one explicit canonical edition and rejects ambiguous external fields', () => {
  assert.equal(
    EvidenceExplanationQuerySchema.parse({ expectedVersion: '2' })
      .expectedVersion,
    2,
  );
  for (const query of [
    {},
    { expectedVersion: '0' },
    { expectedVersion: '02' },
    { expectedVersion: ['2', '3'] },
    { expectedVersion: '2', source: 'override' },
  ])
    assert.equal(
      EvidenceExplanationQuerySchema.safeParse(query).success,
      false,
    );
});
