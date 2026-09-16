import { test, expect } from '@playwright/test';
import { EquityCompanySchema } from '../../../../packages/contracts/src/equity-coverage';
import {
  ConsolidationInputSchema,
  buildConsolidation,
} from '../../../../packages/contracts/src/equity-consolidation';
import { handleEquityConsolidations } from '../../../../apps/web/src/offline/equity-consolidation';
import { consolidationInput } from '../../helpers/equity-consolidation';
test('E2E-OFFLINE-1780 consolidation snapshot requires both immutable source histories and refuses draft or Operations mutation @SRC-003 @TEST-SIMULATION', async () => {
  const input = ConsolidationInputSchema.parse(consolidationInput()),
    hash = 'a'.repeat(64),
    at = '2025-07-12T00:00:00.000Z';
  function company(isin: string, face: string, date: string, close: string) {
    return EquityCompanySchema.parse({
      isin,
      name: 'Synthetic company',
      truncated: false,
      records: [
        {
          isin,
          kind: 'identity',
          exchange: 'NSE',
          effectiveOn: date,
          sourceRow: 2,
          symbol: 'VERTOZ',
          name: 'Synthetic company',
          series: 'EQ',
          listedOn: '2000-01-01',
          faceValue: face,
        },
        {
          isin,
          kind: 'price',
          exchange: 'NSE',
          effectiveOn: date,
          sourceRow: 3,
          currency: 'INR',
          close,
          volume: '1000',
          adjusted: false,
        },
      ].map((observation) => ({
        observation,
        editionId: input.requestId,
        hash,
        sourceUrl: 'https://www.nseindia.com/',
        retrievedAt: at,
        publishedAt: null,
      })),
    });
  }
  const old = company(input.oldIsin, '1', input.lastOldTradeOn, '12.345'),
    next = company(input.newIsin, '10', input.resumedOn, '125'),
    receipt = buildConsolidation(
      input,
      old,
      next,
      hash,
      input.documents.map((d) => ({
        role: d.role,
        url: d.url,
        publishedOn: d.publishedOn,
        page: d.page,
        transcription: d.transcription,
        hash,
      })),
      at,
    );
  const state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
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
      equityCoverage: { capturedAt: at, companies: [old, next] },
      equityConsolidations: {
        [input.newIsin]: {
          bridges: [{ ...receipt, reviewedAt: at }],
          capturedAt: at,
        },
      },
    },
    request = {
      path: `/api/v1/equity-consolidations/${input.newIsin}`,
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect(
    (await handleEquityConsolidations(request, state, bundle))?.body,
  ).toMatchObject({
    bridges: [
      {
        oldCloseInNewShareUnits: '123.45',
        calibrationEligibility: 'ineligible-suspended-trading-transition',
      },
    ],
  });
  expect(
    (
      await handleEquityConsolidations(request, state, {
        ...bundle,
        equityCoverage: { capturedAt: at, companies: [next] },
      })
    )?.body,
  ).toMatchObject({ bridges: [] });
  await expect(
    Promise.resolve().then(() =>
      handleEquityConsolidations(request, state, {
        ...bundle,
        equityConsolidations: {
          [input.newIsin]: { bridges: [receipt], capturedAt: at },
        },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handleEquityConsolidations(
        {
          ...request,
          path: '/api/v1/ops/equity-consolidations/prepare',
          method: 'POST',
        },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
});
