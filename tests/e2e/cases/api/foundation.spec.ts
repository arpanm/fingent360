import { test, expect } from '@playwright/test';
import {
  HealthSchema,
  ReadinessSchema,
} from '../../../../packages/contracts/src/index';

test.describe('Foundation API @SETUP-001 @SDLC-001 @smoke', () => {
  test('E2E-API-006 credentialed CORS is scoped to the configured web origin @ANDROID-001', async ({
    request,
  }) => {
    const origin = process.env.E2E_WEB_URL!;
    const response = await request.get('/api/v1/health', {
      headers: { Origin: origin },
    });
    expect(response.headers()['access-control-allow-origin']).toBe(origin);
    expect(response.headers()['access-control-allow-credentials']).toBe('true');
    const other = await request.get('/api/v1/health', {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(other.headers()['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
  });
  test('E2E-API-001 liveness follows the public contract', async ({
    request,
  }) => {
    await test.step('GET the running versioned API, validate status and response fields', async () => {
      const response = await request.get('/api/v1/health');
      expect(response.status(), 'The local API must be running').toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
      const data = HealthSchema.parse(await response.json());
      expect(data.status).toBe('ok');
      expect(
        Math.abs(Date.now() - Date.parse(data.timestamp)),
        'Timestamp must represent this response',
      ).toBeLessThan(60_000);
    });
  });

  test('E2E-API-002 both real databases are ready', async ({ request }) => {
    await test.step('Assert PostgreSQL and MongoDB are both reachable', async () => {
      const response = await request.get('/api/v1/ready');
      const body = await response.json();
      expect(
        response.status(),
        `Readiness failed: ${JSON.stringify(body)}`,
      ).toBe(200);
      expect(ReadinessSchema.parse(body)).toEqual({
        status: 'ready',
        dependencies: { postgres: 'up', mongodb: 'up' },
      });
    });
  });

  test('E2E-API-003 unknown routes return JSON errors @BUG-002', async ({
    request,
  }) => {
    const response = await request.get('/api/v1/__e2e_missing_route__');
    expect(response.status()).toBe(404);
    await test.step('The API fallback returns JSON, not an HTML error page', async () => {
      expect(
        response.headers()['content-type'],
        'Unknown API routes must return application/json',
      ).toContain('application/json');
      const body = await response.json();
      expect(body.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
    });
  });
});
