import { test, expect } from '@playwright/test';
import {
  EquityPriceRangeSchema,
  buildEquityPriceHistory,
  EquityCompanySchema,
} from '../../../../packages/contracts/src/index';
import { handleEquityCoverage } from '../../../../apps/web/src/offline/equity-coverage';
test('E2E-OFFLINE-1800 retained device history rejects truncation and preserves pagination and exact same-exchange disagreement @SRC-002 @TEST-SIMULATION', async () => {
  const company = EquityCompanySchema.parse({
    isin: 'INE002A01018',
    name: 'Synthetic price fixture',
    truncated: false,
    records: ['100.0', '100.00', '101.00'].map((close, index) => ({
      observation: {
        kind: 'price',
        isin: 'INE002A01018',
        effectiveOn: '2025-01-01',
        sourceRow: index + 1,
        exchange: 'NSE',
        currency: 'INR',
        close,
        volume: '1000',
        adjusted: false,
      },
      editionId: `10000000-0000-4000-8000-00000000000${index + 1}`,
      sourceUrl: 'https://www.nseindia.com/',
      hash: 'a'.repeat(64),
      retrievedAt: '2025-01-02T00:00:00.000Z',
      publishedAt: null,
    })),
  });
  const range = EquityPriceRangeSchema.parse({
    from: '2025-01-01',
    to: '2025-01-02',
  });
  expect(
    buildEquityPriceHistory(
      company.isin,
      company.records.slice(0, 2),
      range,
      '2025-01-02T00:00:00.000Z',
    ).days[0]?.status,
  ).toBe('retained');
  expect(
    buildEquityPriceHistory(
      company.isin,
      company.records,
      range,
      '2025-01-02T00:00:00.000Z',
    ).days[0]?.status,
  ).toBe('conflicting-revisions');
  const bundle = {
    generatedAt: '2025-01-02T00:00:00.000Z',
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
    equityCoverage: {
      capturedAt: '2025-01-02T00:00:00.000Z',
      companies: [company],
    },
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/equities/INE002A01018/prices',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams({ from: range.from, to: range.to }),
  };
  expect(
    (await handleEquityCoverage(request, state, bundle))?.body,
  ).toMatchObject({
    days: [{ status: 'conflicting-revisions' }],
    datesWithoutCapture: ['2025-01-02'],
  });
  expect(() =>
    handleEquityCoverage(request, state, {
      ...bundle,
      equityCoverage: {
        ...bundle.equityCoverage,
        companies: [{ ...company, truncated: true }],
      },
    }),
  ).toThrow('incomplete');
});
