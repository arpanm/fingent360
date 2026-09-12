import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
function localTarget(value: string): string {
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'E2E targets must be loopback origins without credentials, paths, queries or fragments.',
    );
  }
  return url.origin;
}
const api = localTarget(process.env.E2E_API_URL ?? 'http://127.0.0.1:4100');
const web = localTarget(process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5173');
const runId = process.env.E2E_RUN_ID ?? `manual-${Date.now()}`;
if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('Invalid E2E_RUN_ID');
const output = path.join(root, 'artifacts/e2e', runId);
const browserChoice = process.env.E2E_BROWSER ?? 'chromium';
if (!['chromium', 'chrome'].includes(browserChoice)) {
  throw new Error(
    'E2E_BROWSER must be chromium (managed) or chrome (installed Google Chrome).',
  );
}
const browserOptions =
  browserChoice === 'chrome' ? { channel: 'chrome' as const } : {};

export default defineConfig({
  testDir: './tests/e2e/cases',
  outputDir: path.join(output, 'results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(output, 'results.json') }],
  ],
  metadata: { apiTarget: api, webTarget: web, browserChoice, runId },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: browserChoice === 'chrome' ? 'off' : 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'api', testMatch: '**/api/**/*.spec.ts', use: { baseURL: api } },
    {
      name: 'desktop',
      testMatch: '**/browser/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], ...browserOptions, baseURL: web },
    },
    {
      name: 'mobile',
      testMatch: '**/browser/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        ...browserOptions,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        baseURL: web,
      },
    },
  ],
  // No webServer, globalSetup, scheduler or auto-run hooks. The user starts
  // the application/databases and explicitly runs selected cases in the UI.
});
