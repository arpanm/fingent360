import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../dist/app.js';
import { readConfig } from '../dist/config.js';
import { HealthSchema, ReadinessSchema } from '@fingent360/contracts';
let app;
let base;
let available = true;
before(async () => {
  app = await createApp(
    {
      API_PORT: 4100,
      API_HOST: '127.0.0.1',
      WEB_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://unused/test',
      MONGODB_URI: 'mongodb://unused/test',
    },
    {
      check: async () => ({
        status: available ? 'ready' : 'unavailable',
        dependencies: { postgres: available ? 'up' : 'down', mongodb: 'up' },
      }),
      close: async () => {},
    },
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
after(async () => {
  await app?.close();
});

test('versioned health endpoint returns the shared contract', async () => {
  const response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.equal(
    HealthSchema.parse(await response.json()).service,
    'fingent360-api',
  );
});
test('ready is 200 only when both dependencies are up; down returns 503', async () => {
  let response = await fetch(`${base}/api/v1/ready`);
  assert.equal(response.status, 200);
  assert.equal(ReadinessSchema.parse(await response.json()).status, 'ready');
  available = false;
  response = await fetch(`${base}/api/v1/ready`);
  assert.equal(response.status, 503);
  assert.equal(
    ReadinessSchema.parse(await response.json()).dependencies.postgres,
    'down',
  );
  assert.equal((await fetch(`${base}/api/v1/health`)).status, 200);
});
test('unknown endpoints return 404', async () => {
  assert.equal((await fetch(`${base}/api/v1/recommendations`)).status, 404);
});
test('configuration fails fast without leaking credentials', () => {
  assert.throws(
    () =>
      readConfig({
        API_PORT: 'bad',
        DATABASE_URL: 'secret-value',
        MONGODB_URI: 'bad',
      }),
    (error) =>
      !error.message.includes('secret-value') &&
      error.message.includes('DATABASE_URL'),
  );
});
