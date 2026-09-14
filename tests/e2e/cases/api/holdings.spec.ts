import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  HoldingsSnapshotSchema,
  HoldingsPreviewSchema,
  HoldingsHistorySchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-holdings-test-2026';
const csv =
  'isin,quantity,total_cost_paise\nINE002A01018,1.000001,9007199254740993';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-090 holdings preview, confirm, isolate, replay and revisions @PORTFOLIO-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    expect((await request.get('/api/v1/account/holdings')).status()).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `hold_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const initial = HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    );
    expect(initial.version).toBe(0);
    const previewResponse = await request.post(
      '/api/v1/account/holdings/preview',
      { headers, data: { csv, expectedVersion: 0, storageConsent: true } },
    );
    expect(previewResponse.status()).toBe(201);
    const preview = HoldingsPreviewSchema.parse(await previewResponse.json());
    expect(preview.totalCostMinor).toBe('9007199254740993');
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ).holdings,
    ).toEqual([]);
    expect(
      (
        await other.post('/api/v1/account/register', {
          headers,
          data: {
            username: `hold_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const confirm = { previewId: preview.previewId, expectedVersion: 0 };
    expect(
      (
        await other.post('/api/v1/account/holdings/confirm', {
          headers,
          data: confirm,
        })
      ).status(),
    ).toBe(404);
    for (let replay = 0; replay < 2; replay++) {
      const response = await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: confirm,
      });
      expect(response.status()).toBe(201);
      const result = HoldingsSnapshotSchema.parse(await response.json());
      expect(result.version).toBe(1);
      expect(result.holdings[0]?.quantity).toBe('1.000001');
    }
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv, expectedVersion: 0, storageConsent: true },
        })
      ).status(),
    ).toBe(409);
    const empty = HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: {
            csv: 'isin,quantity,total_cost_paise',
            expectedVersion: 1,
            storageConsent: true,
          },
        })
      ).json(),
    );
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers,
          data: {
            previewId: empty.previewId,
            expectedVersion: 1,
            acknowledgeRemovals: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ).holdings,
    ).toEqual([]);
    const history = HoldingsHistorySchema.parse(
      await (await request.get('/api/v1/account/holdings/history')).json(),
    );
    expect(history.revisions).toHaveLength(2);
    expect(history.revisions[1]?.totalCostMinor).toBe('9007199254740993');
    expect(
      HoldingsSnapshotSchema.parse(
        await (await other.get('/api/v1/account/holdings')).json(),
      ).holdings,
    ).toEqual([]);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
test('E2E-API-091 malformed holdings CSV, consent and CSRF reject @PORTFOLIO-001', async ({
  request,
}) => {
  try {
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `hold_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          data: { csv, expectedVersion: 0, storageConsent: true },
        })
      ).status(),
    ).toBe(403);
    for (const invalid of [
      csv.replace('INE002A01018', 'INE002A01019'),
      `${csv}\nINE002A01018,1,1`,
      csv.replace('1.000001', '0'),
      csv.replace('9007199254740993', '1.234'),
    ])
      expect(
        (
          await request.post('/api/v1/account/holdings/preview', {
            headers,
            data: { csv: invalid, expectedVersion: 0, storageConsent: true },
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv, expectedVersion: 0, storageConsent: false },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: {
            csv,
            expectedVersion: 0,
            storageConsent: true,
            userId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ).version,
    ).toBe(0);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
  }
});
