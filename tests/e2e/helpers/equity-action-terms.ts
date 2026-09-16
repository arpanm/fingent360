import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { test as base, expect, type FeedbackSandbox } from './feedback-fixture';
import { indiaActors } from './india-macro';
import { equityInput, actionInput } from './equity-coverage';
import { retentionHeaders } from './retention';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:equities|equity-action-terms)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await use(context);
  },
});
export const actionTermsPdf = Buffer.from(
  '%PDF-1.4\n% TEST-SIMULATION source stand-in; no actual issuer document\n%%EOF',
);
export function actionTermsInput(
  kind: 'rights' | 'stock-swap-merger' = 'rights',
) {
  return {
    requestId: randomUUID(),
    terms:
      kind === 'rights'
        ? {
            kind,
            oldIsin: 'INE0CG601016',
            newIsin: 'INE0CG601016',
            oldUnits: '100',
            newUnits: '19',
            subscriptionPrice: '150',
            fixedCashPerOldShare: '0',
            exOn: '2025-04-29',
            recordOn: '2025-04-29',
            effectiveOn: '2025-04-29',
            priceOn: '2025-04-28',
            opensOn: '2025-05-07',
            closesOn: '2025-05-22',
            renunciationEndsOn: '2025-05-16',
            fractionTreatment:
              'Synthetic review transcription: no owner fractional allotment is presumed.',
          }
        : {
            kind,
            oldIsin: 'INE001A01036',
            newIsin: 'INE040A01034',
            oldUnits: '25',
            newUnits: '42',
            subscriptionPrice: '0',
            fixedCashPerOldShare: '0',
            exOn: '2023-07-13',
            recordOn: '2023-07-13',
            effectiveOn: '2023-07-01',
            priceOn: '2023-06-30',
            opensOn: null,
            closesOn: null,
            renunciationEndsOn: null,
            fractionTreatment:
              'Trustee pooled fractional shares and distributed net sale proceeds; no investor amount inferred.',
          },
    original: {
      url:
        kind === 'rights'
          ? 'https://nsearchives.nseindia.com/corporates/offerdocument/rights/MAXIND_LOF_25042025.pdf'
          : 'https://nsearchives.nseindia.com/corporate/HDFCBANK_19102023184408_Intimation_Fractional_Entitlement.pdf',
      publishedOn: kind === 'rights' ? '2025-04-25' : '2023-10-19',
      mediaType: 'application/pdf',
      bytesBase64: actionTermsPdf.toString('base64'),
      section: 'TEST-SIMULATION source terms transcription',
      transcription:
        kind === 'rights'
          ? 'Historical fact fixture: 19 fully paid shares offered for every 100 existing at INR150; original file is synthetic.'
          : 'Historical fact fixture: 42 fully paid HDFC Bank shares for 25 HDFC shares; fractional treatment separately retained. Original file is synthetic.',
    },
    rightsEvidence:
      'TEST-SIMULATION source stand-in only; no production licence asserted.',
    rightsConfirmed: true,
    completeTermsConfirmed: true,
  };
}
export const actionTermsReview = (id: string, decision = 'publish') => ({
  requestId: randomUUID(),
  id,
  decision,
  reason:
    'Independent synthetic original terms and source identities reviewed.',
  originalsAndTermsConfirmed: true,
});
export async function actionTermsActors(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
  kind: 'rights' | 'stock-swap-merger' = 'rights',
) {
  const reviewer = await indiaActors(request, playwright, sandbox),
    data = actionTermsInput(kind),
    ids: string[] = [];
  for (const [isin, symbol, face, close] of kind === 'rights'
    ? [['INE0CG601016', 'MAXIND', '10', '200']]
    : [
        ['INE001A01036', 'HDFC', '2', '2800'],
        ['INE040A01034', 'HDFCBANK', '1', '1700'],
      ]) {
    const input = await equityInput();
    input.effectiveOn = data.terms.priceOn;
    input.body = JSON.stringify({
      format: 'f360-equity-evidence-v1',
      observations: [
        {
          isin,
          kind: 'identity',
          exchange: 'NSE',
          effectiveOn: data.terms.priceOn,
          sourceRow: 2,
          symbol,
          name: 'Synthetic action company',
          series: 'EQ',
          listedOn: '2000-01-01',
          faceValue: face,
        },
        {
          isin,
          kind: 'price',
          exchange: 'NSE',
          effectiveOn: data.terms.priceOn,
          sourceRow: 3,
          currency: 'INR',
          close,
          volume: '1000',
          adjusted: false,
        },
      ],
    });
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: input.requestId,
            decision: 'publish',
            reason:
              'Synthetic actual-store identity and price independently reviewed.',
          },
        })
      ).status(),
    ).toBe(201);
    ids.push(input.requestId);
  }
  const action = await actionInput();
  action.effectiveOn = data.terms.exOn;
  action.body =
    'SYMBOL,COMPANY NAME,SERIES,PURPOSE,FACE VALUE,EX-DATE,RECORD DATE,BOOK CLOSURE START DATE,BOOK CLOSURE END DATE\n' +
    (kind === 'rights'
      ? 'MAXIND,Synthetic company,EQ,Rights 19:100 at Rs 150,10,29-Apr-2025,29-Apr-2025,-,-\n'
      : 'HDFC,Synthetic company,EQ,Merger,2,13-Jul-2023,13-Jul-2023,-,-\n');
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: action,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await reviewer.post('/api/v1/ops/equities/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: action.requestId,
          decision: 'publish',
          reason: 'Synthetic original action row independently reviewed.',
        },
      })
    ).status(),
  ).toBe(201);
  ids.push(action.requestId);
  return { reviewer, ids, data };
}
