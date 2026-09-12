import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { InboxSchema } from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
// Capture options are worker-scoped and must be declared at file scope.
// Keep credentials out of trace, video and screenshot artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('Real observation inbox @ALERT-001 @external', () => {
  test('E2E-API-040 real observation acknowledgment is persistent and private', async ({
    request,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const refreshed = await request.post('/api/v1/macro/refresh', {
      headers: { Authorization: `Bearer ${await operatorKey()}` },
      data: { indicator: 'NY.GDP.MKTP.KD.ZG' },
      timeout: 45000,
    });
    expect(
      refreshed.status(),
      refreshed.status() === 200 ? '' : await refreshed.text(),
    ).toBe(200);
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
              data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
            })
          ).status(),
        ).toBe(200);
      }
      const before = InboxSchema.parse(
        await (await request.get('/api/v1/account/inbox')).json(),
      );
      expect(before.items).toHaveLength(1);
      const item = before.items[0]!;
      expect(item.read).toBe(false);
      expect(
        (
          await request.post('/api/v1/account/inbox/acknowledge', {
            headers,
            data: { observationId: item.observationId },
          })
        ).status(),
      ).toBe(200);
      expect(
        InboxSchema.parse(
          await (await request.get('/api/v1/account/inbox')).json(),
        ).items[0]?.read,
      ).toBe(true);
      expect(
        InboxSchema.parse(
          await (await other.get('/api/v1/account/inbox')).json(),
        ).items[0]?.read,
      ).toBe(false);
      await other.put('/api/v1/account/watchlist', {
        headers,
        data: { indicators: [] },
      });
      expect(
        (
          await other.post('/api/v1/account/inbox/acknowledge', {
            headers,
            data: { observationId: item.observationId },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await request.post('/api/v1/account/inbox/acknowledge', {
            headers: { Origin: 'https://evil.example' },
            data: { observationId: item.observationId },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await request.delete('/api/v1/account', { headers, data: { password } });
      await other.delete('/api/v1/account', { headers, data: { password } });
      await other.dispose();
    }
  });
});
