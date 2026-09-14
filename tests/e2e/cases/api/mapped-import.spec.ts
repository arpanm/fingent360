import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import { mappedInput, mappedCsv } from '../../fixtures/mapped-holdings';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const account = () => ({
  username: `mapped_${randomUUID().slice(0, 12)}`,
  password: 'Synthetic-mapping-2026',
  consent: true,
});
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-API-610 mapped source preview confirmation replay metadata export and deletion are actual owned workflows @MAPPED-IMPORT-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const user = account();
  expect(
    (
      await request.post('/api/v1/account/register', { headers, data: user })
    ).status(),
  ).toBe(201);
  const response = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: { ...mappedInput(), expectedVersion: 0, storageConsent: true },
  });
  expect(response.status()).toBe(201);
  const preview = HoldingsPreviewSchema.parse(await response.json());
  expect(preview.holdings).toEqual([
    { isin: 'INE002A01018', quantity: '1.000001', totalCostMinor: '10001' },
  ]);
  expect(preview.import).toMatchObject({
    parserVersion: 'user-mapped-holdings-csv-v1',
    declaredRowCount: 2,
    consolidatedRowCount: 1,
    declaredTotalMinor: '10001',
  });
  const stranger = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    expect(
      (
        await stranger.post('/api/v1/account/register', {
          headers,
          data: account(),
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await stranger.post('/api/v1/account/holdings/confirm', {
          headers,
          data: { previewId: preview.previewId, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await stranger.dispose();
  }
  const confirm = () =>
    request.post('/api/v1/account/holdings/confirm', {
      headers,
      data: { previewId: preview.previewId, expectedVersion: 0 },
    });
  const savedResponse = await confirm();
  expect(savedResponse.status()).toBe(201);
  const saved = HoldingsSnapshotSchema.parse(await savedResponse.json());
  expect(saved.import).toEqual(preview.import);
  expect(await (await confirm()).json()).toEqual(saved);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.holdings.revisions[0]?.import).toEqual(preview.import);
  expect(
    exported.holdings.previews.find((p) => p.id === preview.previewId)?.import,
  ).toEqual(preview.import);
  expect(JSON.stringify(exported)).not.toContain(mappedCsv);
  expect(JSON.stringify(exported)).not.toContain('Synthetic, never retain');
  expect(JSON.stringify(exported)).not.toContain('Private note');
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: user.password },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/v1/account/holdings')).status()).toBe(401);
});
test('E2E-API-611 invalid mapped units totals duplicates and extra fields preserve actual saved history and previews @MAPPED-IMPORT-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', { headers, data: account() });
  const seeded = HoldingsPreviewSchema.parse(
    await (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: {
          csv: 'isin,quantity,total_cost_paise\nINE002A01018,2,1000',
          expectedVersion: 0,
          storageConsent: true,
        },
      })
    ).json(),
  );
  await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: { previewId: seeded.previewId, expectedVersion: 0 },
  });
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).holdings;
  const base = mappedInput();
  for (const change of [
    { declaredTotal: '100.02' },
    { declaredRowCount: 1 },
    { mapping: { ...base.mapping, duplicates: 'reject' } },
    { mapping: { ...base.mapping, costUnit: 'USD' } },
    { mapping: { ...base.mapping, costColumn: 1 } },
    { csv: 'A,B,C\n"bad,1,2' },
    { providerVerified: true },
  ]) {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: { ...base, ...change, expectedVersion: 1, storageConsent: true },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).not.toContain('Synthetic, never retain');
  }
  const oversized = {
    ...base,
    csv:
      'Ignored,Security,Units,Cost\n' +
      Array.from(
        { length: 100 },
        () => `${'界'.repeat(330)},INE002A01018,1,1`,
      ).join('\n'),
    mapping: {
      isinColumn: 1,
      quantityColumn: 2,
      costColumn: 3,
      costUnit: 'INR-rupees',
      duplicates: 'combine',
    },
    declaredRowCount: 100,
    declaredTotal: '100',
    expectedVersion: 1,
    storageConsent: true,
  };
  expect(Buffer.byteLength(JSON.stringify(oversized))).toBeLessThan(102400);
  const bounded = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: oversized,
  });
  expect(bounded.status()).toBe(400);
  expect(await bounded.text()).toContain('100,000 encoded bytes');
  expect(
    PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    ).holdings,
  ).toEqual(before);
});
test('E2E-API-612 mapped preview enforces actual authentication origin and current version @MAPPED-IMPORT-001', async ({
  request,
}) => {
  const input = { ...mappedInput(), expectedVersion: 0, storageConsent: true };
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      })
    ).status(),
  ).toBe(401);
  await request.post('/api/v1/account/register', { headers, data: account() });
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers: { Origin: 'https://example.com' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: { ...input, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(409);
  const preview = HoldingsPreviewSchema.parse(
    await (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      })
    ).json(),
  );
  expect(preview.reconciliation?.baseline.version).toBe(0);
  expect((await request.get('/api/v1/account/holdings')).status()).toBe(200);
});
test('E2E-API-613 mapped removal acknowledgement and stale preview recovery preserve immutable revisions @MAPPED-IMPORT-001', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: account(),
      })
    ).status(),
  ).toBe(201);
  const csv =
    'isin,quantity,total_cost_paise\nINE002A01018,1,100\nINE009A01021,1,200';
  const standard = async (version: number) => {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: { csv, expectedVersion: version, storageConsent: true },
    });
    expect(response.status()).toBe(201);
    const preview = HoldingsPreviewSchema.parse(await response.json());
    const saved = await request.post('/api/v1/account/holdings/confirm', {
      headers,
      data: { previewId: preview.previewId, expectedVersion: version },
    });
    expect(saved.status()).toBe(201);
    return HoldingsSnapshotSchema.parse(await saved.json());
  };
  const first = await standard(0);
  const mapped = async (version: number) => {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        ...mappedInput(),
        expectedVersion: version,
        storageConsent: true,
      },
    });
    expect(response.status()).toBe(201);
    return HoldingsPreviewSchema.parse(await response.json());
  };
  const old = await mapped(1);
  expect(
    old.reconciliation?.changes.find((c) => c.isin === 'INE009A01021')?.status,
  ).toBe('removed');
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: old.previewId, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    ),
  ).toEqual(first);
  const second = await standard(1);
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: {
          previewId: old.previewId,
          expectedVersion: 1,
          acknowledgeRemovals: true,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    ),
  ).toEqual(second);
  const current = await mapped(2);
  const saved = await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: {
      previewId: current.previewId,
      expectedVersion: 2,
      acknowledgeRemovals: true,
    },
  });
  expect(saved.status()).toBe(201);
  const final = HoldingsSnapshotSchema.parse(await saved.json());
  expect(final.version).toBe(3);
  expect(final.holdings).toEqual(current.holdings);
  const revisions = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).holdings.revisions;
  expect(revisions.find((r) => r.version === 1)?.holdings).toEqual(
    first.holdings,
  );
  expect(revisions.find((r) => r.version === 2)?.holdings).toEqual(
    second.holdings,
  );
  expect(revisions.find((r) => r.version === 3)?.import).toEqual(
    current.import,
  );
});
