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
import { handleFilingWatch } from '../../../../apps/web/src/offline/filing-watch';
test('E2E-OFFLINE-1990 admitted watched fundamentals retain source time while capture and schedule permission need connection @SRC-004 @TEST-SIMULATION', async () => {
  const source = (await loadCompanyCohort())[0]!,
    input = await companyCohortInput(source),
    at = '2026-09-15T12:00:00.000Z',
    editionId = randomUUID();
  const company = {
    isin: source.isin,
    name: source.symbol,
    truncated: false,
    records: parseEquitySource(
      input.parser,
      input.body,
      input.effectiveOn,
    ).observations.map((observation) => ({
      observation,
      editionId,
      hash: 'a'.repeat(64),
      sourceUrl: source.sourceUrl,
      retrievedAt: at,
      publishedAt: null,
    })),
  };
  const snapshot = EquitySnapshotSchema.parse({
      capturedAt: at,
      companies: [company],
    }),
    bundle = {
      generatedAt: at,
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
      equityCoverage: snapshot,
    },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    request = {
      path: '/api/v1/equities/' + source.isin,
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect((await handleEquityCoverage(request, state, bundle))?.body).toEqual(
    company,
  );
  for (const path of [
    '/api/v1/ops/filing-watch',
    '/api/v1/ops/filing-watch/gate',
  ])
    expect(() =>
      handleFilingWatch({ ...request, path, method: 'POST' }, state, bundle),
    ).toThrow('connected Operations');
  // A new server bundle after withdrawal contains no admitted company. Existing downloaded evidence remains a dated snapshot.
  expect(() =>
    handleEquityCoverage(request, state, {
      ...bundle,
      equityCoverage: { ...snapshot, companies: [] },
    }),
  ).toThrow();
});
