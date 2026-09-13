import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)),
  web = path.join(root, 'artifacts/android-web');
const build = JSON.parse(
  await readFile(path.join(web, 'offline-build.json'), 'utf8'),
);
if (build.mode !== 'offline')
  throw Error('Build the offline web app with pnpm android:web first.');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          message:
            'No API server exists in this test. The device transport must handle this request.',
        }),
      );
      return;
    }
    const file = path.resolve(
      web,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
    );
    if (!file.startsWith(web + path.sep)) throw Error('Outside web bundle');
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string')
  throw Error('Offline asset server unavailable.');
const base = `http://127.0.0.1:${address.port}`;
const ui = process.argv.includes('--ui');
const extra = process.argv.slice(2).filter((v) => v !== '--ui');
console.log(
  `Offline bundled app: ${base}. No API or database is used.${ui ? ' Select tests and click Run; leave watch off.' : ''}`,
);
const child = spawn(
  'pnpm',
  [
    'exec',
    'playwright',
    'test',
    '--project=offline',
    ...(ui ? ['--ui', '--ui-host=127.0.0.1', '--ui-port=0'] : []),
    ...extra,
  ],
  {
    cwd: root,
    env: { ...process.env, E2E_OFFLINE_URL: base, E2E_WEB_URL: base },
    stdio: 'inherit',
  },
);
const stop = () => {
  child.kill('SIGTERM');
  server.close();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', (error) => {
  console.error(error.message);
  server.close();
  process.exitCode = 1;
});
child.on('exit', (code) => {
  server.close();
  process.exitCode = code ?? 1;
});
