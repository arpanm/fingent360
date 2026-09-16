import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  parseAxisPortfolio,
  AXIS_PORTFOLIO_URL,
  AMFI_NAV_URL,
} from '../../../../packages/contracts/src/index';
import { syntheticAxisWorkbook } from '../../helpers/axis-portfolio';
import { handleSbiPortfolio } from '../../../../apps/web/src/offline/sbi-portfolio';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1720 downloaded mapping only displays with matching admitted NAV identity and denies capture @FUNDS-BONDS-001 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request: OfflineRequest = {
    path: '/api/v1/fund-lookthrough',
    method: 'GET',
    query: new URLSearchParams({ schemeCode: '108001' }),
    headers: new Headers(),
    body: undefined,
  };
  const at = new Date().toISOString(),
    edition = {
      id: randomUUID(),
      hash: 'a'.repeat(64),
      sourceUrl: AXIS_PORTFOLIO_URL,
      retrievedAt: at,
      portfolio: parseAxisPortfolio(
        syntheticAxisWorkbook(),
        AXIS_PORTFOLIO_URL,
      ),
      error: null,
      state: 'published',
      mapping: {
        schemeCode: '108001',
        navEditionId: randomUUID(),
        schemeName: 'Axis NIFTY 50 ETF',
        plan: null,
        option: null,
      },
      reviewedAt: at,
    };
  const snapshot = {
    ...bundle,
    fundPortfolios: { capturedAt: at, editions: [edition] },
    fundsBonds: {
      capturedAt: at,
      funds: [],
      totalSchemeCount: 0,
      truncated: false,
    },
  };
  expect((await handleSbiPortfolio(request, state, snapshot))?.body).toEqual({
    editions: [],
  });
  await expect(
    handleSbiPortfolio(
      {
        ...request,
        path: '/api/v1/ops/fund-lookthrough/fetch',
        method: 'POST',
      },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 503 });
  const nav = {
    observation: {
      schemeCode: '108001',
      name: edition.mapping.schemeName,
      amc: 'Axis Mutual Fund',
      category: 'Synthetic equity',
      plan: null,
      option: null,
      payoutIsin: null,
      reinvestmentIsin: null,
      nav: '12.34',
      observedOn: '2026-08-31',
      sourceRow: 4,
    },
    edition: {
      id: edition.mapping.navEditionId,
      sourceUrl: AMFI_NAV_URL,
      hash: 'b'.repeat(64),
      retrievedAt: at,
      count: 1,
      parser: 'amfi-navall-v2' as const,
    },
  };
  const admitted = {
    ...snapshot,
    fundsBonds: {
      capturedAt: at,
      funds: [nav],
      totalSchemeCount: 1,
      truncated: false,
    },
  };
  expect((await handleSbiPortfolio(request, state, admitted))?.body).toEqual({
    editions: [edition],
  });
  const unbound = {
    ...admitted,
    fundsBonds: {
      ...admitted.fundsBonds,
      funds: [{ ...nav, edition: { ...nav.edition, id: randomUUID() } }],
    },
  };
  expect((await handleSbiPortfolio(request, state, unbound))?.body).toEqual({
    editions: [],
  });
  const retained = {
    ...unbound,
    fundsBonds: {
      ...unbound.fundsBonds,
      history: [nav],
      historyTruncated: false,
    },
  };
  expect((await handleSbiPortfolio(request, state, retained))?.body).toEqual({
    editions: [edition],
  });
  const changed = {
    ...admitted,
    fundsBonds: {
      ...admitted.fundsBonds,
      funds: [
        { ...nav, observation: { ...nav.observation, name: 'Another scheme' } },
      ],
    },
  };
  expect((await handleSbiPortfolio(request, state, changed))?.body).toEqual({
    editions: [],
  });
});
