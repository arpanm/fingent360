import { test, expect } from '@playwright/test';
import { historyInput } from '../../helpers/amfi-history';
import {
  FundsSnapshotSchema,
  parseAmfiNav,
  AMFI_HISTORY_CATALOG,
} from '../../../../packages/contracts/src/index';
import { handleFundsBonds } from '../../../../apps/web/src/offline/funds-bonds';
test('E2E-OFFLINE-1540 dated NAV history survives downloaded bundle with explicit truncated and legacy fallback @SRC-015 @TEST-SIMULATION', async () => {
  const data = historyInput(),
    observations = parseAmfiNav(data.body, data.sourceUrl);
  const edition = {
    id: data.requestId,
    sourceUrl: data.sourceUrl,
    hash: 'a'.repeat(64),
    retrievedAt: '2026-09-15T00:00:00.000Z',
    count: 3,
    parser: 'amfi-history-v1',
    historyCatalog: {
      version: AMFI_HISTORY_CATALOG.version,
      observedOn: AMFI_HISTORY_CATALOG.observedOn,
      sourceUrl: AMFI_HISTORY_CATALOG.sourceUrl,
      sourceHash: AMFI_HISTORY_CATALOG.sourceHash,
    },
  };
  const history = observations
    .reverse()
    .map((observation) => ({ observation, edition }));
  const snapshot = FundsSnapshotSchema.parse({
    capturedAt: edition.retrievedAt,
    funds: history.slice(0, 1),
    history,
    historyTruncated: false,
    totalSchemeCount: 1,
    truncated: false,
  });
  expect(
    FundsSnapshotSchema.safeParse({
      ...snapshot,
      history: [...snapshot.history!, snapshot.history![0]!],
    }).success,
  ).toBe(false);
  expect(
    FundsSnapshotSchema.safeParse({
      ...snapshot,
      history: snapshot.history!.map((row) => ({
        ...row,
        observation: { ...row.observation, observedOn: '2026-09-08' },
      })),
    }).success,
  ).toBe(false);
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
    fundsBonds: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/funds/900001',
    method: 'GET' as const,
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleFundsBonds(request, state, bundle))?.body).toMatchObject({
    history,
    truncated: false,
    reconciliation: { distinctDates: 3 },
  });
  const legacy = {
    ...bundle,
    fundsBonds: { ...snapshot, history: undefined, historyTruncated: true },
  };
  expect((await handleFundsBonds(request, state, legacy))?.body).toMatchObject({
    truncated: true,
    reconciliation: { distinctDates: 1 },
  });
  expect(
    (
      await handleFundsBonds(request, state, {
        ...bundle,
        fundsBonds: { ...snapshot, historyTruncated: true },
      })
    )?.body,
  ).toMatchObject({ truncated: true });
});
