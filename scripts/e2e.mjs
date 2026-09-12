// Human-operated launcher. Importing test files must never trigger an action.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { availablePort, readLocalEnv, localOrigin } from './local-ports.mjs';
const local = await readLocalEnv();
const targets = { E2E_API_URL: process.env.E2E_API_URL || `http://127.0.0.1:${local.API_PORT || 4100}`, E2E_WEB_URL: process.env.E2E_WEB_URL || local.WEB_ORIGIN || `http://127.0.0.1:${local.WEB_PORT || 5173}` };
targets.E2E_API_URL = localOrigin(targets.E2E_API_URL);
targets.E2E_WEB_URL = localOrigin(targets.E2E_WEB_URL);
const uiPort = await availablePort(process.env.E2E_UI_PORT || 9323);
const reportPort = await availablePort(process.env.E2E_REPORT_PORT || 9324);

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const [mode = 'ui', ...filters] = process.argv.slice(2);
if (!['ui', 'run', 'report'].includes(mode)) {
  console.error(
    'Use pnpm e2e:ui, pnpm e2e:run [Playwright filters], or pnpm e2e:report.',
  );
  process.exit(2);
}
let cli;
try {
  cli = require.resolve('@playwright/test/cli');
} catch {
  console.error(
    'Test runner is not installed. Run pnpm install --frozen-lockfile. Then use E2E_BROWSER=chrome with installed Google Chrome, or run pnpm e2e:install for managed Chromium.',
  );
  process.exit(2);
}
const runId =
  new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') +
  '-' +
  process.pid;
let args;
if (mode === 'report') {
  const runs = path.join(root, 'artifacts/e2e');
  const latest = existsSync(runs)
    ? readdirSync(runs)
        .filter((name) =>
          existsSync(path.join(runs, name, 'report/index.html')),
        )
        .sort()
        .at(-1)
    : undefined;
  if (!latest) {
    console.error(
      'No saved report yet. Manually run pnpm e2e:run first. UI-session results are visible inside the UI.',
    );
    process.exit(2);
  }
  args = [
    'show-report',
    path.join(runs, latest, 'report'),
    '--host=127.0.0.1',
    `--port=${reportPort}`,
  ];
} else {
  args = ['test', '--config=playwright.config.ts', ...filters];
  if (mode === 'ui') {
    args.push('--ui', '--ui-host=127.0.0.1', `--ui-port=${uiPort}`);
    console.log(
      `Open http://127.0.0.1:${uiPort}. Tests target ${targets.E2E_WEB_URL} and ${targets.E2E_API_URL}. Select cases and click Run; watch mode stays off.`,
    );
  } else {
    console.log(
      `Manual run: ${runId}. Reports will be written under artifacts/e2e/${runId}.`,
    );
  }
}
const child = spawn(process.execPath, [cli, ...args], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...targets, E2E_RUN_ID: runId },
  shell: false,
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`Unable to start Playwright: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
