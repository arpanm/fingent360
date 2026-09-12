import assert from 'node:assert/strict';
import {
  HealthSchema,
  ReadinessSchema,
} from '../packages/contracts/dist/index.js';
const base = `http://127.0.0.1:${process.env.API_PORT || 4100}/api/v1`;
for (const [path, schema] of [
  ['health', HealthSchema],
  ['ready', ReadinessSchema],
]) {
  const response = await fetch(`${base}/${path}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(
    response.status,
    200,
    `${path} failed with HTTP ${response.status}`,
  );
  console.log(path, schema.parse(await response.json()));
}
