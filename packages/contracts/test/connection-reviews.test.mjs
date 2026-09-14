import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConnections, emptyReviewInbox } from '../dist/index.js';
const id = '00000000-0000-4000-8000-000000000001';
const now = '2026-01-01T00:00:00.000Z';
const revision = {
  id,
  version: 1,
  removed: false,
  target: { label: 'Synthetic owned holding' },
};
const view = {
  revision,
  currentSource: null,
  currentTarget: null,
  reviewReasons: ['Source withdrawn.'],
};
test('CONNECTION-REVIEWS-001 coalesces unchanged acknowledged state and resolves removals', () => {
  const first = evaluateConnections(
    emptyReviewInbox(),
    [revision],
    [view],
    id,
    now,
    null,
  );
  assert.equal(first.inbox.notices[0].status, 'open');
  first.inbox.notices[0] = {
    ...first.inbox.notices[0],
    status: 'acknowledged',
    version: 2,
    acknowledgedAt: now,
  };
  const repeated = evaluateConnections(
    first.inbox,
    [revision],
    [view],
    id,
    now,
    null,
  );
  assert.equal(repeated.inbox.notices.length, 1);
  assert.equal(repeated.inbox.notices[0].status, 'acknowledged');
  assert.equal(repeated.receipt.evaluation.changedCount, 0);
  const removed = evaluateConnections(
    repeated.inbox,
    [{ ...revision, version: 2, removed: true }],
    [],
    id,
    now,
    null,
  );
  assert.equal(removed.inbox.notices[0].status, 'resolved');
});
