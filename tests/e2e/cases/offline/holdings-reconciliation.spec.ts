import { test, expect } from '@playwright/test';
import {
  HoldingsPreviewSchema,
  PrivacyExportSchema,
  HoldingsSnapshotSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-410 exact replacement review, removal acknowledgement, export and deletion stay on device @HOLDINGS-RECONCILE-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) network.push(request.url());
  });
  await page.goto('/#holdings');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const call = async (path: string, method = 'GET', body?: unknown) =>
    page.evaluate(
      async ({ path, method, body }) => {
        const response = await fetch('/api/v1/account' + path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, body: await response.json() };
      },
      { path, method, body },
    );
  const password = 'Synthetic-reconcile-offline-2026';
  expect(
    (
      await call('/register', 'POST', {
        username: `rec_${Date.now()}`,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  const first = HoldingsPreviewSchema.parse(
    (
      await call('/holdings/preview', 'POST', {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,1.000001,9007199254740993',
        expectedVersion: 0,
        storageConsent: true,
      })
    ).body,
  );
  expect(
    (
      await call('/holdings/confirm', 'POST', {
        previewId: first.previewId,
        expectedVersion: 0,
      })
    ).status,
  ).toBe(201);
  const empty = HoldingsPreviewSchema.parse(
    (
      await call('/holdings/preview', 'POST', {
        csv: 'isin,quantity,total_cost_paise',
        expectedVersion: 1,
        storageConsent: true,
      })
    ).body,
  );
  expect(empty.reconciliation?.changes[0]?.quantityDelta).toBe('-1.000001');
  expect(empty.reconciliation?.totalCostDeltaMinor).toBe('-9007199254740993');
  expect(
    (
      await call('/holdings/confirm', 'POST', {
        previewId: empty.previewId,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call('/holdings/confirm', 'POST', {
        previewId: empty.previewId,
        expectedVersion: 1,
        acknowledgeRemovals: true,
      })
    ).status,
  ).toBe(201);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const exported = PrivacyExportSchema.parse(
    (await call('/privacy/export')).body,
  );
  expect(
    exported.holdings.previews.find((p) => p.id === empty.previewId)
      ?.reconciliation,
  ).toEqual(empty.reconciliation);
  expect(
    HoldingsSnapshotSchema.parse((await call('/holdings')).body).version,
  ).toBe(2);
  expect(
    (
      await call('/holdings/confirm', 'POST', {
        previewId: first.previewId,
        expectedVersion: 0,
      })
    ).body,
  ).toMatchObject({ version: 1 });
  expect((await call('', 'DELETE', { password })).status).toBe(200);
  expect(
    (
      await call('/register', 'POST', {
        username: `new_${Date.now()}`,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    PrivacyExportSchema.parse((await call('/privacy/export')).body).holdings
      .previews,
  ).toEqual([]);
  expect(
    (
      await call('/holdings/confirm', 'POST', {
        previewId: empty.previewId,
        expectedVersion: 1,
        acknowledgeRemovals: true,
      })
    ).status,
  ).toBe(404);
  expect(network).toEqual([]);
});
