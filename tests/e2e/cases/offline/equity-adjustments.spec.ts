import { test, expect } from '@playwright/test';
import {
  EquityCompanySchema,
  buildAdjustmentWindow,
  AdjustmentWindowInputSchema,
} from '../../../../packages/contracts/src/index';
import { handleEquityAdjustments } from '../../../../apps/web/src/offline/equity-adjustments';
import { parseNseActionRows } from '../../../../packages/contracts/src/equity-actions';
import { adjustmentInput } from '../../helpers/equity-adjustments';
test('E2E-OFFLINE-1340 bound normalization survives offline snapshot and disappears when source bindings change @EQUITY-COVERAGE-001 @TEST-SIMULATION', async () => {
  const id = '10000000-0000-4000-8000-000000000001',
    hash = 'a'.repeat(64);
  const common = { isin: 'INE002A01018', exchange: 'NSE', sourceRow: 2 };
  const company = EquityCompanySchema.parse({
    isin: common.isin,
    name: 'Synthetic company',
    truncated: false,
    records: [
      {
        ...common,
        kind: 'identity',
        effectiveOn: '2025-01-01',
        symbol: 'SYNTHETIC',
        name: 'Synthetic company',
        series: 'EQ',
        listedOn: '2000-01-01',
        faceValue: '10',
      },
      ...['2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07'].map(
        (effectiveOn, i) => ({
          ...common,
          kind: 'price',
          effectiveOn,
          currency: 'INR',
          close: i < 2 ? '200' : '100',
          volume: '1000',
          adjusted: false,
        }),
      ),
    ].map((observation) => ({
      observation,
      editionId: id,
      hash,
      sourceUrl:
        'https://www.nseindia.com/companies-listing/corporate-filings-actions',
      retrievedAt: '2025-01-31T00:00:00.000Z',
      publishedAt: null,
    })),
  });
  const [header, action] = adjustmentInput()
    .sourceCsv.split('\n')
    .map((line) => line.split(','));
  if (!header || !action) throw Error('Expected synthetic action CSV');
  // A sparse external row retains its column count but has no purpose value.
  delete action[3];
  expect(() =>
    parseNseActionRows(header, [action], '2025-01-07', [
      {
        isin: common.isin,
        symbol: 'SYNTHETIC',
        series: 'EQ',
        effectiveOn: '2025-01-01',
        editionId: id,
        hash,
      },
    ]),
  ).toThrow();
  const window = {
    ...buildAdjustmentWindow(
      AdjustmentWindowInputSchema.parse(adjustmentInput()),
      company,
      'b'.repeat(64),
      '2025-01-31T00:00:00.000Z',
    ),
    reviewedAt: '2025-01-31T00:00:01.000Z',
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const bundle = {
    generatedAt: window.createdAt,
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
    equityCoverage: { capturedAt: window.createdAt, companies: [company] },
    equityAdjustments: {
      [company.isin]: { windows: [window], capturedAt: window.createdAt },
    },
  };
  const request = {
    path: `/api/v1/equity-adjustments/${company.isin}`,
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect(
    (await handleEquityAdjustments(request, state, bundle))?.body,
  ).toMatchObject({
    windows: [
      {
        prices: [
          { normalizedClose: '100' },
          { normalizedClose: '100' },
          { normalizedClose: '100' },
          { normalizedClose: '100' },
        ],
      },
    ],
  });
  expect(
    (
      await handleEquityAdjustments(request, state, {
        ...bundle,
        equityCoverage: {
          ...bundle.equityCoverage,
          companies: [
            {
              ...company,
              records: company.records.map((row) => ({
                ...row,
                hash: 'c'.repeat(64),
              })),
            },
          ],
        },
      })
    )?.body,
  ).toMatchObject({ windows: [] });
  expect(() =>
    handleEquityAdjustments(
      {
        ...request,
        path: '/api/v1/ops/equity-adjustments/prepare',
        method: 'POST',
      },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
