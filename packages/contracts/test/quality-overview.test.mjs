import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeQuality } from '../dist/quality-overview.js';
const at = '2026-01-15T00:00:00.000Z';
const item = {
  id: 'synthetic-news',
  version: 1,
  kind: 'news',
  title: 'Synthetic fixture',
  summary: '',
  body: '',
  topics: [],
  publishedAt: '2026-01-01T00:00:00.000Z',
  effectiveLabel: 'Synthetic',
  source: {
    name: 'Synthetic',
    url: 'https://example.com/fixture',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    rights: 'Test only',
  },
  sourceHash: null,
  importance: 1,
  relatedIds: [],
  status: 'published',
  correctionNote: null,
  reviewedAt: null,
};
const head = (data) => ({ id: data.id, version: data.version, data });
test('quality triage excludes annual and editorial age and distinguishes future retrieval', () => {
  const value = summarizeQuality(
    [
      head(item),
      head({ ...item, id: 'annual', kind: 'annual' }),
      head({ ...item, id: 'term', kind: 'term' }),
      head({
        ...item,
        id: 'future',
        source: { ...item.source, retrievedAt: '2026-01-16T00:00:00.000Z' },
      }),
      head({ ...item, id: 'draft', status: 'draft' }),
    ],
    at,
    [],
  );
  assert.equal(value.oldNewsRetrieval, 1);
  assert.equal(value.futureRetrieval, 1);
  assert.equal(value.missingEvidence, 3);
  assert.equal(value.unreviewedPublication, 4);
  assert.equal(value.drafts, 1);
});
test('quality mismatch never masquerades as valid and truncation is explicit', () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: `id-${i}`,
    version: 1,
    data: null,
  }));
  rows[0] = { id: 'wrong-id', version: 1, data: item };
  const value = summarizeQuality(rows, at, []);
  assert.equal(value.inspected, 1000);
  assert.equal(value.moreAvailable, true);
  assert.equal(value.invalid, 1);
  assert.equal(value.missingHead, 999);
});
