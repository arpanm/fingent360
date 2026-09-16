import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { test as base, expect, type FeedbackSandbox } from './feedback-fixture';
import { indiaActors } from './india-macro';
import { retentionHeaders } from './retention';
import { equityInput } from './equity-coverage';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:equities|equity-adjustments)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
        });
      },
    );
    await use(context);
  },
});
export const adjustmentSource =
  'SYMBOL,COMPANY NAME,SERIES,PURPOSE,FACE VALUE,EX-DATE,RECORD DATE,BOOK CLOSURE START DATE,BOOK CLOSURE END DATE\nSYNTHETIC,Synthetic coverage company,EQ,Bonus 1:1,10,06-Jan-2025,06-Jan-2025,-,-';
export function adjustmentInput() {
  return {
    requestId: randomUUID(),
    isin: 'INE002A01018',
    windowStart: '2025-01-02',
    windowEnd: '2025-01-07',
    sourceUrl:
      'https://www.nseindia.com/companies-listing/corporate-filings-actions',
    sourceCsv: adjustmentSource,
    coverageEvidence:
      'TEST-SIMULATION: all synthetic source rows and traded closes checked for the whole company window.',
    completeWindowConfirmed: true,
    rightsEvidence:
      'TEST-SIMULATION: synthetic fixture only, no actual rights claimed.',
    rightsConfirmed: true,
  };
}
export async function adjustmentActors(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const reviewer = await indiaActors(request, playwright, sandbox);
  const input = await equityInput();
  const common = { isin: 'INE002A01018', exchange: 'NSE' };
  input.body = JSON.stringify({
    format: 'f360-equity-evidence-v1',
    observations: [
      {
        ...common,
        kind: 'identity',
        effectiveOn: '2025-01-01',
        sourceRow: 2,
        symbol: 'SYNTHETIC',
        name: 'Synthetic coverage company',
        series: 'EQ',
        listedOn: '2000-01-01',
        faceValue: '10',
      },
      ...['2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07'].map(
        (effectiveOn, i) => ({
          ...common,
          kind: 'price',
          effectiveOn,
          sourceRow: i + 3,
          currency: 'INR',
          close: i < 2 ? '200' : '100',
          volume: '1000',
          adjusted: false,
        }),
      ),
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
          reason: 'Synthetic source independently checked.',
        },
      })
    ).status(),
  ).toBe(201);
  return { reviewer, equityId: input.requestId };
}
export function adjustmentReview(id: string, decision = 'publish') {
  return {
    requestId: randomUUID(),
    id,
    decision,
    reason: 'Synthetic complete source window independently reviewed.',
    completeWindowConfirmed: true,
  };
}
