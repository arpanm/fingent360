import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthSchema, ReadinessSchema } from '../dist/index.js';

test('health rejects unknown fields and malformed timestamps', () => {
  const valid = {
    status: 'ok',
    service: 'fingent360-api',
    timestamp: '2026-09-12T00:00:00.000Z',
  };
  assert.equal(HealthSchema.safeParse(valid).success, true);
  assert.equal(
    HealthSchema.safeParse({ ...valid, timestamp: 'yesterday' }).success,
    false,
  );
  assert.equal(
    HealthSchema.safeParse({ ...valid, secret: 'must not leak' }).success,
    false,
  );
  assert.equal(
    HealthSchema.safeParse({ ...valid, status: 'ready' }).success,
    false,
  );
});

test('readiness requires an explicit state for each database', () => {
  assert.equal(
    ReadinessSchema.safeParse({
      status: 'ready',
      dependencies: { postgres: 'up' },
    }).success,
    false,
  );
});
