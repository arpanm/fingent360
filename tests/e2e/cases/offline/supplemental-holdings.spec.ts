import { test, expect } from '@playwright/test';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import { mappingAccount } from '../../helpers/mapped-import';
import {
  prepareSupplemental,
  previewSupplemental,
} from '../../helpers/supplemental-holdings';
import { supplementalInput } from '../../fixtures/supplemental-holdings';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-OFFLINE-720 actual supplemental device save reload receipts export account deletion and zero API @BROKER-DIALECTS-001', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      outgoing.push(new URL(request.url()).pathname);
  });
  await mappingAccount(page, true);
  await prepareSupplemental(page);
  await previewSupplemental(page);
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText(
    'Acquisition costs supplied and attested by you using trade confirmations',
  );
  const exported = PrivacyExportSchema.parse(
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/account/privacy/export');
      if (response.status !== 200)
        throw Error('Local supplemental export failed');
      return response.json();
    }),
  );
  expect(exported.holdings.revisions[0]?.import?.supplement).toMatchObject({
    origin: 'user-attested-acquisition-cost',
    attested: true,
    rows: [
      { sourceRow: 2, totalCostMinor: '10000' },
      { sourceRow: 3, totalCostMinor: '1' },
    ],
  });
  expect(JSON.stringify(exported.holdings)).not.toContain(
    'SYNTHETIC discarded source note',
  );
  expect(JSON.stringify(exported.holdings)).not.toContain('33.33');
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/api/v1/account', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'Synthetic-mapping-2026' }),
          })
        ).status,
    ),
  ).toBe(200);
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/account/privacy/export')).status,
    ),
  ).toBe(401);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByText('Keep a private record of your holdings', { exact: true }),
  ).toBeVisible();
  expect(outgoing).toEqual([]);
});
test('E2E-OFFLINE-721 actual local invalid row binding preserves storage and replay remains original after later replacement @BROKER-DIALECTS-001', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      outgoing.push(new URL(request.url()).pathname);
  });
  await mappingAccount(page, true);
  const result = await page.evaluate(async (input) => {
    const post = async (path: string, data: unknown) => {
      const response = await fetch(`/api/v1/account/holdings/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { status: response.status, body: await response.json() };
    };
    const exported = async () => {
      const response = await fetch('/api/v1/account/privacy/export');
      if (response.status !== 200) throw Error('Local export failed');
      return response.json();
    };
    const preview = await post('preview', {
      ...input,
      expectedVersion: 0,
      storageConsent: true,
    });
    if (preview.status !== 201) throw Error('Local supplied preview failed');
    const confirmation = {
      previewId: preview.body.previewId,
      expectedVersion: 0,
    };
    const saved = await post('confirm', confirmation);
    if (saved.status !== 201) throw Error('Local supplied confirmation failed');
    const before = await exported();
    const invalid = await post('preview', {
      ...input,
      csv: input.csv.replace(',3,', ',4,'),
      expectedVersion: 1,
      storageConsent: true,
    });
    const after = await exported();
    const changed = await post('preview', {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,7,20000',
      expectedVersion: 1,
      storageConsent: true,
    });
    if (changed.status !== 201) throw Error('Local subsequent preview failed');
    const later = await post('confirm', {
      previewId: changed.body.previewId,
      expectedVersion: 1,
    });
    const replay = await post('confirm', confirmation);
    const current = await fetch('/api/v1/account/holdings');
    return {
      preview,
      saved,
      invalid,
      before: before.holdings,
      after: after.holdings,
      later,
      replay,
      currentStatus: current.status,
      current: await current.json(),
    };
  }, supplementalInput());
  expect(
    HoldingsPreviewSchema.parse(result.preview.body).import?.parserVersion,
  ).toBe('user-supplemented-holdings-csv-v1');
  expect(result.invalid.status).toBe(400);
  expect(result.after).toEqual(result.before);
  expect(result.later.status).toBe(201);
  expect(result.replay.status).toBe(201);
  expect(result.replay.body).toEqual(result.saved.body);
  expect(result.currentStatus).toBe(200);
  expect(HoldingsSnapshotSchema.parse(result.current).version).toBe(2);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('200.00');
  expect(outgoing).toEqual([]);
});
test('E2E-OFFLINE-722 actual local supplemental empty replacement requires removal consent and exposes bundled research help @BROKER-DIALECTS-001', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      outgoing.push(new URL(request.url()).pathname);
  });
  await mappingAccount(page, true);
  await prepareSupplemental(page);
  await previewSupplemental(page);
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async (base) => {
    const post = async (path: string, data: unknown) => {
      const response = await fetch(`/api/v1/account/holdings/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { status: response.status, body: await response.json() };
    };
    const input = {
      ...base,
      csv: 'ISIN,Quantity',
      declaredRowCount: 0,
      declaredTotal: '0',
      supplement: { ...base.supplement, rows: [] },
      expectedVersion: 1,
      storageConsent: true,
    };
    const preview = await post('preview', input);
    if (preview.status !== 201) throw Error('Local zero-row preview failed');
    const confirm = { previewId: preview.body.previewId, expectedVersion: 1 };
    const missingConsent = await post('confirm', confirm);
    const before = await fetch('/api/v1/account/holdings');
    const retained = await before.json();
    const saved = await post('confirm', {
      ...confirm,
      acknowledgeRemovals: true,
    });
    return { missingConsent, retained, saved };
  }, supplementalInput());
  expect(result.missingConsent.status).toBe(400);
  expect(HoldingsSnapshotSchema.parse(result.retained).holdings).toHaveLength(
    1,
  );
  expect(result.saved.status).toBe(201);
  const saved = HoldingsSnapshotSchema.parse(result.saved.body);
  expect(saved.holdings).toEqual([]);
  expect(saved.import?.supplement?.rows).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('No holdings saved');
  await page
    .getByText('Broker export help and supported imports', { exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Your broker', exact: true })
    .selectOption('icici-direct');
  await expect(
    page.getByText(
      /ICICI Direct says off-market Portfolio entries can use transfer-day closing prices/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Automatic broker formats are not enabled/),
  ).toBeVisible();
  expect(outgoing).toEqual([]);
});
