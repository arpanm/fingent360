import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DeploymentMonitoringWorker } from '../dist/deployment-monitoring.js';

test('uncertain persistence keeps the same monitoring receipt and delta for the next tick', async () => {
  const attempts = [];
  const store = {
    async capture(id, processId, delta) {
      attempts.push({ id, processId, delta });
      if (attempts.length === 1)
        throw new Error('Synthetic lost commit acknowledgment');
    },
    async retire() {},
  };
  const worker = new DeploymentMonitoringWorker(store);
  // Drive explicit ticks with no interval, service, network or database startup.
  await worker.tick();
  await worker.tick();
  await worker.tick();
  assert.equal(attempts.length, 3);
  assert.equal(attempts[0].id, attempts[1].id);
  assert.deepEqual(attempts[0].delta, attempts[1].delta);
  assert.notEqual(attempts[1].id, attempts[2].id);
  assert.equal(attempts[0].processId, attempts[2].processId);
});
