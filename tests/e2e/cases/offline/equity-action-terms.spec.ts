import { test, expect } from '@playwright/test';
import {
  EquityCompanySchema,
  ActionTermsInputSchema,
  buildActionTerms,
} from '../../../../packages/contracts/src/index';
import { handleEquityActionTerms } from '../../../../apps/web/src/offline/equity-action-terms';
import { actionTermsInput } from '../../helpers/equity-action-terms';
test('E2E-OFFLINE-1930 downloaded rights comparison requires admitted identity action and price editions @SRC-003 @TEST-SIMULATION', async () => {
  const input = ActionTermsInputSchema.parse(actionTermsInput()),
    hash = 'a'.repeat(64),
    at = '2026-09-15T00:00:00.000Z',
    t = input.terms;
  const company = EquityCompanySchema.parse({
    isin: t.oldIsin,
    name: 'Synthetic company',
    truncated: false,
    records: [
      {
        isin: t.oldIsin,
        kind: 'identity',
        exchange: 'NSE',
        effectiveOn: t.priceOn,
        sourceRow: 2,
        symbol: 'MAXIND',
        name: 'Synthetic company',
        series: 'EQ',
        listedOn: '2000-01-01',
        faceValue: '10',
      },
      {
        isin: t.oldIsin,
        kind: 'price',
        exchange: 'NSE',
        effectiveOn: t.priceOn,
        sourceRow: 3,
        currency: 'INR',
        close: '200',
        volume: '1000',
        adjusted: false,
      },
      {
        isin: t.oldIsin,
        kind: 'corporate-action',
        effectiveOn: t.exOn,
        sourceRow: 4,
        purpose: 'Rights 19:100',
        recordOn: t.recordOn,
        adjustment: 'not-applied',
        nseAction: {
          symbol: 'MAXIND',
          name: 'Synthetic company',
          series: 'EQ',
          faceValue: '10',
          exOn: t.exOn,
          bookClosureStart: null,
          bookClosureEnd: null,
          identityEditionId: input.requestId,
          identityHash: hash,
        },
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
  const receipt = buildActionTerms(input, company, company, hash, hash, at),
    state = {
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
      equityCoverage: { capturedAt: at, companies: [company] },
      equityActionTerms: {
        [t.oldIsin]: {
          actions: [{ ...receipt, reviewedAt: at }],
          capturedAt: at,
        },
      },
    },
    request = {
      path: `/api/v1/equity-action-terms/${t.oldIsin}`,
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect(
    (await handleEquityActionTerms(request, state, bundle))?.body,
  ).toMatchObject({
    actions: [
      {
        comparison: {
          numerator: '22850',
          denominator: '119',
          display: '192.016806722689',
        },
        calibrationEligibility:
          'ineligible-conditional-complex-action-comparison',
      },
    ],
  });
  expect(
    (
      await handleEquityActionTerms(request, state, {
        ...bundle,
        equityCoverage: { capturedAt: at, companies: [] },
      })
    )?.body,
  ).toMatchObject({ actions: [] });
  await expect(
    Promise.resolve().then(() =>
      handleEquityActionTerms(request, state, {
        ...bundle,
        equityActionTerms: {
          [t.oldIsin]: {
            actions: [
              {
                ...receipt,
                reviewedAt: at,
                comparison: { ...receipt.comparison, display: '999' },
              },
            ],
            capturedAt: at,
          },
        },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handleEquityActionTerms(
        {
          ...request,
          path: '/api/v1/ops/equity-action-terms/prepare',
          method: 'POST',
        },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
});
