import { randomUUID } from 'node:crypto';
import { test as base, expect } from './app-fixture';
import { operatorKey } from './operator';
import { seedConnectionSource } from './research-connection-fixture';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
export const eventHeaders = {
  Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
};
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/events(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await use(context);
  },
});
export { expect };
export async function eventFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const source = await seedConnectionSource(sandbox);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: eventHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  return {
    source,
    id: randomUUID(),
    input: {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic editorial fixture',
      editorial: {
        title: 'Synthetic reviewed policy context',
        family: 'Policy context',
        geography: ['India'],
        claimKind: 'inference',
        explanation:
          'Synthetic editorial context used only for isolated acceptance; no market effect asserted.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: source.version,
            hash: source.sourceHash!,
            field: 'title',
            quote: source.title,
          },
        ],
        links: [
          {
            kind: 'sector',
            label: 'Synthetic sector context',
            citation: 0,
            rationale:
              'Synthetic explicitly authored contextual association; no causal effect.',
          },
        ],
      },
    },
  };
}
