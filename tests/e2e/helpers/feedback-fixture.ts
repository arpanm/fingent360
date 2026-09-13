import { fork } from 'node:child_process';
import { test as base, expect, type Locator } from '@playwright/test';

export interface FeedbackSandbox {
  apiOrigin: string;
  databaseUrl: string;
  schema: string;
}
export const test = base.extend<{ feedbackSandbox: FeedbackSandbox }>({
  feedbackSandbox: [
    // Playwright requires destructuring even when a fixture has no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const child = fork(
        new URL('./feedback-api-process.mjs', import.meta.url),
        [],
        {
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
          execArgv: [],
          env: { ...process.env, E2E_WEB_URL: process.env.E2E_WEB_URL },
        },
      );
      let cleanupError = '';
      child.on('message', (message) => {
        if (message && typeof message === 'object' && 'error' in message)
          cleanupError = String(message.error);
      });
      const exited = new Promise<number | null>((resolve) =>
        child.once('exit', (code) => resolve(code)),
      );
      try {
        const sandbox = await new Promise<FeedbackSandbox>(
          (resolve, reject) => {
            const timer = setTimeout(
              () =>
                reject(
                  Error(
                    'Feedback fixture startup timed out. Check local database availability and pnpm build.',
                  ),
                ),
              30000,
            );
            child.once('error', () => {
              clearTimeout(timer);
              reject(Error('Could not start the isolated feedback API.'));
            });
            child.once('exit', () => {
              clearTimeout(timer);
              reject(
                Error(
                  cleanupError ||
                    'Feedback fixture exited before becoming ready.',
                ),
              );
            });
            child.on('message', (message) => {
              if (!message || typeof message !== 'object') return;
              if ('error' in message) {
                clearTimeout(timer);
                reject(Error(String(message.error)));
              }
              if (
                'apiOrigin' in message &&
                'schema' in message &&
                'databaseUrl' in message
              ) {
                clearTimeout(timer);
                resolve(message as FeedbackSandbox);
              }
            });
          },
        );
        testInfo.annotations.push({
          type: 'feedback-api',
          description: `${sandbox.apiOrigin}; isolated schema ${sandbox.schema}; production limits unchanged`,
        });
        await use(sandbox);
      } finally {
        if (child.connected) child.send('stop');
        let timer: ReturnType<typeof setTimeout> | undefined;
        const code = await Promise.race([
          exited,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              child.kill('SIGKILL');
              reject(
                Error(
                  'Isolated feedback API shutdown timed out; inspect its annotated owned schema.',
                ),
              );
            }, 15000);
          }),
        ]).finally(() => clearTimeout(timer));
        expect
          .soft(
            code,
            cleanupError || 'Isolated feedback API exited unexpectedly.',
          )
          .toBe(0);
      }
    },
    { timeout: 60000 },
  ],
  request: async ({ playwright, feedbackSandbox }, use) => {
    const request = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      await use(request);
    } finally {
      await request.dispose();
    }
  },
  context: async ({ context, feedbackSandbox }, use) => {
    // This forwards real browser requests to the actual application API. It does
    // not manufacture responses; screenshots/audio, SQL writes and limits run.
    const endpoints = /\/api\/v1\/(?:feedback(?:[/?]|$)|ops(?:[/?]|$))/;
    await context.route(endpoints, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      });
    });
    await use(context);
  },
});
export { expect };

export async function expectReceived(card: Locator) {
  // Stop on the actual failure state and report its safe visible explanation,
  // instead of timing out for30s and letting cleanup replace the first error.
  await expect
    .poll(
      async () => {
        const label = await card.locator('.feedback-status').textContent();
        return label === 'Received' || label === 'Needs attention';
      },
      {
        timeout: 30000,
        message: 'Feedback must finish its first delivery attempt.',
      },
    )
    .toBe(true);
  await expect(
    card.locator('.feedback-status'),
    await card.innerText(),
  ).toHaveText('Received');
}
