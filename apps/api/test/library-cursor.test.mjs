import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryFeedPage, decodeLibraryFeedCursor } from '../dist/library.js';
const fingerprint = 'a'.repeat(64);
test('opaque feed cursor pages an unchanged ordered snapshot without gaps or duplicates', () => {
  const rows = Array.from({ length: 45 }, (_, id) => ({ id }));
  const first = libraryFeedPage(rows, fingerprint);
  assert.equal(first.items.length, 20);
  assert.ok(first.nextCursor);
  assert.notEqual(first.nextCursor, '20');
  const second = libraryFeedPage(rows, fingerprint, first.nextCursor);
  const third = libraryFeedPage(rows, fingerprint, second.nextCursor);
  assert.equal(third.nextCursor, null);
  assert.deepEqual([...first.items, ...second.items, ...third.items], rows);
  assert.deepEqual(
    libraryFeedPage(rows, fingerprint, first.nextCursor),
    second,
  );
});
test('changed feed versions preferences or account invalidate an old cursor', () => {
  const rows = Array.from({ length: 25 }, (_, id) => id);
  const first = libraryFeedPage(rows, fingerprint);
  assert.throws(
    () => libraryFeedPage(rows, 'b'.repeat(64), first.nextCursor),
    (error) => error.getStatus() === 409,
  );
});
test('malformed oversized noncanonical and unsupported cursor payloads reject', () => {
  for (const cursor of [
    '20',
    '!',
    'a'.repeat(257),
    Buffer.from(
      JSON.stringify({ policyVersion: 'unknown', fingerprint, offset: 20 }),
    ).toString('base64url'),
    Buffer.from(
      JSON.stringify({ policyVersion: 'explicit-v1', fingerprint, offset: -1 }),
    ).toString('base64url'),
  ])
    assert.throws(
      () => decodeLibraryFeedCursor(cursor),
      (error) => error.getStatus() === 400,
    );
  const offset = Buffer.from(
    JSON.stringify({ policyVersion: 'explicit-v1', fingerprint, offset: 3 }),
  ).toString('base64url');
  assert.throws(
    () => libraryFeedPage([1, 2, 3], fingerprint, offset),
    (error) => error.getStatus() === 400,
  );
});
