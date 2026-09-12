import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  availablePort,
  databaseUrls,
  readLocalEnv,
  root,
  run,
  updateLocalEnv,
} from './local-ports.mjs';
const exec = promisify(execFile);
const compose = [
  'compose',
  '--env-file',
  '.env',
  '-f',
  'infra/local/compose.yaml',
];
export async function ensureDatabases() {
  const env = await readLocalEnv();
  // Only reuse mappings reported by this repository's named Compose services.
  async function mapped(service, internal) {
    try {
      const running = await exec(
        'docker',
        [...compose, 'ps', '--status', 'running', '--quiet', service],
        { cwd: root },
      );
      if (!running.stdout.trim()) return null;
      const { stdout } = await exec(
        'docker',
        [...compose, 'port', service, String(internal)],
        { cwd: root },
      );
      const match = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout.trim());
      return match ? Number(match[1]) : null;
    } catch {
      return null;
    }
  }
  const pg =
    (await mapped('postgres', 5432)) ??
    (await availablePort(env.POSTGRES_PORT || 55432));
  const mongo =
    (await mapped('mongodb', 27017)) ??
    (await availablePort(env.MONGO_PORT || 57017, '127.0.0.1', new Set([pg])));
  const changes = databaseUrls(env, pg, mongo);
  await updateLocalEnv(changes);
  await run('docker', [...compose, 'up', '-d', '--wait'], {
    ...process.env,
    ...env,
    ...changes,
  });
  console.log(
    `Databases: PostgreSQL 127.0.0.1:${pg}, MongoDB 127.0.0.1:${mongo}. API and migration URLs updated in .env.`,
  );
  return { ...env, ...changes };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await ensureDatabases();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
