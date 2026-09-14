import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workerFreshness,
  WorkerControlInputSchema,
  WorkerCountSchema,
  WorkerControlReceiptSchema,
} from '../dist/index.js';
test('worker observation distinguishes absent fresh and stale at the exact30second boundary', () => {
  const at = '2026-01-01T00:01:00.000Z';
  assert.equal(workerFreshness(null, at), 'not-observed');
  assert.equal(workerFreshness('2026-01-01T00:00:30.000Z', at), 'fresh');
  assert.equal(workerFreshness('2026-01-01T00:00:29.999Z', at), 'stale');
});
test('worker controls require explicit confirmation and reject private or unknown fields', () => {
  const request = {
    requestId: 'ac027ce4-2199-4303-a282-0e627d2ca234',
    expectedVersion: 1,
    paused: true,
    confirm: true,
  };
  assert.equal(WorkerControlInputSchema.safeParse(request).success, true);
  assert.equal(
    WorkerControlInputSchema.safeParse({ ...request, confirm: false }).success,
    false,
  );
  assert.equal(
    WorkerControlInputSchema.safeParse({ ...request, title: 'private' })
      .success,
    false,
  );
  assert.equal(
    WorkerControlReceiptSchema.safeParse({
      requestId: request.requestId,
      worker: 'reports',
      paused: true,
      version: 2,
      recordedAt: '2026-01-01T00:00:00.000Z',
      actor: 'private',
    }).success,
    false,
  );
  assert.equal(
    WorkerCountSchema.safeParse({ count: 10001, moreAvailable: true }).success,
    false,
  );
});
