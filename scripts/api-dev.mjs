import { readLocalEnv, run } from './local-ports.mjs';
import { runtimeEnvironment } from './runtime-env.mjs';

// Load once, outside node --watch. Every restarted API inherits this snapshot.
// The root launcher supplies its selected ports through the environment.
try {
  const env = { ...(await readLocalEnv()), ...process.env };
  await run(
    'pnpm',
    [
      'exec',
      'concurrently',
      '--kill-others',
      'pnpm --filter @fingent360/api exec tsc -p tsconfig.json --watch',
      'node --watch apps/api/dist/main.js',
    ],
    runtimeEnvironment(env),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
