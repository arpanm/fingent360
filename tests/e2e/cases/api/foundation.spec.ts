import { test, expect } from '@playwright/test';
import { HealthSchema, ReadinessSchema } from '../../../../packages/contracts/src/index';

test.describe('Foundation API @SETUP-001 @SDLC-001 @smoke', () => {
  test('E2E-API-001 liveness follows the public contract', async ({ request }) => {
    await test.step('GET the running versioned API, validate status and response fields', async () => {
      const response = await request.get('/api/v1/health');
      expect(response.status(), 'The local API must be running').toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
      const data = HealthSchema.parse(await response.json());
      expect(data.status).toBe('ok');
      expect(Math.abs(Date.now() - Date.parse(data.timestamp)), 'Timestamp must represent this response').toBeLessThan(60_000);
    });
  });

  test('E2E-API-002 both real databases are ready', async ({ request }) => {
    await test.step('Assert PostgreSQL and MongoDB are both reachable', async () => {
      const response = await request.get('/api/v1/ready');
      const body = await response.json();
      expect(response.status(), `Readiness failed: ${JSON.stringify(body)}`).toBe(200);
      expect(ReadinessSchema.parse(body)).toEqual({ status: 'ready', dependencies: { postgres: 'up', mongodb: 'up' } });
    });
  });

  test('E2E-API-003 unknown routes are not successful responses', async ({ request }) => {
    const response = await request.get('/api/v1/__e2e_missing_route__');
    expect(response.status()).toBe(404);
    expect((await response.json()).statusCode).toBe(404);
  });
});
