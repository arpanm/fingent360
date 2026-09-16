import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  loadCompanyCohort,
  companyCohortInput,
} from '../../helpers/equity-company-cohort';
import {
  EquitySnapshotSchema,
  parseEquitySource,
} from '../../../../packages/contracts/src/index';
import { handleEquityCoverage } from '../../../../apps/web/src/offline/equity-coverage';
test('E2E-OFFLINE-1890 installed twenty five company cohort preserves dated identities losses and scale without network @SRC-005 @TEST-SIMULATION', async () => {
  const companies = [];
  for (const company of await loadCompanyCohort()) {
    const input = await companyCohortInput(company);
    companies.push({
      isin: company.isin,
      name: company.symbol,
      truncated: false,
      records: parseEquitySource(
        input.parser,
        input.body,
        input.effectiveOn,
      ).observations.map((observation) => ({
        observation,
        editionId: randomUUID(),
        hash: 'a'.repeat(64),
        sourceUrl: company.sourceUrl,
        retrievedAt: '2026-09-15T12:00:00.000Z',
        publishedAt: null,
      })),
    });
  }
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2026-09-15T12:00:00.000Z',
    companies,
  });
  const bundle = {
    generatedAt: snapshot.capturedAt,
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
    equityCoverage: JSON.parse(JSON.stringify(snapshot)),
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/equities/INE412U01025',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  const result = await handleEquityCoverage(request, state, bundle);
  expect(result?.body).toEqual(
    snapshot.companies.find((c) => c.isin === 'INE412U01025'),
  );
  expect(
    snapshot.companies
      .find((c) => c.isin === 'INE412U01025')!
      .records.map((r) => r.observation),
  ).toContainEqual(
    expect.objectContaining({
      metric: 'profit-after-tax',
      value: '-496.16',
      scale: 'lakhs',
    }),
  );
  expect(() =>
    handleEquityCoverage(
      { ...request, path: '/api/v1/ops/equities/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
