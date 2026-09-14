import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReadingFollow,
  readingFollowAckReceipt,
  ReadingFollowWriteSchema,
} from '../dist/index.js';
const at = '2026-09-14T00:00:00.000Z';
const config = {
  version: 1,
  sources: ['fed'],
  topics: ['Inflation'],
  muted: false,
  savedAt: at,
};
const item = {
  id: 'synthetic-reading',
  version: 1,
  kind: 'news',
  title: 'Synthetic only',
  summary: '',
  body: '',
  topics: ['Inflation'],
  publishedAt: at,
  effectiveLabel: 'Synthetic',
  source: {
    name: 'Federal Reserve',
    url: 'https://www.federalreserve.gov/',
    retrievedAt: at,
    rights: 'Synthetic fixture',
  },
  sourceHash: 'a'.repeat(64),
  importance: 1,
  relatedIds: [],
  status: 'published',
  correctionNote: null,
  reviewedAt: at,
};
test('baseline then changed edition coalesces, acknowledgement survives same state, withdrawal and republication reopen', () => {
  const baseline = evaluateReadingFollow(null, item, 'fed', config, at, true);
  assert.equal(baseline.status, 'baseline');
  assert.equal(evaluateReadingFollow(baseline, item, 'fed', config, at), null);
  const opened = evaluateReadingFollow(
    baseline,
    { ...item, version: 2 },
    'fed',
    config,
    at,
  );
  assert.equal(opened.status, 'open');
  assert.equal(opened.itemId, baseline.itemId);
  const ack = {
    ...opened,
    status: 'acknowledged',
    version: opened.version + 1,
  };
  assert.equal(
    evaluateReadingFollow(ack, { ...item, version: 2 }, 'fed', config, at),
    null,
  );
  const withdrawn = evaluateReadingFollow(
    ack,
    { ...item, version: 3, status: 'withdrawn' },
    'fed',
    config,
    at,
  );
  assert.equal(withdrawn.reason, 'withdrawn');
  const again = evaluateReadingFollow(
    withdrawn,
    { ...item, version: 4 },
    'fed',
    config,
    at,
  );
  assert.equal(again.reason, 'republished');
  assert.equal('title' in again, false);
});
test('unknown/draft does not alert and removing every matching follow resolves without mutating its receipt', () => {
  assert.equal(
    evaluateReadingFollow(
      null,
      { ...item, status: 'draft' },
      'fed',
      config,
      at,
    ),
    null,
  );
  assert.equal(evaluateReadingFollow(null, null, '', config, at), null);
  const open = evaluateReadingFollow(null, item, 'fed', config, at);
  const removed = { ...config, version: 2, sources: [], topics: [] };
  const resolved = evaluateReadingFollow(
    open,
    item,
    'fed',
    removed,
    at,
    true,
    config,
  );
  assert.equal(resolved.status, 'resolved');
  assert.equal(open.status, 'open');
  assert.equal(evaluateReadingFollow(resolved, null, '', removed, at), null);
  assert.equal(
    ReadingFollowWriteSchema.safeParse({
      requestId: 'bad',
      expectedVersion: 0,
      sources: [],
      topics: [],
      muted: false,
      consent: true,
    }).success,
    false,
  );
});
test('unrelated follows and mute preserve open state; removal resolves and explicit unmute establishes fresh baseline', () => {
  const opened = evaluateReadingFollow(null, item, 'fed', config, at);
  const next = { ...config, version: 2, sources: ['fed', 'world-bank'] };
  const changed = { ...item, version: 2 };
  assert.equal(
    evaluateReadingFollow(opened, changed, 'fed', next, at, true, config),
    null,
  );
  const muted = { ...next, version: 3, muted: true };
  assert.equal(
    evaluateReadingFollow(opened, changed, 'fed', muted, at, true, next),
    null,
  );
  const resumed = { ...muted, version: 4, muted: false };
  const baseline = evaluateReadingFollow(
    opened,
    changed,
    'fed',
    resumed,
    at,
    true,
    muted,
  );
  assert.equal(baseline.status, 'resolved');
  assert.equal(baseline.edition, 2);
  const removed = evaluateReadingFollow(
    opened,
    item,
    'fed',
    { ...config, version: 2, sources: [], topics: [] },
    at,
    true,
    config,
  );
  assert.equal(removed.status, 'resolved');
  assert.equal(opened.status, 'open');
});
test('overlapping follows preserve open and acknowledged notices when either original key is removed', () => {
  for (const startWithSource of [true, false])
    for (const status of ['open', 'acknowledged']) {
      const initial = {
        ...config,
        sources: startWithSource ? ['fed'] : [],
        topics: startWithSource ? [] : ['Inflation'],
      };
      const notice = {
        ...evaluateReadingFollow(null, item, 'fed', initial, at),
        status,
      };
      const before = JSON.stringify(notice),
        both = { ...config, version: 2 };
      // A new admitted edition is not silently consumed by unrelated settings edits.
      const later = { ...item, version: 2 };
      assert.equal(
        evaluateReadingFollow(notice, later, 'fed', both, at, true, initial),
        null,
      );
      const retained = {
        ...both,
        version: 3,
        sources: startWithSource ? [] : ['fed'],
        topics: startWithSource ? ['Inflation'] : [],
      };
      assert.equal(
        evaluateReadingFollow(notice, later, 'fed', retained, at, true, both),
        null,
      );
      assert.equal(JSON.stringify(notice), before);
      const removed = { ...retained, version: 4, sources: [], topics: [] };
      assert.equal(
        evaluateReadingFollow(notice, later, 'fed', removed, at, true, retained)
          .status,
        'resolved',
      );
    }
});
test('API and device acknowledgement receipts bind the preserved observed configuration rather than later settings', () => {
  const requestId = 'a8302d26-a660-4c25-bbd5-0f8e70309105';
  const notice = evaluateReadingFollow(null, item, 'fed', config, at);
  const laterConfig = { ...config, version: 2, sources: ['fed', 'world-bank'] };
  assert.equal(
    evaluateReadingFollow(notice, item, 'fed', laterConfig, at, true, config),
    null,
  );
  const remote = readingFollowAckReceipt(notice, requestId, at, at, null);
  const local = readingFollowAckReceipt(notice, requestId, at, at, at);
  assert.equal(remote.configVersion, 1);
  assert.equal(local.configVersion, 1);
  assert.deepEqual(local, { ...remote, bundleGeneratedAt: at });
  const nextNotice = evaluateReadingFollow(
    notice,
    { ...item, version: 2 },
    'fed',
    laterConfig,
    at,
  );
  assert.equal(
    readingFollowAckReceipt(nextNotice, requestId, at, at, null).configVersion,
    2,
  );
  assert.equal(notice.configVersion, 1);
});
