import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test as base, expect } from './feedback-fixture';
import { loginRetentionOperator, retentionHeaders } from './retention';
import { BondComparisonInputSchema } from '../../../packages/contracts/src/index';
export { expect, retentionHeaders, loginRetentionOperator };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/(?:funds|account)(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await use(context);
  },
});
export async function fundFixture() {
  const data = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/funds-bonds.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { navText: string; comparison: unknown };
  return {
    navText: data.navText,
    comparison: BondComparisonInputSchema.parse(data.comparison),
  };
}
export async function publishNav(request: APIRequestContext) {
  await loginRetentionOperator(request);
  const { navText } = await fundFixture(),
    id = randomUUID();
  expect(
    (
      await request.post('/api/v1/ops/funds/import', {
        headers: retentionHeaders,
        data: {
          requestId: id,
          permissionReference:
            'TEST-SIMULATION generated file only; no AMFI content redistributed',
          writtenPermissionConfirmed: true,
          body: navText,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/funds/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: id,
          decision: 'publish',
          reason: 'Synthetic fixture publication',
        },
      })
    ).status(),
  ).toBe(201);
  return id;
}
export async function fundAccount(request: APIRequestContext) {
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers: retentionHeaders,
        data: {
          username: `funds_${randomUUID().slice(0, 8)}`,
          password: 'Synthetic-funds-2026!',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
}
