import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  FundMergerSnapshotSchema,
  fundMergerTerms,
  AMFI_LEGACY_NAV_URL,
} from '../../../../packages/contracts/src/index';
import { handleFundMergers } from '../../../../apps/web/src/offline/fund-mergers';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1900 downloaded merger requires both exact NAV identity editions and never enables conversion @DEV-022 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const at = new Date().toISOString(),
    navId = randomUUID();
  const observation = (code: string, name: string) => ({
    schemeCode: code,
    name,
    amc: 'HDFC Mutual Fund',
    category: 'Synthetic category',
    payoutIsin: null,
    reinvestmentIsin: null,
    nav: '10',
    observedOn: '2022-01-14',
    sourceRow: 1,
  });
  const from = observation(
      '108001',
      'HDFC Long Term Advantage Fund - Direct Growth',
    ),
    to = observation('108002', 'HDFC Large and Mid Cap Fund - Direct Growth');
  const edition = {
    id: navId,
    sourceUrl: AMFI_LEGACY_NAV_URL,
    hash: 'a'.repeat(64),
    retrievedAt: at,
    count: 2,
    parser: 'amfi-navall-v1',
  };
  bundle.fundsBonds = {
    capturedAt: at,
    funds: [from, to].map((observation) => ({ observation, edition })),
    history: [],
    historyTruncated: false,
    totalSchemeCount: 2,
    truncated: false,
  };
  bundle.fundMergers = FundMergerSnapshotSchema.parse({
    capturedAt: at,
    editions: [
      {
        id: randomUUID(),
        hash: 'b'.repeat(64),
        recordedAt: at,
        retrievedAt: null,
        terms: fundMergerTerms('HDFC Long Term Advantage Fund'),
        error: null,
        state: 'published',
        mapping: {
          from: { editionId: navId, observation: from },
          to: { editionId: navId, observation: to },
          planRelationship: 'independently-reviewed-no-conversion-ratio',
        },
        reviewedAt: at,
      },
    ],
  });
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const req = {
    path: '/api/v1/fund-mergers',
    method: 'GET',
    query: new URLSearchParams(),
    headers: new Headers(),
    body: {},
  };
  const result = await handleFundMergers(req, state, bundle);
  expect((result?.body as { editions: unknown[] }).editions).toHaveLength(1);
  bundle.fundsBonds = {
    capturedAt: at,
    funds: [],
    history: [],
    historyTruncated: false,
    totalSchemeCount: 0,
    truncated: false,
  };
  const withdrawn = await handleFundMergers(req, state, bundle);
  expect((withdrawn?.body as { editions: unknown[] }).editions).toEqual([]);
  expect(() =>
    handleFundMergers(
      { ...req, path: '/api/v1/ops/fund-mergers/import', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
  expect(state.data).toEqual({});
});
