import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { test as base, expect, type FeedbackSandbox } from './feedback-fixture';
import { indiaActors } from './india-macro';
import { equityInput } from './equity-coverage';
import { retentionHeaders } from './retention';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:equities|equity-consolidations)(?:[/?]|$)/,
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
/** Synthetic account-free original stand-ins; this is not a copied exchange PDF or live quote. */
export const consolidationPdf = Buffer.from(
  '%PDF-1.4\n% TEST-SIMULATION consolidation notice; not an official document\n%%EOF',
);
export function consolidationInput() {
  return {
    requestId: randomUUID(),
    oldIsin: 'INE188Y01023',
    newIsin: 'INE188Y01031',
    lastOldTradeOn: '2025-06-24',
    suspendedOn: '2025-06-25',
    recordOn: '2025-06-25',
    resumedOn: '2025-07-11',
    oldFaceValue: '1',
    newFaceValue: '10',
    documents: (
      [
        {
          role: 'suspension',
          url: 'https://nsearchives.nseindia.com/content/circulars/CML68640.pdf',
          publishedOn: '2025-06-19',
        },
        {
          role: 'resumption',
          url: 'https://nsearchives.nseindia.com/content/circulars/CML69016.pdf',
          publishedOn: '2025-07-08',
        },
        {
          role: 'issuer-terms',
          url: 'https://vertoz.com/ir/wp-content/uploads/2025/06/RD_sd.pdf',
          publishedOn: '2025-06-13',
        },
      ] as const
    ).map((d) => ({
      ...d,
      pdfBase64: consolidationPdf.toString('base64'),
      page: 1,
      transcription:
        'TEST-SIMULATION: synthetic original stand-in for independently reviewed consolidation terms.',
    })),
    coverageEvidence:
      'TEST-SIMULATION: complete transition window and no other actions; prices below are synthetic, not actual quotes.',
    rightsEvidence:
      'TEST-SIMULATION: synthetic document bytes only; no source permission asserted.',
    pureConsolidationConfirmed: true,
    rightsConfirmed: true,
  };
}
export function consolidationReview(id: string, decision = 'publish') {
  return {
    requestId: randomUUID(),
    id,
    decision,
    reason:
      'TEST-SIMULATION independent original terms and full source coverage reviewed.',
    originalsAndTermsConfirmed: true,
  };
}
export async function consolidationActors(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const reviewer = await indiaActors(request, playwright, sandbox),
    ids = [];
  for (const [isin, face, date, close, series] of [
    ['INE188Y01023', '1', '2025-06-24', '12.345', 'EQ'],
    ['INE188Y01031', '10', '2025-07-11', '125', 'BE'],
  ] as const) {
    const input = await equityInput();
    input.effectiveOn = date;
    input.body = JSON.stringify({
      format: 'f360-equity-evidence-v1',
      observations: [
        {
          isin,
          kind: 'identity',
          exchange: 'NSE',
          effectiveOn: date,
          sourceRow: 2,
          symbol: 'VERTOZ',
          name: 'Synthetic consolidation company',
          series,
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
      ],
    });
    const imported = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    const edition = await imported.json();
    expect(imported.status(), JSON.stringify(edition)).toBe(201);
    expect(edition).toMatchObject({
      effectiveOn: date,
      observations: [{ effectiveOn: date }, { effectiveOn: date }],
    });
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: input.requestId,
            decision: 'publish',
            reason:
              'Synthetic identity and boundary price evidence independently reviewed.',
          },
        })
      ).status(),
    ).toBe(201);
    ids.push(input.requestId);
  }
  return { reviewer, equityIds: ids };
}
