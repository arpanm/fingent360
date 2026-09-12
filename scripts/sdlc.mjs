import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export function parseArguments(input) {
  const args = [...input];
  let message = 'chore: validated local changes';
  if (args[0] === '--message') {
    args.shift();
    message = args.shift();
    if (!message?.trim() || message.startsWith('--')) {
      throw new Error('--message requires a nonempty commit message.');
    }
  } else if (args.length && !args[0].startsWith('-')) {
    message = args.shift();
    if (!message.trim()) throw new Error('Commit message must not be empty.');
  }
  if (args[0] === '--') args.shift();
  else if (args.some((arg) => !arg.startsWith('-'))) {
    throw new Error('Place Playwright filters after --, e.g. pnpm sdlc "Fix" -- --grep E2E-API-001.');
  }
  return { message, filters: args };
}

export function workflow(message, filters = [], execute = executeCommand) {
  const step = (command, args) => {
    const status = execute(command, args);
    if (status !== 0)
      throw new Error(
        `${command} ${args[0]} failed (exit ${status}). Workflow stopped.`,
      );
  };
  step('pnpm', ['format']);
  step('pnpm', ['check']);
  step('git', ['add', '-A']);
  const changed = execute('git', ['diff', '--cached', '--quiet']);
  if (changed === 1) {
    step('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', message]);
  } else if (changed !== 0) {
    throw new Error('Could not inspect staged changes. Workflow stopped.');
  }
  step('pnpm', ['e2e:run', ...filters]);
}

function executeCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error)
    throw new Error(`Could not start ${command}: ${result.error.message}`);
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { message, filters } = parseArguments(process.argv.slice(2));
    console.log(
      'Format → check → stage all non-ignored changes → local commit → E2E. No push.',
    );
    console.log(
      'App/databases and migrations must already be ready. E2E failure retains the commit.',
    );
    workflow(message, filters);
    console.log('Workflow completed. Test evidence: artifacts/e2e/latest.md');
  } catch (error) {
    console.error(error.message);
    console.error(
      'Fix the failed stage and rerun. Any completed commit is retained; nothing was pushed.',
    );
    process.exitCode = 1;
  }
}
