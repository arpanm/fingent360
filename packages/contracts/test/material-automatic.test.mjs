import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyMaterial,
  applyMaterial,
  automaticMaterial,
  MaterialWriteSchema,
  syncMaterialContext,
} from '../dist/index.js';
const at = '2026-09-14T00:00:00.000Z';
const indicator = 'NY.GDP.MKTP.KD.ZG';
const requestId = '00000000-0000-4000-8000-000000000001';
function enabled() {
  const initial = { ...emptyMaterial(), followed: [indicator] };
  const configured = applyMaterial(
    initial,
    {
      action: 'configure',
      requestId,
      expectedVersion: 0,
      policies: [{ indicator, thresholdPoints: '1' }],
      storageConsent: true,
    },
    [],
    at,
  );
  return applyMaterial(
    configured.state,
    {
      action: 'automatic-settings',
      requestId,
      expectedVersion: configured.state.version,
      enabled: true,
      backgroundConsent: true,
    },
    [],
    at,
    1,
  ).state;
}
test('automatic material first due is exact24h; missed days coalesce and denied purpose preserves baseline', () => {
  const state = enabled();
  assert.equal(state.automatic.nextCheckAt, '2026-09-15T00:00:00.000Z');
  assert.equal(
    automaticMaterial(state, [], '2026-09-14T23:59:59.999Z', true),
    null,
  );
  const due = automaticMaterial(state, [], '2026-09-18T00:00:00.000Z', true);
  assert.equal(due.action, 'automatic-check');
  assert.equal(due.outcomes[0].outcome, 'missing');
  assert.equal(due.state.automatic.nextCheckAt, '2026-09-19T00:00:00.000Z');
  assert.equal(automaticMaterial(due.state, [], due.at, true), null);
  const denied = automaticMaterial(
    state,
    [],
    '2026-09-15T00:00:00.000Z',
    false,
  );
  assert.equal(denied.action, 'automatic-paused');
  assert.deepEqual(denied.state.baselines, state.baselines);
  assert.equal(denied.state.automatic.enabled, false);
  assert.equal(
    MaterialWriteSchema.safeParse({
      action: 'automatic-settings',
      requestId,
      expectedVersion: 1,
      enabled: true,
      backgroundConsent: false,
    }).success,
    false,
  );
  const removed = applyMaterial(
    state,
    {
      action: 'configure',
      requestId,
      expectedVersion: state.version,
      policies: [],
      storageConsent: true,
    },
    [],
    at,
  );
  assert.equal(removed.state.automatic.enabled, false);
  assert.equal(removed.state.automatic.nextCheckAt, null);
  assert.equal(
    syncMaterialContext(state, [], [], [], at).automatic.nextCheckAt,
    null,
  );
});
