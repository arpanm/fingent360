import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  AlertPreferencesSchema,
  InboxSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-080 mute persistence, isolation and receipt preservation @ALERT-002 @external', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(120000);
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  const indicator = 'NY.GDP.MKTP.KD.ZG';
  const password = 'E2E-only-private-passphrase-2026';
  expect(
    (await request.get('/api/v1/account/alert-preferences')).status(),
  ).toBe(401);
  const refreshed = await request.post('/api/v1/macro/refresh', {
    headers: { Authorization: `Bearer ${await operatorKey()}` },
    data: { indicator },
    timeout: 45000,
  });
  expect(refreshed.status(), await refreshed.text()).toBe(200);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    for (const client of [request, other]) {
      expect(
        (
          await client.post('/api/v1/account/register', {
            headers,
            data: {
              username: `e2e_${randomUUID().slice(0, 16)}`,
              password,
              consent: true,
            },
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await client.put('/api/v1/account/watchlist', {
            headers,
            data: { indicators: [indicator] },
          })
        ).status(),
      ).toBe(200);
    }
    const readInbox = async () =>
      InboxSchema.parse(
        await (await request.get('/api/v1/account/inbox')).json(),
      );
    const original = (await readInbox()).items[0]!;
    expect(original).toBeTruthy();
    for (const data of [
      { indicator: 'FP.CPI.TOTL.ZG', muted: true },
      { indicator, muted: 'yes' },
      { indicator, muted: true, userId: randomUUID() },
    ])
      expect(
        (
          await request.put('/api/v1/account/alert-preferences', {
            headers,
            data,
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await request.put('/api/v1/account/alert-preferences', {
          headers: { Origin: 'https://example.com' },
          data: { indicator, muted: true },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put('/api/v1/account/alert-preferences', {
          headers,
          data: { indicator, muted: true },
        })
      ).status(),
    ).toBe(200);
    expect((await readInbox()).items).toEqual([]);
    expect(
      AlertPreferencesSchema.parse(
        await (await request.get('/api/v1/account/alert-preferences')).json(),
      ).preferences[0]?.muted,
    ).toBe(true);
    expect(
      AlertPreferencesSchema.parse(
        await (await other.get('/api/v1/account/alert-preferences')).json(),
      ).preferences[0]?.muted,
    ).toBe(false);
    expect(
      (
        await request.put('/api/v1/account/alert-preferences', {
          headers,
          data: { indicator, muted: false },
        })
      ).status(),
    ).toBe(200);
    expect((await readInbox()).items[0]?.observationId).toBe(
      original.observationId,
    );
    expect(
      (
        await request.post('/api/v1/account/inbox/acknowledge', {
          headers,
          data: { observationId: original.observationId },
        })
      ).status(),
    ).toBe(200);
    for (const muted of [true, false])
      expect(
        (
          await request.put('/api/v1/account/alert-preferences', {
            headers,
            data: { indicator, muted },
          })
        ).status(),
      ).toBe(200);
    expect((await readInbox()).items[0]?.read).toBe(true);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
