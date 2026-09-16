import { randomUUID } from 'node:crypto';
import { test as base, expect } from './feedback-fixture';
import { OI_FIELDS } from '../../../packages/contracts/src/index';
export { indiaActors } from './india-macro';
export { retentionHeaders } from './retention';
export { expect };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:ops\/)?positioning(?:[/?]|$)/,
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
export function positioningInput() {
  const filename = 'fao_participant_oi_06062025.csv';
  return {
    requestId: randomUUID(),
    filename,
    sourceUrl: 'https://archives.nseindia.com/content/nsccl/' + filename,
    csv: [
      '""Participant wise Open Interest (no. of contracts) in Equity Derivatives as on Jun 06, 2025""' +
        ','.repeat(14),
      ['Client Type', ...OI_FIELDS].join(','),
      ...['Client', 'DII', 'FII', 'Pro'].map((name) =>
        [name, ...Array<string>(12).fill('1'), '6', '6'].join(','),
      ),
      ['TOTAL', ...Array<string>(12).fill('4'), '24', '24'].join(','),
    ].join('\r\n'),
    rightsEvidence:
      'TEST-SIMULATION: synthetic contract counts only; no exchange rights claimed.',
    rightsConfirmed: true,
  };
}
export function positioningReview(id: string, decision = 'publish') {
  return {
    requestId: randomUUID(),
    id,
    decision,
    reason:
      'TEST-SIMULATION: independent source identity and all totals reviewed.',
    rightsVerified: true,
  };
}
