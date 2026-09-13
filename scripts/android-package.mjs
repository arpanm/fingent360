import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const run = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`${command} exited ${code}`)),
    );
  });
await run('pnpm', ['--filter', '@fingent360/contracts', 'build']);
await run(
  'pnpm',
  [
    '--filter',
    '@fingent360/web',
    'build',
    '--outDir',
    '../../artifacts/android-web',
    '--emptyOutDir',
  ],
  { ...process.env, VITE_APP_RUNTIME: 'offline' },
);
const snapshot = JSON.parse(
  await readFile(
    new URL('../apps/web/src/offline/content-bundle.json', import.meta.url),
    'utf8',
  ),
);
await writeFile(
  new URL('../artifacts/android-web/offline-build.json', import.meta.url),
  JSON.stringify(
    {
      mode: 'offline',
      snapshotDate: snapshot.generatedAt,
      publishedItems: snapshot.feed.length,
    },
    null,
    2,
  ) + '\n',
);
if (!process.argv.includes('--web-only'))
  await run(process.execPath, ['scripts/android-build.mjs']);
