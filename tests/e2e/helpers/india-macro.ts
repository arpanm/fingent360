import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { test as base, expect, type FeedbackSandbox } from './feedback-fixture';
import { retentionHeaders } from './retention';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/india-macro(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
export function indiaMacroInput() {
  const cells = (values: string[]) =>
    '<tr>' + values.map((value) => `<td>${value}</td>`).join('') + '</tr>';
  const releaseHtml =
    `<h2>PRESS RELEASE OF CONSUMER PRICE INDEX ON BASE2024=100 FOR JUNE,2026</h2>Posted On:13 JUL2026 4:00PM by PIB Delhi<p>Synthetic original publication fixture for parser acceptance; it is not a real financial observation.</p><table>${cells(['', 'June,2026 (Provisional)', 'May,2026 (Final)'])}${cells(['Rural', 'Urban', 'Combined', 'Rural', 'Urban', 'Combined'])}${cells(['Inflation (%)', 'CPI (General)', '1.01', '1.02', '1.03', '0.91', '0.92', '0.93'])}${cells(['CFPI', '1', '1', '1', '1', '1', '1'])}${cells(['Index', 'CPI (General)', '101.01', '101.02', '101.03', '100.91', '100.92', '100.93'])}${cells(['CFPI', '1', '1', '1', '1', '1', '1'])}</table>`
      .replace('BASE2024', 'BASE 2024')
      .replace('JUL2026', 'JUL 2026');
  return {
    requestId: randomUUID(),
    releaseUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=9999901',
    releaseHtml,
    apiBody: JSON.stringify({
      data: ['June', 'May'].map((month, i) => ({
        base_year: '2024',
        series: 'Current',
        year: '2026',
        month,
        state: 'All India',
        sector: 'Combined',
        division: 'CPI (General)',
        group: null,
        class: null,
        sub_class: null,
        item: null,
        code: null,
        index: i ? '100.93' : '101.03',
        inflation: i ? '0.93' : '1.03',
        imputation: null,
      })),
      meta_data: { page: 1, totalRecords: 2, totalPages: 1, recordPerPage: 10 },
      msg: 'Synthetic fixture',
      statusCode: true,
    }),
    rightsEvidence:
      'TEST-SIMULATION: generated source layout; no actual financial data or permission claimed.',
    rightsConfirmed: true,
  };
}
export async function indiaActors(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: retentionHeaders,
        data: sandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: `india_${randomUUID().slice(0, 8)}`,
    password: 'Synthetic-india-macro-2026-password',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers: retentionHeaders,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const reviewer = await playwright.request.newContext({
    baseURL: sandbox.apiOrigin,
  });
  expect(
    (
      await reviewer.post('/api/v1/ops/session', {
        headers: retentionHeaders,
        data: credentials,
      })
    ).status(),
  ).toBe(200);
  return reviewer;
}
export function indiaReview(editionId: string, decision = 'publish') {
  return {
    requestId: randomUUID(),
    editionId,
    decision,
    reason: 'Synthetic independent source review.',
  };
}
