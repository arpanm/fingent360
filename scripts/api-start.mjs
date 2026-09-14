import { readLocalEnv, run } from './local-ports.mjs';
import { runtimeEnvironment } from './runtime-env.mjs';

try {
  await run(
    'node',
    ['apps/api/dist/main.js'],
    runtimeEnvironment({ ...(await readLocalEnv()), ...process.env }),
  );
} catch {
  console.error(
    'API startup failed. Check the configured runtime connection and local build; migration credentials are reserved for owner commands.',
  );
  process.exitCode = 1;
}
