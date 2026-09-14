import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import {
  supplementalInput,
  supplementalCsv,
} from '../../fixtures/supplemental-holdings';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const account = () => ({
  username: `supplied_${randomUUID().slice(0, 12)}`,
  password: 'Synthetic-supplied-2026',
  consent: true,
});
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-API-720 actual supplemental preview confirmation foreign access replay history privacy and deletion @BROKER-DIALECTS-001', async ({
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
    data: { ...supplementalInput(), expectedVersion: 0, storageConsent: true },
  });
  expect(response.status()).toBe(201);
  const preview = HoldingsPreviewSchema.parse(await response.json());
  expect(preview.holdings).toEqual([
    { isin: 'INE002A01018', quantity: '3.000001', totalCostMinor: '10001' },
  ]);
  expect(preview.import?.supplement).toMatchObject({
    origin: 'user-attested-acquisition-cost',
    attested: true,
    basis: 'trade-confirmations',
    rows: [
      { sourceRow: 2, totalCostMinor: '10000' },
      { sourceRow: 3, totalCostMinor: '1' },
    ],
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
    expect(
      PrivacyExportSchema.parse(
        await (await stranger.get('/api/v1/account/privacy/export')).json(),
      ).holdings.revisions,
    ).toEqual([]);
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
  const other = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,5,20000',
      expectedVersion: 1,
      storageConsent: true,
    },
  });
  expect(other.status()).toBe(201);
  const later = HoldingsPreviewSchema.parse(await other.json());
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: later.previewId, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(201);
  expect(await (await confirm()).json()).toEqual(saved);
  expect(
    HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).version,
  ).toBe(2);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    exported.holdings.revisions.find((r) => r.version === 1)?.import,
  ).toEqual(preview.import);
  expect(
    exported.holdings.previews.find((p) => p.id === preview.previewId)?.import,
  ).toEqual(preview.import);
  for (const discarded of [
    supplementalCsv,
    'SYNTHETIC discarded source note',
    'Displayed average',
    '33.33',
  ])
    expect(JSON.stringify(exported.holdings)).not.toContain(discarded);
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: user.password },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
    401,
  );
});
test('E2E-API-721 actual malformed supplemental previews leave saved records and retained previews unchanged @BROKER-DIALECTS-001', async ({
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
  const first = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: { ...supplementalInput(), expectedVersion: 0, storageConsent: true },
  });
  expect(first.status()).toBe(201);
  const preview = HoldingsPreviewSchema.parse(await first.json());
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: preview.previewId, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(201);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).holdings;
  const base = supplementalInput();
  for (const change of [
    { supplement: { ...base.supplement, attested: false } },
    { supplement: { ...base.supplement, origin: 'broker-verified' } },
    { supplement: { ...base.supplement, rows: base.supplement.rows.slice(1) } },
    {
      supplement: {
        ...base.supplement,
        rows: [...base.supplement.rows].reverse(),
      },
    },
    {
      supplement: {
        ...base.supplement,
        rows: base.supplement.rows.map((r) => ({ ...r, totalCost: '33.333' })),
      },
    },
    { csv: base.csv.replace(',3,', ',4,') },
    { declaredTotal: '99.99' },
    { declaredRowCount: 1 },
    { mapping: { ...base.mapping, costColumn: 2 } },
    { mapping: { ...base.mapping, duplicates: 'reject' } },
    { broker: 'Zerodha' },
    { storageConsent: false },
  ]) {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: { ...base, expectedVersion: 1, storageConsent: true, ...change },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).not.toContain(
      'SYNTHETIC discarded source note',
    );
  }
  expect(
    PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    ).holdings,
  ).toEqual(before);
});
test('E2E-API-722 actual supplemental origin stale preview and explicit removal acknowledgement preserve current holdings @BROKER-DIALECTS-001', async ({
  request,
}) => {
  const input = {
    ...supplementalInput(),
    expectedVersion: 0,
    storageConsent: true,
  };
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: account(),
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers: { Origin: 'https://example.com' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  const supplied = async (version: number) => {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: { ...input, expectedVersion: version },
    });
    expect(response.status()).toBe(201);
    return HoldingsPreviewSchema.parse(await response.json());
  };
  const old = await supplied(0);
  const standard = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,100\nINE009A01021,1,200',
      expectedVersion: 0,
      storageConsent: true,
    },
  });
  expect(standard.status()).toBe(201);
  const replacement = HoldingsPreviewSchema.parse(await standard.json());
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: replacement.previewId, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(201);
  const before = HoldingsSnapshotSchema.parse(
    await (await request.get('/api/v1/account/holdings')).json(),
  );
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: old.previewId, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      })
    ).status(),
  ).toBe(409);
  const current = await supplied(1);
  expect(
    current.reconciliation?.changes.find((r) => r.isin === 'INE009A01021')
      ?.status,
  ).toBe('removed');
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: current.previewId, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    ),
  ).toEqual(before);
  const saved = await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: {
      previewId: current.previewId,
      expectedVersion: 1,
      acknowledgeRemovals: true,
    },
  });
  expect(saved.status()).toBe(201);
  expect(HoldingsSnapshotSchema.parse(await saved.json()).import).toEqual(
    current.import,
  );
});
