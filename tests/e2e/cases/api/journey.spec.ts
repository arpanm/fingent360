import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { CatalogSchema, PreviewSchema, ReviewSchema, WorkspaceSchema, SessionSchema } from '../../../../packages/contracts/src/index';
const base = '/api/v1/journey';
async function session(request: APIRequestContext) {
  const response = await request.post(`${base}/workspaces`, { data: {} });
  // Read failure details only: successful responses contain a private access key.
  const detail = response.status() === 201 ? '' : await response.text();
  expect(response.status(), `Workspace creation failed: ${detail}`).toBe(201);
  const { token } = SessionSchema.parse(await response.json());
  return { Authorization: `Bearer ${token}` };
}
const portfolio = { holdings: [{ instrumentId: 'alpha-air', quantity: '10' }], cash: '1000.00', goals: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Education', type: 'education', target: '1000.00', targetDate: '2030-01-01', priority: 'essential', allocationPercent: 40 }] };
test.describe('Working journey @SLICE-001', () => {
  test('E2E-API-010 catalog identifies every claim as synthetic', async ({ request }) => {
    const response = await request.get(`${base}/catalog`);
    expect(response.status()).toBe(200);
    const catalog = CatalogSchema.parse(await response.json());
    expect(catalog.mode).toBe('synthetic');
    expect(catalog.event.sources).toHaveLength(2);
    expect(catalog.event.claimKind).toBe('scenario');
  });
  test('E2E-API-011 persisted portfolio, replay, concurrency and immutable reviews', async ({ request }) => {
    const headers = await session(request);
    try {
      const data = { portfolio, expectedRevision: 0, idempotencyKey: randomUUID() };
      const response = await request.post(`${base}/workspace`, { headers, data });
      expect(response.status()).toBe(200);
      const saved = WorkspaceSchema.parse(await response.json());
      expect(saved.valuation.total).toBe('2000.00');
      expect(saved.valuation.goals[0]?.funded).toBe('800.00');
      const replay = await request.post(`${base}/workspace`, { headers, data });
      expect(await replay.json()).toEqual(saved);
      expect((await request.post(`${base}/workspace`, { headers, data: { ...data, portfolio: { ...portfolio, cash: '0.00' } } })).status()).toBe(409);
      expect((await request.post(`${base}/workspace`, { headers, data: { ...data, idempotencyKey: randomUUID() } })).status()).toBe(409);
      const reviewResponse = await request.post(`${base}/reviews`, { headers, data: { scenario: 'baseline' } });
      expect(reviewResponse.status()).toBe(201);
      const review = ReviewSchema.parse(await reviewResponse.json());
      expect(review.status).toBe('review');
      for (const scenario of ['stale', 'conflicting']) {
        const blocked = await request.post(`${base}/reviews`, { headers, data: { scenario } });
        expect(ReviewSchema.parse(await blocked.json()).status).toBe('unable_to_assess');
      }
      expect((await request.post(`${base}/workspace`, { headers, data: { expectedRevision: 1, idempotencyKey: randomUUID(), portfolio: { ...portfolio, cash: '2000.00' } } })).status()).toBe(200);
      const original = await request.get(`${base}/reviews/${review.id}`, { headers });
      expect(ReviewSchema.parse(await original.json()).valuation.total).toBe('2000.00');
      const reload = await request.get(`${base}/workspace`, { headers });
      expect(WorkspaceSchema.parse(await reload.json()).valuation.total).toBe('3000.00');
    } finally { await request.delete(`${base}/workspace`, { headers }); }
  });
  test('E2E-API-012 CSV preview is non-mutating and confirmation reconciles/idempotent', async ({ request }) => {
    const headers = await session(request);
    try {
      const data = { csv: 'instrumentId,quantity\nalpha-air,10\n', cash: '1000.00', sourceTotal: '2000.00' };
      for (const variant of [{ ...data, sourceTotal: '1.00' }, { ...data, csv: 'instrumentId,quantity\nalpha-air,10\nalpha-air,10' }, { ...data, csv: 'instrumentId,quantity\nunknown,10' }]) {
        const response = await request.post(`${base}/previews`, { headers, data: variant });
        const preview = PreviewSchema.parse(await response.json());
        expect(preview.matched).toBe(false);
        expect((await request.post(`${base}/imports`, { headers, data: { previewId: preview.id, expectedRevision: 0, idempotencyKey: randomUUID() } })).status()).toBe(400);
      }
      const before = await request.get(`${base}/workspace`, { headers });
      expect(WorkspaceSchema.parse(await before.json()).revision).toBe(0);
      const response = await request.post(`${base}/previews`, { headers, data });
      const preview = PreviewSchema.parse(await response.json());
      expect(preview.matched).toBe(true);
      const confirmation = { previewId: preview.id, expectedRevision: 0, idempotencyKey: randomUUID() };
      const imported = await request.post(`${base}/imports`, { headers, data: confirmation });
      expect(imported.status()).toBe(200);
      expect(WorkspaceSchema.parse(await imported.json()).valuation.total).toBe('2000.00');
      const replay = await request.post(`${base}/imports`, { headers, data: confirmation });
      expect(WorkspaceSchema.parse(await replay.json()).revision).toBe(1);
      expect((await request.post(`${base}/imports`, { headers, data: { ...confirmation, expectedRevision: 1, idempotencyKey: randomUUID() } })).status()).toBe(409);
    } finally { await request.delete(`${base}/workspace`, { headers }); }
  });
  test('E2E-API-013 ownership, invalid input and deletion', async ({ request }) => {
    const headers = await session(request); const other = await session(request);
    try {
      expect((await request.get(`${base}/workspace`)).status()).toBe(401);
      const response = await request.post(`${base}/reviews`, { headers, data: { scenario: 'baseline' } });
      const review = ReviewSchema.parse(await response.json());
      expect(review.status).toBe('unable_to_assess');
      expect((await request.get(`${base}/reviews/${review.id}`, { headers: other })).status()).toBe(404);
      const previewResponse = await request.post(`${base}/previews`, { headers, data: { csv: 'instrumentId,quantity\nalpha-air,10', cash: '1000.00', sourceTotal: '2000.00' } });
      const preview = PreviewSchema.parse(await previewResponse.json());
      expect((await request.post(`${base}/imports`, { headers: other, data: { previewId: preview.id, expectedRevision: 0, idempotencyKey: randomUUID() } })).status()).toBe(404);
      expect((await request.get(`${base}/workspace`, { headers })).headers()['cache-control']).toBe('no-store');
      for (const invalid of [{ ...portfolio, unexpected: true }, { ...portfolio, holdings: [{ instrumentId: 'alpha-air', quantity: '-1' }] }, { ...portfolio, goals: [{ ...portfolio.goals[0], allocationPercent: 101 }] }])
        expect((await request.post(`${base}/workspace`, { headers, data: { portfolio: invalid, expectedRevision: 0, idempotencyKey: randomUUID() } })).status()).toBe(400);
      await request.delete(`${base}/workspace`, { headers });
      expect((await request.get(`${base}/workspace`, { headers })).status()).toBe(401);
    } finally { await request.delete(`${base}/workspace`, { headers: other }); await request.delete(`${base}/workspace`, { headers }); }
  });
});
