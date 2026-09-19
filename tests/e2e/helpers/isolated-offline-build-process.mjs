// Executed only by an explicitly running integration case, never by discovery.
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

let directory, server, closing;
async function close() {
  if (closing) return closing;
  closing = (async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  })();
  return closing;
}
process.on('disconnect', () => void close().finally(() => process.exit()));
process.on('SIGTERM', () => void close().finally(() => process.exit()));
process.once('message', async (message) => {
  try {
    if (!message || message.kind !== 'build' || !message.bundle)
      throw Error('Expected an explicit captured snapshot build request.');
    directory = message.directory;
    if (
      typeof directory !== 'string' ||
      !path.basename(directory).startsWith('f360-offline-image-')
    )
      throw Error('Invalid owned build directory.');
    const root = fileURLToPath(new URL('../../../apps/web/', import.meta.url));
    const require = createRequire(path.join(root, 'package.json'));
    const { build } = await import(pathToFileURL(require.resolve('vite')).href);
    const { default: react } = await import(
      pathToFileURL(require.resolve('@vitejs/plugin-react')).href
    );
    const snapshotId = '\0f360-captured-public-snapshot';
    const expectedImporter = path.join(root, 'src/offline/index.ts');
    let substituted = false;
    await build({
      root,
      configFile: false,
      envDir: directory,
      cacheDir: path.join(directory, 'cache'),
      logLevel: 'silent',
      define: {
        'import.meta.env.VITE_APP_RUNTIME': JSON.stringify('offline'),
        'import.meta.env.VITE_API_ORIGIN': JSON.stringify(''),
      },
      plugins: [
        {
          name: 'isolated-captured-public-snapshot',
          enforce: 'pre',
          resolveId(source, importer) {
            if (
              source === './content-bundle.json' &&
              importer === expectedImporter
            ) {
              substituted = true;
              return snapshotId;
            }
          },
          load(id) {
            if (id === snapshotId)
              return 'export default ' + JSON.stringify(message.bundle) + ';';
          },
        },
        react(),
      ],
      build: { outDir: path.join(directory, 'web'), emptyOutDir: true },
    });
    if (!substituted)
      throw Error('Offline snapshot import was not substituted.');
    const web = path.join(directory, 'web');
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
    };
    server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname.startsWith('/api/')) {
          response.writeHead(500);
          response.end('No API exists in this isolated offline package.');
          return;
        }
        const target = path.resolve(
          web,
          '.' +
            decodeURIComponent(
              url.pathname === '/' ? '/index.html' : url.pathname,
            ),
        );
        if (!target.startsWith(web + path.sep))
          throw Error('Outside isolated package');
        const bytes = await readFile(target);
        response.writeHead(200, {
          'Content-Type':
            mime[path.extname(target)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(bytes);
      } catch {
        response.writeHead(404);
        response.end('Not found');
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    process.send?.({
      kind: 'ready',
      origin: `http://127.0.0.1:${address.port}`,
    });
  } catch (error) {
    process.send?.({
      kind: 'failed',
      message:
        error instanceof Error
          ? error.message
          : 'Isolated offline build failed',
    });
    await close();
    process.exitCode = 1;
    process.disconnect?.();
  }
});
