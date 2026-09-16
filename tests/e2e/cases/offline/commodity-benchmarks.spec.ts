import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { commodityFixtureUrl } from '../../helpers/commodity-benchmarks';
import {
  CommodityReceiptSchema,
  parseCommodityWorkbook,
} from '../../../../packages/contracts/src/commodity-benchmarks';
import {
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_TERMS,
  OIL_BENCHMARK_LICENSE,
} from '../../../../packages/contracts/src/oil-benchmarks';
import { handleCommodityBenchmarks } from '../../../../apps/web/src/offline/commodity-benchmarks';
test('E2E-OFFLINE-1710 installed selected-cell reconstruction preserves exact units monthly values and unavailable originals @SRC-009 @TEST-SIMULATION', async () => {
  const bytes = await readFile(commodityFixtureUrl),
    parsed = parseCommodityWorkbook(bytes),
    now = '2026-09-15T00:00:00.000Z',
    id = 'a4b70339-963f-41e7-9c59-c40b69ed1191';
  const receipt = CommodityReceiptSchema.parse({
    id,
    sourceUrl: OIL_BENCHMARK_URL,
    termsUrl: OIL_BENCHMARK_TERMS,
    license: OIL_BENCHMARK_LICENSE,
    attribution:
      'World Bank: Commodity Prices — History and Projections (Pink Sheet); original data providers identified in the retained workbook.',
    parser: 'world-bank-pink-sheet-metals-v1',
    bodyHash: createHash('sha256').update(bytes).digest('hex'),
    retainedAt: now,
    retrievedAt: null,
    acquisition: 'operator-upload',
    reportedUpdatedOn: parsed.reportedUpdatedOn,
    frequency: 'monthly',
    vintageBasis: 'retained-revision-only',
    observations: parsed.observations,
  });
  const state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: now,
      feed: [],
      histories: {},
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
      commodityBenchmarks: { receipt, reviewedAt: now, editions: [id] },
    },
    request = {
      path: '/api/v1/commodity-benchmarks',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  const response = await handleCommodityBenchmarks(request, state, bundle);
  expect(response?.body).toEqual(bundle.commodityBenchmarks);
  await expect(
    Promise.resolve().then(() =>
      handleCommodityBenchmarks(
        { ...request, path: request.path + '/' + id + '/evidence' },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handleCommodityBenchmarks(request, state, {
        ...bundle,
        commodityBenchmarks: undefined,
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handleCommodityBenchmarks(request, state, {
        ...bundle,
        commodityBenchmarks: {
          ...bundle.commodityBenchmarks,
          receipt: { ...receipt, frequency: 'daily' },
        },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
});
