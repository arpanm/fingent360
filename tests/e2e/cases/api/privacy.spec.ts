import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  PrivacyExportSchema,
  SessionsSchema,
  CurrentAccountSchema,
  SavedGoalSchema,
  HoldingsPreviewSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-050 own export, session revocation and ownership @PRIVACY-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(90000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  const second = await playwright.request.newContext({ baseURL: baseURL! });
  const username = `e2e_${randomUUID().slice(0, 16)}`;
  try {
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      401,
    );
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: { username, password, consent: true },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/account/watchlist', {
          headers,
          data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await second.post('/api/v1/account/login', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await other.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const goalInput = {
      name: 'Synthetic privacy goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '1000',
      monthlyMinor: '2000',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    };
    const goalResponse = await request.post('/api/v1/account/goals', {
      headers,
      data: goalInput,
    });
    expect(goalResponse.status()).toBe(201);
    const goal = SavedGoalSchema.parse(await goalResponse.json());
    expect(
      (
        await request.put(`/api/v1/account/goals/${goal.id}`, {
          headers,
          data: {
            expectedVersion: 1,
            goal: { ...goalInput, name: 'Revised synthetic privacy goal' },
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.delete(`/api/v1/account/goals/${goal.id}`, {
          headers,
          data: { expectedVersion: 2 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.put('/api/v1/account/alert-preferences', {
          headers,
          data: { indicator: 'NY.GDP.MKTP.KD.ZG', muted: true },
        })
      ).status(),
    ).toBe(200);
    const holdingsPreviewResponse = await request.post(
      '/api/v1/account/holdings/preview',
      {
        headers,
        data: {
          csv: 'isin,quantity,total_cost_paise\nINE002A01018,2,123456',
          expectedVersion: 0,
          storageConsent: true,
        },
      },
    );
    expect(holdingsPreviewResponse.status()).toBe(201);
    const holdingsPreview = HoldingsPreviewSchema.parse(
      await holdingsPreviewResponse.json(),
    );
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers,
          data: { previewId: holdingsPreview.previewId, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(201);
    const response = await request.get('/api/v1/account/privacy/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['cache-control']).toContain('no-store');
    const raw = await response.text();
    const exported = PrivacyExportSchema.parse(JSON.parse(raw));
    expect(exported.account.username).toBe(username);
    expect(exported.watchlist.indicators).toEqual(['NY.GDP.MKTP.KD.ZG']);
    expect(raw).not.toMatch(
      /password_hash|password_salt|token_hash|RESEARCH_ADMIN_TOKEN/,
    );
    expect(exported.sessions).toHaveLength(2);
    expect(exported.holdings.available).toBe(true);
    expect(exported.holdings.currentVersion).toBe(1);
    expect(exported.holdings.revisions).toHaveLength(1);
    expect(exported.holdings.revisions[0]?.totalCostMinor).toBe('123456');
    expect(exported.holdings.previews[0]?.confirmedVersion).toBe(1);
    expect(exported.alertPreferences.available).toBe(true);
    expect(exported.alertPreferences.items).toHaveLength(1);
    expect(exported.alertPreferences.items[0]?.muted).toBe(true);
    expect(exported.goals.available).toBe(true);
    expect(
      exported.goals.revisions.map((revision) => revision.goal.version),
    ).toEqual([1, 2]);
    expect(
      exported.goals.revisions.every(
        (revision) =>
          revision.goal.id === goal.id && revision.deletedAt !== null,
      ),
    ).toBe(true);
    const otherExport = PrivacyExportSchema.parse(
      await (await other.get('/api/v1/account/privacy/export')).json(),
    );
    expect(otherExport.goals.revisions).toEqual([]);
    expect(otherExport.watchlist.indicators).toEqual([]);
    expect(otherExport.holdings.revisions).toEqual([]);
    expect(otherExport.holdings.previews).toEqual([]);
    expect(otherExport.alertPreferences.items).toEqual([]);
    const foreign = SessionsSchema.parse(
      await (await other.get('/api/v1/account/privacy/sessions')).json(),
    ).sessions[0]!;
    const target = exported.sessions.find((session) => !session.current)!;
    const current = exported.sessions.find((session) => session.current)!;
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke', {
          headers,
          data: { sessionId: foreign.id },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke', {
          headers,
          data: { sessionId: current.id },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke', {
          headers: { Origin: 'https://evil.example' },
          data: { sessionId: target.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke', {
          headers,
          data: { sessionId: target.id, userId: exported.account.id },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke', {
          headers,
          data: { sessionId: target.id },
        })
      ).status(),
    ).toBe(200);
    expect((await second.get('/api/v1/account/privacy/export')).status()).toBe(
      401,
    );
    expect(
      CurrentAccountSchema.parse(
        await (await other.get('/api/v1/account')).json(),
      ).user,
    ).not.toBeNull();
    expect(
      (
        await second.post('/api/v1/account/login', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/account/privacy/sessions/revoke-others', {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(200);
    expect(
      (await second.get('/api/v1/account/privacy/sessions')).status(),
    ).toBe(401);
    expect(
      SessionsSchema.parse(
        await (await request.get('/api/v1/account/privacy/sessions')).json(),
      ).sessions,
    ).toHaveLength(1);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await second.dispose();
    await other.dispose();
  }
});
