import type { FeedbackSandbox } from './feedback-fixture';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import {
  test as base,
  expect,
  equityInput,
  retentionHeaders,
} from './equity-coverage';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:ops\/company-news|discovery)(?:[/?]|$)/,
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
export function companyNewsInput() {
  const now = new Date().toISOString();
  return {
    requestId: randomUUID(),
    isin: 'INE002A01018',
    title: 'Synthetic verified company news',
    summary:
      'Synthetic original editorial summary, not a factual market claim.',
    copiedText: '',
    copiedFrom: null,
    citations: ['issuer', 'independent'].map((originator, index) => ({
      name: `Synthetic ${originator}`,
      url: `https://example.com/${originator}`,
      originator,
      primary: index === 0,
      publishedAt: now,
      retrievedAt: now,
      rightsMode: 'link-only',
      termsUrl: 'https://example.com/terms',
      permissionReference:
        'TEST-SIMULATION: generated evidence; no live licence claimed.',
      linkingAllowed: true,
      offlineAllowed: true,
      noExpiryConfirmed: true,
      independentReporting: true,
    })),
    verification:
      'TEST-SIMULATION: both independently originated records corroborate the synthetic claim.',
    conflicts: 'none-found',
    originalEditorialConfirmed: true,
  };
}
export async function prepareCompanyNews(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  expect(sandbox.namedCredentials).toBeDefined();
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: retentionHeaders,
        data: sandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: `news_${randomUUID().slice(0, 8)}`,
    password: 'Synthetic-company-news-2026-password',
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
  const equity = await equityInput();
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: equity,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await reviewer.post('/api/v1/ops/equities/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: equity.requestId,
          decision: 'publish',
          reason: 'Synthetic identity independently reviewed.',
        },
      })
    ).status(),
  ).toBe(201);
  const input = companyNewsInput();
  const result = await request.post('/api/v1/ops/company-news/prepare', {
    headers: retentionHeaders,
    data: input,
  });
  expect(result.status(), await result.text()).toBe(201);
  return { input, id: `company-news-${input.requestId}`, reviewer };
}

export function reviewNews(
  id: string,
  expectedVersion = 1,
  decision = 'publish',
) {
  return {
    requestId: randomUUID(),
    id,
    expectedVersion,
    decision,
    reason: 'Synthetic publication review acceptance.',
    corroborationConfirmed: true,
    rightsConfirmed: true,
  };
}
