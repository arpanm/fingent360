import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryFeedPage } from '../dist/discovery.js';
const items = Array.from({ length: 65 }, (_, i) => ({
  id: `synthetic-${i}`,
  version: 1,
}));
const encoded = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
test('public research cursor keeps order and detects changed versions or filters', () => {
  const first = discoveryFeedPage(items, { view: 'explore' });
  assert.equal(first.items.length, 30);
  assert.equal(
    discoveryFeedPage(items, { view: 'explore' }, first.nextCursor).items[0].id,
    'synthetic-30',
  );
  for (const [corpus, filters] of [
    [items, { view: 'today' }],
    [items, { view: 'explore', source: 'fed' }],
    [
      items.map((v, i) => (i === 0 ? { ...v, version: 2 } : v)),
      { view: 'explore' },
    ],
  ])
    assert.throws(
      () => discoveryFeedPage(corpus, filters, first.nextCursor),
      (e) => e.getStatus() === 409,
    );
});
test('public cursor rejects noncanonical, oversized, fractional, unaligned and out-of-range offsets', () => {
  const first = discoveryFeedPage(items, {}),
    payload = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString());
  for (const cursor of [
    '',
    first.nextCursor + '=',
    'x'.repeat(257),
    ...[-1, 0, 1, 31, 90, 30.5].map((offset) =>
      encoded({ ...payload, offset }),
    ),
  ])
    assert.throws(
      () => discoveryFeedPage(items, {}, cursor),
      (e) => e.getStatus() === 400,
    );
});
