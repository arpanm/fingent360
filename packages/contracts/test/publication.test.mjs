import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FeedItemSchema,
  LibrarySchema,
  currentPublications,
  publicEdition,
  editionEvidence,
  publicLibrary,
} from '../dist/index.js';
const original = () =>
  FeedItemSchema.parse({
    id: 'fed-synthetic-withdrawal',
    version: 2,
    kind: 'news',
    title: 'Synthetic retained headline',
    summary: 'Synthetic retained summary',
    body: 'Synthetic retained body',
    topics: ['Inflation'],
    publishedAt: '2026-09-13T00:00:00.000Z',
    effectiveLabel: 'Synthetic dated source',
    source: {
      name: 'Federal Reserve Board',
      url: 'https://www.federalreserve.gov/newsevents/pressreleases/synthetic.htm',
      retrievedAt: '2026-09-13T01:00:00.000Z',
      rights: 'Synthetic fixture only',
    },
    sourceHash: 'a'.repeat(64),
    importance: 1,
    relatedIds: [],
    status: 'published',
    correctionNote: 'Synthetic copied text',
    reviewedAt: '2026-09-13T02:00:00.000Z',
  });
test('publication admission resolves later history, ignores a later draft and keeps originals unchanged', () => {
  const first = original(),
    withdrawn = { ...first, version: 3, status: 'withdrawn' },
    draft = { ...first, version: 4, status: 'draft' },
    before = JSON.stringify([first, withdrawn, draft]);
  assert.equal(
    currentPublications([first], { [first.id]: [draft, withdrawn, first] })[0]
      .status,
    'withdrawn',
  );
  const hidden = publicEdition(first, true);
  assert.equal(hidden.body, '');
  assert.equal(hidden.summary, '');
  assert.equal(hidden.sourceHash, first.sourceHash);
  assert.equal(hidden.version, 2);
  assert.equal(
    hidden.correctionNote,
    'This source edition is unavailable for public reading.',
  );
  assert.equal(JSON.stringify([first, withdrawn, draft]), before);
  assert.equal(publicEdition(first), first);
  assert.equal(publicEdition(withdrawn).body, '');
});
test('published evidence never returns another release from a shared original body', () => {
  const item = original(),
    raw = {
      hash: item.sourceHash,
      url: item.source.url,
      retrievedAt: item.source.retrievedAt,
      body: 'Synthetic withdrawn sibling secret',
    };
  const projected = editionEvidence(item, raw);
  assert.equal(projected.hash, raw.hash);
  assert.equal(projected.scope, 'published-edition');
  assert.equal(JSON.parse(projected.body).version, item.version);
  assert.ok(!projected.body.includes(raw.body));
  assert.throws(() => editionEvidence({ ...item, status: 'withdrawn' }, raw));
  assert.throws(() => editionEvidence(item, { ...raw, hash: 'b'.repeat(64) }));
});
test('saved disclosure is projected without deleting original snapshot fields or personal reading state', () => {
  const item = original(),
    raw = LibrarySchema.parse({
      saved: [
        {
          itemId: item.id,
          version: item.version,
          title: item.title,
          summary: item.summary,
          sourceUrl: item.source.url,
          savedAt: item.publishedAt,
          currentStatus: 'published',
          currentVersion: 2,
        },
      ],
      reactions: [],
      positions: [
        {
          itemId: item.id,
          version: 2,
          percent: 30,
          updatedAt: item.publishedAt,
        },
      ],
      preferences: {
        topics: ['Inflation'],
        mutedTopics: [],
        mode: 'chronological',
      },
      reminders: [],
      notifications: [],
    });
  const before = JSON.stringify(raw);
  const projected = publicLibrary(raw, [
    { ...item, version: 3, status: 'withdrawn' },
  ]);
  assert.equal(projected.saved[0].summary, '');
  assert.equal(projected.saved[0].currentVersion, 3);
  assert.deepEqual(projected.positions, raw.positions);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(
    publicLibrary(raw, [{ ...item, version: 4 }]).saved[0].summary,
    item.summary,
  );
});
