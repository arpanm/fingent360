import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const { Pool } = createRequire(
  new URL('../../../../apps/api/package.json', import.meta.url),
)('pg') as {
  Pool: new (options: { connectionString: string }) => {
    query: (sql: string, values: string[]) => Promise<unknown>;
    end: () => Promise<void>;
  };
};
import {
  PrivacyExportSchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  HoldingsTemplateSchema,
  workbookBase64,
  parseHoldingsWorkbook,
  workbookBytes,
} from '../../../../packages/contracts/src/index';
import { brokenWorkbook, syntheticWorkbook } from '../../fixtures/workbooks';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const registration = () => ({
  username: `xlsx_${randomUUID().slice(0, 12)}`,
  password: 'Synthetic-workbook-2026',
  consent: true,
});
test('E2E-API-240 workbook template preview exact confirmation replay ownership and export @XLSX-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: registration(),
      })
    ).status(),
  ).toBe(201);
  const blank = HoldingsTemplateSchema.parse(
    await (await request.get('/api/v1/account/holdings/template')).json(),
  );
  expect(blank.synthetic).toBe(false);
  expect(parseHoldingsWorkbook(workbookBytes(blank.base64)).holdings).toEqual(
    [],
  );
  const encoded = workbookBase64(syntheticWorkbook());
  const response = await request.post('/api/v1/account/holdings/preview', {
    headers,
    data: {
      format: 'xlsx',
      workbookBase64: encoded,
      expectedVersion: 0,
      storageConsent: true,
    },
  });
  expect(response.status()).toBe(201);
  const preview = HoldingsPreviewSchema.parse(await response.json());
  expect(preview.import?.declaredTotalMinor).toBe('10001');
  const pendingExport = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    pendingExport.holdings.previews.find((p) => p.id === preview.previewId)
      ?.import?.declaredTotalMinor,
  ).toBe('10001');
  const stranger = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await stranger.post('/api/v1/account/register', {
      headers,
      data: registration(),
    });
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
  const saved = HoldingsSnapshotSchema.parse(await (await confirm()).json());
  expect(saved.holdings[0]?.quantity).toBe('1.000001');
  expect(saved.import?.parserVersion).toBe('standard-holdings-xlsx-v1');
  expect(await (await confirm()).json()).toEqual(saved);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    exported.holdings.previews.find((p) => p.id === preview.previewId)
      ?.confirmedVersion,
  ).toBe(1);
  expect(JSON.stringify(exported)).not.toContain(encoded);
  expect(JSON.stringify(exported)).toContain('standard-holdings-xlsx-v1');
  expect(
    (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: {
          format: 'xlsx',
          workbookBase64: encoded,
          expectedVersion: 0,
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-241 malformed unsafe unreconciled and styled workbook uploads preserve holdings @XLSX-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: registration(),
  });
  for (const kind of [
    'hidden-row',
    'hidden-column',
    'formula',
    'total',
    'numeric-long',
    'date-style',
    'scientific-style',
    'entity',
    'external',
    'formula-prefix',
    'external-prefix',
    'row-date',
    'row-scientific',
    'column-date',
    'column-scientific',
    'default-date',
    'default-scientific',
  ] as const) {
    const r = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        format: 'xlsx',
        workbookBase64: workbookBase64(brokenWorkbook(kind)),
        expectedVersion: 0,
        storageConsent: true,
      },
    });
    expect(r.status(), kind).toBe(400);
  }
  const current = HoldingsSnapshotSchema.parse(
    await (await request.get('/api/v1/account/holdings')).json(),
  );
  expect(current.version).toBe(0);
  expect(current.holdings).toEqual([]);
});

test('E2E-API-242 privacy export supports legacy array and new CSV preview receipts before and after confirmation @XLSX-001', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: registration(),
  });
  const csv = 'isin,quantity,total_cost_paise\nINE002A01018,1,10001';
  const make = async () =>
    HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv, expectedVersion: 0, storageConsent: true },
        })
      ).json(),
    );
  const legacy = await make();
  const current = await make();
  const pool = new Pool({ connectionString: feedbackSandbox.databaseUrl });
  try {
    await pool.query(
      'UPDATE app_holdings_previews SET payload=$2::jsonb WHERE id=$1',
      [legacy.previewId, JSON.stringify(legacy.holdings)],
    );
  } finally {
    await pool.end();
  }
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    before.holdings.previews.find((p) => p.id === legacy.previewId)?.holdings,
  ).toEqual(legacy.holdings);
  expect(
    before.holdings.previews.find((p) => p.id === legacy.previewId)?.import,
  ).toBeUndefined();
  expect(
    before.holdings.previews.find((p) => p.id === current.previewId)?.import
      ?.parserVersion,
  ).toBe('standard-holdings-csv-v1');
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: { previewId: legacy.previewId, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(201);
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    after.holdings.previews.find((p) => p.id === legacy.previewId)
      ?.confirmedVersion,
  ).toBe(1);
  expect(
    after.holdings.previews.find((p) => p.id === current.previewId)?.holdings,
  ).toEqual(current.holdings);
});
