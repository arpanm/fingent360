import { test, expect } from '@playwright/test';
import { ReadinessSchema } from '../../../../packages/contracts/src/index';

// Separate opt-in scenario: the USER prepares the outage and restores it.
// Run-all must not stop a database or deliberately break other test cases.
test('E2E-API-004 database outage reports 503 @manual-outage @SETUP-001 @SDLC-001', async ({ request }) => {
  const down = process.env.E2E_EXPECT_DOWN;
  test.skip(down !== 'postgres' && down !== 'mongodb', 'User must prepare one database outage and set E2E_EXPECT_DOWN=postgres or mongodb before launching the runner.');
  const response = await request.get('/api/v1/ready');
  expect(response.status()).toBe(503);
  const result = ReadinessSchema.parse(await response.json());
  expect(result.status).toBe('unavailable');
  expect(result.dependencies[down as 'postgres' | 'mongodb']).toBe('down');
  expect((await request.get('/api/v1/health')).status()).toBe(200);
});
