import { test as isolated } from './feedback-fixture';
// Reuse the actual application/schema lifecycle for private-account journeys.
// Forward account and identity journeys to this test's actual application.
// The other public reading requests continue to use the running web application.
export const test = isolated.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:account|securities)(?:[/?]|$)/,
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
export { expect } from '@playwright/test';
