import { test, expect } from '@playwright/test';
import { insuranceInput } from '../../helpers/equity-insurance';
import {
  parseEquitySource,
  NSE_GI_PARSER,
  EquityObservationSchema,
  EquitySnapshotSchema,
} from '../../../../packages/contracts/src/index';
import { handleEquityCoverage } from '../../../../apps/web/src/offline/equity-coverage';
test('E2E-OFFLINE-1820 GI proof and company snapshot preserve operating scopes and reject tampered premium or ratio signs @SRC-004 @TEST-SIMULATION', async () => {
  const input = await insuranceInput(),
    observations = parseEquitySource(
      NSE_GI_PARSER,
      input.body,
      input.effectiveOn,
    ).observations;
  const row = observations[0]!;
  if (row.kind !== 'fundamental' || !row.insuranceContext)
    throw Error('Expected insurance proof.');
  expect(
    EquityObservationSchema.parse(JSON.parse(JSON.stringify(row))),
  ).toEqual(row);
  expect(
    EquityObservationSchema.safeParse({ ...row, value: '1' }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({
      ...row,
      insuranceContext: {
        ...row.insuranceContext,
        ratios: { ...row.insuranceContext.ratios, solvencyTimes: '-2' },
      },
    }).success,
  ).toBe(false);
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2026-07-16T00:00:00.000Z',
    companies: [
      {
        isin: 'INE765G01017',
        name: 'Reconstructed insurance fixture',
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
    path: '/api/v1/equities/INE765G01017',
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
