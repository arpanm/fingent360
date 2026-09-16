import { test, expect } from '@playwright/test';
import { bankingInput } from '../../helpers/equity-banking';
import {
  EquityObservationSchema,
  parseEquitySource,
  NSE_BANKING_PARSER,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1730 bank proof preserves percent ratios separately and rejects altered amounts in snapshot @SRC-004 @TEST-SIMULATION', async () => {
  const input = await bankingInput(),
    rows = parseEquitySource(
      NSE_BANKING_PARSER,
      input.body,
      input.effectiveOn,
    ).observations;
  const row = rows[0]!;
  if (row.kind !== 'fundamental' || !row.bankContext)
    throw Error('Expected banking proof.');
  expect(
    EquityObservationSchema.parse(JSON.parse(JSON.stringify(row))),
  ).toEqual(row);
  expect(row.bankContext.ratios.unit).toBe('percent');
  expect(
    EquityObservationSchema.safeParse({ ...row, value: '999' }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({
      ...row,
      bankContext: {
        ...row.bankContext,
        ratios: { ...row.bankContext.ratios, unit: 'INR' },
      },
    }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({
      ...row,
      bankContext: {
        ...row.bankContext,
        amounts: { ...row.bankContext.amounts, 'bank-operating-profit': '999' },
      },
    }).success,
  ).toBe(false);
});
test('E2E-OFFLINE-1731 banking company reader uses retained snapshot and denies offline source writes @SRC-004 @TEST-SIMULATION', async () => {
  const { handleEquityCoverage } =
    await import('../../../../apps/web/src/offline/equity-coverage');
  const { EquitySnapshotSchema } =
    await import('../../../../packages/contracts/src/index');
  const input = await bankingInput(),
    observations = parseEquitySource(
      NSE_BANKING_PARSER,
      input.body,
      input.effectiveOn,
    ).observations;
  const snapshot = EquitySnapshotSchema.parse({
    capturedAt: '2026-04-29T00:00:00.000Z',
    companies: [
      {
        isin: 'INE545U01014',
        name: 'Synthetic bank',
        truncated: false,
        records: observations.map((observation) => ({
          observation,
          editionId: input.requestId,
          sourceUrl: input.sourceUrl,
          hash: 'a'.repeat(64),
          retrievedAt: '2026-04-29T00:00:00.000Z',
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
    path: '/api/v1/equities/INE545U01014',
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
  ).toThrow('require connected Operations');
});
