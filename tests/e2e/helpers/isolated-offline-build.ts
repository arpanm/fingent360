import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OfflineBundle } from '../../../apps/web/src/offline/types';

// No build, filesystem mutation, listener or process exists until this is called.
export async function isolatedOfflineBuild(bundle: OfflineBundle) {
  const directory = await mkdtemp(path.join(tmpdir(), 'f360-offline-image-'));
  const child = fork(
    new URL('./isolated-offline-build-process.mjs', import.meta.url),
    [],
    {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  const stopped = new Promise<void>((resolve) =>
    child.once('close', () => resolve()),
  );
  let stopRequested = false;
  async function close() {
    if (stopRequested) return stopped;
    stopRequested = true;
    if (child.exitCode !== null || child.signalCode !== null) {
      await rm(directory, { recursive: true, force: true });
      return;
    }
    child.kill('SIGTERM');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 10000);
    try {
      await stopped;
    } finally {
      clearTimeout(deadline);
      await rm(directory, { recursive: true, force: true });
    }
  }
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(Error('Isolated offline build exceeded 180 seconds.')),
        180000,
      );
      const done = (error?: Error, value?: string) => {
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value!);
      };
      child.once('error', (error) => done(error));
      child.once('exit', (code) =>
        done(Error(`Isolated offline package exited before ready (${code}).`)),
      );
      child.on('message', (message: unknown) => {
        if (!message || typeof message !== 'object' || !('kind' in message))
          return;
        if (
          message.kind === 'ready' &&
          'origin' in message &&
          typeof message.origin === 'string'
        )
          done(undefined, message.origin);
        if (message.kind === 'failed' && 'message' in message)
          done(Error(String(message.message)));
      });
      child.send({ kind: 'build', bundle, directory });
    });
    return { origin, close };
  } catch (error) {
    await close();
    throw error;
  }
}
