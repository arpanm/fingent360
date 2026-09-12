import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { CurrentAccountSchema, WatchlistSchema } from '../../../../packages/contracts/src/index';
const headers = { Origin: 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
// Capture options are worker-scoped and must be declared at file scope.
// Keep credentials out of trace, video and screenshot artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('Account ownership and watchlists @ACCOUNT-001', () => {
  test('E2E-API-030 register, save, isolate, login and delete', async ({ request, playwright, baseURL }) => {
    test.setTimeout(60000);
    const username = `e2e_${randomUUID().slice(0,16)}`;
    const secondName = `e2e_${randomUUID().slice(0,16)}`;
    const other = await playwright.request.newContext({ baseURL: baseURL! });
    try {
      expect((await request.post('/api/v1/account/register',{ headers, data:{ username,password,consent:true } })).status()).toBe(201);
      const first = CurrentAccountSchema.parse(await (await request.get('/api/v1/account')).json()).user!;
      expect(first.username).toBe(username);
      expect((await request.put('/api/v1/account/watchlist',{ headers, data:{ indicators:['NY.GDP.MKTP.KD.ZG'] } })).status()).toBe(200);
      expect((await other.post('/api/v1/account/register',{ headers, data:{ username:secondName,password,consent:true } })).status()).toBe(201);
      expect(WatchlistSchema.parse(await (await other.get('/api/v1/account/watchlist')).json()).indicators).toEqual([]);
      expect((await other.put('/api/v1/account/watchlist',{ headers, data:{ indicators:[],userId:first.id } })).status()).toBe(400);
      expect((await request.post('/api/v1/account/logout',{ headers, data:{} })).status()).toBe(200);
      expect((await request.get('/api/v1/account/watchlist')).status()).toBe(401);
      expect((await request.post('/api/v1/account/login',{ headers, data:{ username,password } })).status()).toBe(200);
      expect(WatchlistSchema.parse(await (await request.get('/api/v1/account/watchlist')).json()).indicators).toEqual(['NY.GDP.MKTP.KD.ZG']);
      expect((await request.delete('/api/v1/account',{ headers, data:{password} })).status()).toBe(200);
      expect(CurrentAccountSchema.parse(await (await request.get('/api/v1/account')).json()).user).toBeNull();
      expect((await request.post('/api/v1/account/login',{ headers, data:{ username,password } })).status()).toBe(401);
    } finally {
      await request.delete('/api/v1/account',{ headers,data:{password} });
      await other.delete('/api/v1/account',{ headers,data:{password} });
      await other.dispose();
    }
  });
  test('E2E-API-031 wrong password, origin and consent reject; cookies are HttpOnly', async ({ request }) => {
    const username = `e2e_${randomUUID().slice(0,16)}`;
    const data = { username,password,consent:true };
    expect((await request.post('/api/v1/account/register',{ data })).status()).toBe(403);
    expect((await request.post('/api/v1/account/register',{ headers:{Origin:'https://evil.example'},data })).status()).toBe(403);
    expect((await request.post('/api/v1/account/register',{ headers,data:{...data,consent:false} })).status()).toBe(400);
    const created = await request.post('/api/v1/account/register',{ headers,data });
    expect(created.status()).toBe(201);
    try {
      const cookie = created.headers()['set-cookie'] ?? '';
      expect(cookie.includes('HttpOnly')).toBe(true);
      expect(cookie.includes('SameSite=Strict')).toBe(true);
      expect((await request.delete('/api/v1/account',{ headers,data:{ password:'incorrect-password-123' } })).status()).toBe(401);
      expect((await request.put('/api/v1/account/watchlist',{ headers:{Origin:'https://evil.example'},data:{indicators:[]} })).status()).toBe(403);
      expect((await request.put('/api/v1/account/watchlist',{ headers,data:{indicators:['NY.GDP.MKTP.KD.ZG','NY.GDP.MKTP.KD.ZG']} })).status()).toBe(400);
      await request.post('/api/v1/account/logout',{ headers,data:{} });
      expect((await request.post('/api/v1/account/login',{ headers,data:{username,password:'incorrect-password-123'} })).status()).toBe(401);
      expect((await request.post('/api/v1/account/login',{ headers,data:{username,password} })).status()).toBe(200);
    } finally { await request.delete('/api/v1/account',{headers,data:{password}}); }
  });
});
