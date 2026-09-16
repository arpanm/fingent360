import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { factsheetInput } from '../../helpers/fund-factsheet';
import {
  parseKotakFactsheet,
  FACTSHEET_PARSER,
  AMFI_NAV_URL,
  FundsSnapshotSchema,
  FactsheetSnapshotSchema,
} from '../../../../packages/contracts/src/index';
import { handleFundFactsheet } from '../../../../apps/web/src/offline/fund-factsheet';
test('E2E-OFFLINE-1910 factsheet explicit plan fees require installed original and current identity records @SRC-016 @TEST-SIMULATION', async () => {
  const input = factsheetInput(),
    navId = randomUUID(),
    at = '2026-09-15T12:00:00.000Z';
  const funds = ['Direct', 'Regular'].map((plan, i) => ({
    observation: {
      schemeCode: String(908001 + i),
      name: 'Kotak Multi Asset Omni FOF',
      amc: 'Kotak Mahindra Mutual Fund',
      category: 'Open Ended Schemes ( Other Scheme - FoF Domestic )',
      plan: plan + ' Plan',
      option: 'Growth',
      payoutIsin: null,
      reinvestmentIsin: null,
      nav: '10.0000',
      observedOn: '2026-08-31',
      sourceRow: i + 1,
    },
    edition: {
      id: navId,
      sourceUrl: AMFI_NAV_URL,
      hash: 'b'.repeat(64),
      retrievedAt: at,
      count: 2,
      parser: 'amfi-navall-v2',
    },
  }));
  const snapshot = FactsheetSnapshotSchema.parse({
    capturedAt: at,
    editions: [
      {
        id: input.requestId,
        parser: FACTSHEET_PARSER,
        hash: 'a'.repeat(64),
        sourceUrl: input.sourceUrl,
        retrievedAt: at,
        values: parseKotakFactsheet(input.body, input.sourceUrl),
        error: null,
        state: 'published',
        reviewedAt: at,
        mappings: funds.map((f, i) => ({
          plan: i ? 'Regular' : 'Direct',
          schemeCode: f.observation.schemeCode,
          navEditionId: navId,
          identity: f.observation,
        })),
      },
    ],
  });
  const nav = FundsSnapshotSchema.parse({
    capturedAt: at,
    funds,
    totalSchemeCount: 2,
    truncated: false,
    history: funds,
    historyTruncated: false,
  });
  const bundle = {
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
      fundsBonds: nav,
      fundFactsheets: snapshot,
    },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    };
  const request = {
    path: '/api/v1/fund-factsheets',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams('schemeCode=908001'),
  };
  expect((await handleFundFactsheet(request, state, bundle))?.body).toEqual({
    editions: snapshot.editions,
    nextCursor: null,
  });
  expect(
    (
      await handleFundFactsheet(request, state, {
        ...bundle,
        fundsBonds: { ...nav, funds: [], history: [], totalSchemeCount: 0 },
      })
    )?.body,
  ).toEqual({ editions: [], nextCursor: null });
  const changed = {
    ...nav,
    funds: nav.funds.map((f, i) =>
      i
        ? f
        : {
            ...f,
            observation: { ...f.observation, payoutIsin: 'INF000000003' },
          },
    ),
  };
  expect(
    (
      await handleFundFactsheet(request, state, {
        ...bundle,
        fundsBonds: changed,
      })
    )?.body,
  ).toEqual({ editions: [], nextCursor: null });
  expect(
    FactsheetSnapshotSchema.safeParse({
      ...snapshot,
      nextCursor: at + '|' + input.requestId,
    }).success,
  ).toBe(false);
  expect(() =>
    handleFundFactsheet(
      {
        ...request,
        path: '/api/v1/ops/fund-factsheets/import',
        method: 'POST',
      },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
