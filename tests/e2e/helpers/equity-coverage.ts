import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test as base, expect } from './feedback-fixture';
import { loginRetentionOperator, retentionHeaders } from './retention';
export { expect, loginRetentionOperator, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
export async function equityInput() {
  return {
    requestId: randomUUID(),
    parser: 'f360-equity-evidence-v1',
    sourceUrl:
      'https://www.nseindia.com/static/market-data/securities-available-for-trading',
    effectiveOn: '2025-01-31',
    publishedAt: null,
    rightsBasis:
      'TEST-SIMULATION: generated fixture only; no provider licence claimed.',
    rightsConfirmed: true,
    body: await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/equity-coverage.json',
        import.meta.url,
      ),
      'utf8',
    ),
  };
}
export async function publishEquity(request: APIRequestContext) {
  await loginRetentionOperator(request);
  const payload = await equityInput();
  const imported = await request.post('/api/v1/ops/equities/import', {
    headers: retentionHeaders,
    data: payload,
  });
  expect(imported.status()).toBe(201);
  const review = await request.post('/api/v1/ops/equities/review', {
    headers: retentionHeaders,
    data: {
      requestId: randomUUID(),
      editionId: payload.requestId,
      decision: 'publish',
      reason: 'Synthetic fixture reviewed for this isolated test.',
    },
  });
  expect(review.status()).toBe(201);
  return payload;
}

export async function publishUdiff(request: APIRequestContext) {
  await loginRetentionOperator(request);
  const payload = {
    ...(await equityInput()),
    parser: 'nse-udiff-cm-v20260630',
    sourceUrl:
      'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20250131_F_0000.csv.zip',
    sourceFileName: 'BhavCopy_NSE_CM_0_0_0_20250131_F_0000.csv',
    body: await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/equity-udiff.csv',
        import.meta.url,
      ),
      'utf8',
    ),
  };
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: payload,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/equities/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: payload.requestId,
          decision: 'publish',
          reason: 'Synthetic UDiFF source reviewed.',
        },
      })
    ).status(),
  ).toBe(201);
  return payload;
}
