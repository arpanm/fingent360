import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test as base, expect } from './app-fixture';
export { expect };
export { retentionHeaders } from './retention';
export { indiaActors as flowActors } from './india-macro';
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/institutional-flows(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await use(context);
  },
});
export async function flowInput(
  source: 'nse-cash-html' | 'cdsl-daily-html' = 'nse-cash-html',
) {
  return {
    requestId: randomUUID(),
    source,
    body: await readFile(
      new URL(
        `../../../packages/contracts/test/fixtures/institutional-flows/${source === 'nse-cash-html' ? 'nse' : 'cdsl'}-synthetic.html`,
        import.meta.url,
      ),
      'utf8',
    ),
    rightsEvidence:
      'TEST-SIMULATION: synthetic source only; no permission claimed.',
    rightsConfirmed: true,
  };
}
export function flowReview(
  id: string,
  decision: 'publish' | 'withdraw' = 'publish',
) {
  return {
    requestId: randomUUID(),
    id,
    decision,
    reason: 'Independent synthetic source and arithmetic verification.',
    rightsVerified: true,
  };
}
/** Reconstructed table structure with observed 11-Sep-2026 numeric facts, not original provider bytes. */
export function historicalFlowInput() {
  const table = (id: string, rows: string[][]) =>
    `<table id="${id}"><tr><td>Category</td><td>Date</td><td>Buy Value(₹ Crores)</td><td>Sell Value (₹ Crores)</td><td>Net Value (₹ Crores)</td></tr>${rows.map((row) => '<tr>' + [row[0], '11-Sep-2026', ...row.slice(1)].map((cell) => `<td>${cell}</td>`).join('') + '</tr>').join('')}</table>`;
  return {
    requestId: randomUUID(),
    source: 'nse-cash-html' as const,
    body:
      '<!-- TEST-SIMULATION reconstructed markup; actual dated public numerical facts, not retained original HTML. -->' +
      table('fiidiiTableNse', [
        ['DII', '13715.34', '11644.47', '2070.87'],
        ['FII/FPI', '11917.52', '12896.12', '-978.60'],
      ]) +
      table('fiidiiTable', [
        ['DII', '15109.58', '13141.41', '1968.17'],
        ['FII/FPI', '12616.89', '13547.79', '-930.90'],
      ]),
    rightsEvidence:
      'TEST-SIMULATION reconstructed table of numerical facts; no provider licence or original-byte equivalence claimed.',
    rightsConfirmed: true,
  };
}
