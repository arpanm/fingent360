import net from 'node:net';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = new URL('../.env', import.meta.url);
export async function readLocalEnv() {
  return parseEnv(await readFile(envPath, 'utf8'));
}
export async function updateLocalEnv(values, destination = envPath) {
  let text = await readFile(destination, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(String(value))}`;
    const pattern = new RegExp(`^(?:export\\s+)?${key}=.*$`, 'gm');
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text.trimEnd()}\n${line}\n`;
  }
  const filename =
    destination instanceof URL ? fileURLToPath(destination) : destination;
  const temporary = `${filename}.ports-${process.pid}.tmp`;
  await writeFile(temporary, text, { mode: 0o600 });
  await rename(temporary, filename);
}
export async function availablePort(
  preferred,
  host = '127.0.0.1',
  excluded = new Set(),
) {
  const start = Number(preferred);
  if (!Number.isInteger(start) || start < 1 || start > 65535)
    throw new Error('Configured port must be between 1 and 65535.');
  for (let port = start; port <= Math.min(start + 200, 65535); port++) {
    if (excluded.has(port)) continue;
    const free = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', (error) =>
        error.code === 'EADDRINUSE'
          ? resolve(false)
          : reject(new Error(`Cannot select local port (${error.code}).`)),
      );
      server.listen({ host, port, exclusive: true }, () =>
        server.close(() => resolve(true)),
      );
    });
    if (free) return port;
  }
  throw new Error('No available port in the configured range.');
}
export function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    const stop = (signal) => {
      try {
        if (process.platform === 'win32') {
          child.kill(signal);
        } else {
          process.kill(-child.pid, signal);
        }
      } catch {
        /* Child already exited. */
      }
    };
    const interrupt = () => stop('SIGINT');
    const terminate = () => stop('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    const cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    };
    child.once('error', () => {
      cleanup();
      reject(new Error(`Could not start ${command}.`));
    });
    child.once('exit', (code) => {
      stop('SIGTERM');
      cleanup();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited unsuccessfully.`));
      }
    });
  });
}
export function databaseUrls(env, postgresPort, mongoPort) {
  const pg = new URL(env.DATABASE_URL);
  const owner = env.MIGRATION_DATABASE_URL
    ? new URL(env.MIGRATION_DATABASE_URL)
    : null;
  const mongo = new URL(env.MONGODB_URI);
  if (
    ![pg.hostname, mongo.hostname, ...(owner ? [owner.hostname] : [])].every(
      (host) => ['localhost', '127.0.0.1'].includes(host),
    )
  )
    throw new Error(
      'Local Compose requires loopback database URLs; remote URLs were not changed.',
    );
  if (
    owner &&
    (!['postgres:', 'postgresql:'].includes(owner.protocol) ||
      owner.hostname !== pg.hostname ||
      (owner.port || '5432') !== (pg.port || '5432') ||
      owner.pathname !== pg.pathname ||
      owner.searchParams.get('options') !== pg.searchParams.get('options'))
  )
    throw new Error(
      'Migration and runtime URLs must identify the same local database/schema before ports are changed.',
    );
  pg.port = String(postgresPort);
  if (owner) owner.port = String(postgresPort);
  mongo.port = String(mongoPort);
  return {
    POSTGRES_PORT: String(postgresPort),
    MONGO_PORT: String(mongoPort),
    DATABASE_URL: pg.href,
    ...(owner ? { MIGRATION_DATABASE_URL: owner.href } : {}),
    MONGODB_URI: mongo.href,
  };
}

export function localOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid local service URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Service targets must be credential-free loopback origins.',
    );
  return url.origin;
}
