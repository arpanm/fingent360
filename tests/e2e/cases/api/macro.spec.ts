import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { MacroDashboardSchema, MacroEvidenceSchema, MacroHistorySchema, MacroRunSchema } from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';

// Capture options are worker-scoped and must be declared at file scope.
// Keep credentials out of trace, video and screenshot artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('Real macro source ingestion @DATA-001 @external', () => {
  // Operator credentials must not be recorded in traces or video artifacts.
  test('E2E-API-020 real provider → raw evidence → revisions → persisted API', async ({ request }) => {
    test.setTimeout(120000);
    const token = await operatorKey();
    const headers = { Authorization: `Bearer ${token}` };
    for (const indicator of ['NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG']) {
      const response = await request.post('/api/v1/macro/refresh', { headers, data: { indicator }, timeout: 45000 });
      expect(response.status(), response.status() === 200 ? '' : await response.text()).toBe(200);
      const result = MacroRunSchema.parse(await response.json());
      expect(result.status).toBe('succeeded');
      const dashboard = MacroDashboardSchema.parse(await (await request.get('/api/v1/macro')).json());
      const source = dashboard.sources.find((s) => s.indicator === indicator)!;
      const latest = source.observations.find((o) => o.value !== null)!;
      expect(latest, 'The real provider should supply at least one non-null annual observation').toBeTruthy();
      expect(latest.sourceUrl).toContain('https://api.worldbank.org/');
      expect(source.lastSuccessAt).not.toBeNull();
      const evidenceResponse = await request.get(`/api/v1/macro/evidence/${latest.sourceHash}`);
      expect(evidenceResponse.status()).toBe(200);
      const evidence = MacroEvidenceSchema.parse(await evidenceResponse.json());
      expect(createHash('sha256').update(evidence.url + '\n' + evidence.body).digest('hex')).toBe(latest.sourceHash);
      expect(Array.isArray(JSON.parse(evidence.body))).toBe(true);
      const history = MacroHistorySchema.parse(await (await request.get(`/api/v1/macro/${indicator}/history/${latest.year}`)).json());
      expect(history[0]?.id).toBe(latest.id);
      const again = await request.post('/api/v1/macro/refresh', { headers, data: { indicator }, timeout: 45000 });
      expect(again.status()).toBe(200);
      const reloaded = MacroDashboardSchema.parse(await (await request.get('/api/v1/macro')).json());
      expect(reloaded.sources.find((s) => s.indicator === indicator)?.observations.find((o) => o.year === latest.year)?.id).toBe(latest.id);
    }
  });
  test('E2E-API-021 refresh authorization and URL/schema boundaries', async ({ request }) => {
    const token = await operatorKey();
    const data = { indicator: 'NY.GDP.MKTP.KD.ZG' };
    expect((await request.post('/api/v1/macro/refresh', { data })).status()).toBe(401);
    expect((await request.post('/api/v1/macro/refresh', { headers: { Authorization: `Bearer ${'0'.repeat(64)}` }, data })).status()).toBe(401);
    for (const invalid of [{ indicator: 'arbitrary' }, { ...data, url: 'http://127.0.0.1/private' }])
      expect((await request.post('/api/v1/macro/refresh', { headers: { Authorization: `Bearer ${token}` }, data: invalid })).status()).toBe(400);
    expect((await request.get(`/api/v1/macro/evidence/${'0'.repeat(64)}`)).status()).toBe(404);
  });
});
