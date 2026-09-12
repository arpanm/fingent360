import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  OverviewSchema,
  SavedGoalSchema,
  HoldingsPreviewSchema,
  InboxSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-API-110 overview persists exact owned data and reflects changes @UX-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(90000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  const resumed = await playwright.request.newContext({ baseURL: baseURL! });
  const username = `e2e_${randomUUID().slice(0, 16)}`;
  try {
    expect((await request.get('/api/v1/account/overview')).status()).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: { username, password, consent: true },
        })
      ).status(),
    ).toBe(201);
    const initialResponse = await request.get('/api/v1/account/overview');
    expect(initialResponse.status()).toBe(200);
    expect(initialResponse.headers()['cache-control']).toContain('no-store');
    const initial = OverviewSchema.parse(await initialResponse.json());
    expect(initial.user.username).toBe(username);
    expect(initial.goals).toEqual([]);
    expect(initial.holdings.totalCostMinor).toBe('0');
    expect(initial.holdings.holdings).toEqual([]);
    expect(initial.watchlist.indicators).toEqual([]);
    expect(initial.inbox.items).toEqual([]);

    const goalResponse = await request.post('/api/v1/account/goals', {
      headers,
      data: {
        name: 'Synthetic overview education goal',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '1000',
        monthlyMinor: '2000',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      },
    });
    expect(goalResponse.status()).toBe(201);
    const goal = SavedGoalSchema.parse(await goalResponse.json());
    const previewResponse = await request.post(
      '/api/v1/account/holdings/preview',
      {
        headers,
        data: {
          csv: 'isin,quantity,total_cost_paise\nINE002A01018,2,9007199254740993',
          expectedVersion: 0,
          storageConsent: true,
        },
      },
    );
    expect(previewResponse.status()).toBe(201);
    const preview = HoldingsPreviewSchema.parse(await previewResponse.json());
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers,
          data: { previewId: preview.previewId, expectedVersion: 0 },
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
    const populated = OverviewSchema.parse(
      await (await request.get('/api/v1/account/overview')).json(),
    );
    expect(populated.goals).toEqual([goal]);
    expect(populated.goals[0]?.projectedMinor).toBe('25000');
    expect(populated.goals[0]?.gapMinor).toBe('75000');
    expect(populated.holdings.totalCostMinor).toBe('9007199254740993');
    expect(populated.holdings.version).toBe(1);
    expect(populated.holdings.holdings[0]?.isin).toBe('INE002A01018');
    expect(populated.watchlist.indicators).toEqual(['NY.GDP.MKTP.KD.ZG']);
    expect(populated.inbox).toEqual(
      InboxSchema.parse(
        await (await request.get('/api/v1/account/inbox')).json(),
      ),
    );

    expect(
      (
        await resumed.post('/api/v1/account/login', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    const reloaded = OverviewSchema.parse(
      await (await resumed.get('/api/v1/account/overview')).json(),
    );
    expect(reloaded.user).toEqual(populated.user);
    expect(reloaded.goals).toEqual(populated.goals);
    expect(reloaded.holdings).toEqual(populated.holdings);
    expect(reloaded.watchlist).toEqual(populated.watchlist);

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
    // User-supplied query identifiers cannot select another account's read model.
    const isolated = OverviewSchema.parse(
      await (
        await other.get(`/api/v1/account/overview?userId=${populated.user.id}`)
      ).json(),
    );
    expect(isolated.user.id).not.toBe(populated.user.id);
    expect(isolated.goals).toEqual([]);
    expect(isolated.holdings.holdings).toEqual([]);
    expect(isolated.watchlist.indicators).toEqual([]);
    expect(isolated.inbox.items).toEqual([]);

    expect(
      (
        await resumed.put('/api/v1/account/alert-preferences', {
          headers,
          data: { indicator: 'NY.GDP.MKTP.KD.ZG', muted: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await resumed.delete(`/api/v1/account/goals/${goal.id}`, {
          headers,
          data: { expectedVersion: 1 },
        })
      ).status(),
    ).toBe(200);
    const changed = OverviewSchema.parse(
      await (await request.get('/api/v1/account/overview')).json(),
    );
    expect(changed.goals).toEqual([]);
    expect(changed.inbox.items).toEqual([]);
    expect(changed.inbox).toEqual(
      InboxSchema.parse(
        await (await request.get('/api/v1/account/inbox')).json(),
      ),
    );
    expect(changed.watchlist.indicators).toEqual(['NY.GDP.MKTP.KD.ZG']);
    expect(changed.holdings.totalCostMinor).toBe('9007199254740993');
    expect(
      (
        await resumed.put('/api/v1/account/alert-preferences', {
          headers,
          data: { indicator: 'NY.GDP.MKTP.KD.ZG', muted: false },
        })
      ).status(),
    ).toBe(200);
    const unmuted = OverviewSchema.parse(
      await (await request.get('/api/v1/account/overview')).json(),
    );
    expect(unmuted.inbox).toEqual(
      InboxSchema.parse(
        await (await request.get('/api/v1/account/inbox')).json(),
      ),
    );
    expect(
      (
        await request.post('/api/v1/account/logout', { headers, data: {} })
      ).status(),
    ).toBe(200);
    expect((await request.get('/api/v1/account/overview')).status()).toBe(401);
  } finally {
    await resumed.delete('/api/v1/account', { headers, data: { password } });
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await resumed.dispose();
    await other.dispose();
  }
});
