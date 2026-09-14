import { test, expect } from '../../helpers/app-fixture';
import {
  loginWorkerOperator,
  workerDatabase,
} from '../../helpers/worker-health';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
import { OperationalQualitySchema } from '../../../../packages/contracts/src/index';
test.use({ manualWorkers: true });
test('E2E-API-630 quality overview protects real aggregate storage and distinguishes malformed heads @QUALITY-OVERVIEW-001', async ({
  request,
  feedbackSandbox,
}) => {
  const url = '/api/v1/ops/quality';
  expect((await request.get(url)).status()).toBe(401);
  await loginWorkerOperator(request);
  const initial = await request.get(url);
  expect(initial.status()).toBe(200);
  expect(initial.headers()['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect(OperationalQualitySchema.parse(await initial.json()).inspected).toBe(
    0,
  );
  const source = await seedConnectionSource(feedbackSandbox);
  const db = await workerDatabase(feedbackSandbox);
  try {
    await db.query(
      "INSERT INTO discovery_items(id,version) VALUES ('synthetic-malformed-quality',1),('synthetic-missing-quality',1)",
    );
    await db.query(
      "INSERT INTO discovery_versions(item_id,version,data) VALUES ('synthetic-malformed-quality',1,$1)",
      [{ secret: 'synthetic-private-diagnostic-never-expose' }],
    );
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    const text = await response.text();
    const data = OperationalQualitySchema.parse(JSON.parse(text));
    expect(data.requests.scope).toBe('this-api-process');
    expect(data.requests.completed).toBeGreaterThan(0);
    expect(data.inspected).toBe(3);
    expect(data.valid).toBe(1);
    expect(data.invalid).toBe(1);
    expect(data.missingHead).toBe(1);
    expect(data.published).toBe(1);
    expect(text).not.toContain(source.title);
    expect(text).not.toContain('synthetic-private-diagnostic');
    expect(text).not.toContain('token_hash');
  } finally {
    await db.end();
  }
});
