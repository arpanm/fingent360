import { test, expect } from '@playwright/test';
import { lifeInsuranceInput } from '../../helpers/equity-life-insurance';
import {
  parseEquitySource,
  NSE_LI_PARSER,
  EquityObservationSchema,
  EquitySnapshotSchema,
} from '../../../../packages/contracts/src/index';
import { handleEquityCoverage } from '../../../../apps/web/src/offline/equity-coverage';
test('E2E-OFFLINE-1840 life-insurance account proof survives package and rejects substituted surplus or inter-account transfer @SRC-004 @TEST-SIMULATION', async () => {
  const input = await lifeInsuranceInput(),
    observations = parseEquitySource(
      NSE_LI_PARSER,
      input.body,
      input.effectiveOn,
    ).observations;
  const row = observations[0]!;
  if (row.kind !== 'fundamental' || !row.lifeInsuranceContext)
    throw Error('Expected LI proof.');
  expect(
    EquityObservationSchema.parse(JSON.parse(JSON.stringify(row))),
  ).toEqual(row);
  expect(
    EquityObservationSchema.safeParse({ ...row, value: '61119.00' }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({
      ...row,
      lifeInsuranceContext: {
        ...row.lifeInsuranceContext,
        amounts: {
          ...row.lifeInsuranceContext.amounts,
          'life-policy-transfer-to-shareholders': '1',
        },
      },
    }).success,
  ).toBe(false);
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2026-07-16T00:00:00.000Z',
    companies: [
      {
        isin: 'INE795G01014',
        name: 'Reconstructed LI source',
        truncated: false,
        records: observations.map((observation) => ({
          observation,
          editionId: input.requestId,
          sourceUrl: input.sourceUrl,
          hash: 'a'.repeat(64),
          retrievedAt: '2026-07-16T00:00:00.000Z',
          publishedAt: null,
        })),
      },
    ],
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
    equityCoverage: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/equities/INE795G01014',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleEquityCoverage(request, state, bundle))?.body).toEqual(
    snapshot.companies[0],
  );
  expect(() =>
    handleEquityCoverage(
      { ...request, path: '/api/v1/ops/equities/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
