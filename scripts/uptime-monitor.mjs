import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import {
  parseUptimeConfig,
  readJournal,
  saveJournal,
  probeTarget,
  recordObservation,
  monitorView,
} from './uptime-core.mjs';
export async function startMonitor(configPath, statePath) {
  const config = parseUptimeConfig(
      JSON.parse(await readFile(configPath, 'utf8')),
    ),
    file = resolve(statePath);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const lock = await open(file + '.lock', 'wx', 0o600);
  await lock.writeFile(String(process.pid));
  let server,
    timer,
    stopping = false,
    cycle = Promise.resolve();
  try {
    let journal = await readJournal(file, config),
      storageError = false;
    const html = await readFile(
        new URL('./uptime-viewer.html', import.meta.url),
      ),
      script = await readFile(new URL('./uptime-viewer.js', import.meta.url));
    server = createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      );
      if (
        req.method !== 'GET' ||
        req.headers.host !== `127.0.0.1:${config.port}`
      ) {
        res.writeHead(403).end();
        return;
      }
      if (req.url === '/state') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({ ...monitorView(config, journal), storageError }),
        );
      } else if (req.url === '/viewer.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(script);
      } else if (req.url === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      } else res.writeHead(404).end();
    });
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(config.port, '127.0.0.1', done);
    });
    const poll = () => {
      cycle = (async () => {
        const observations = await Promise.all(
          config.targets.map((target) => probeTarget(target, config)),
        );
        let candidate = journal;
        for (const observation of observations)
          candidate = recordObservation(candidate, observation);
        try {
          await saveJournal(file, candidate);
          journal = candidate;
          storageError = false;
        } catch {
          storageError = true;
        }
        if (!stopping) timer = setTimeout(poll, config.intervalSeconds * 1000);
      })();
    };
    poll();
    console.log(
      `Independent monitor viewer: http://127.0.0.1:${config.port}. No historical uptime is inferred.`,
    );
    return async () => {
      stopping = true;
      clearTimeout(timer);
      await cycle;
      await new Promise((done) => server.close(done));
      await lock.close();
      await unlink(file + '.lock');
    };
  } catch (error) {
    await lock.close();
    await unlink(file + '.lock');
    if (server) server.close();
    throw error;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [configPath, statePath, ...extra] = process.argv.slice(2);
  if (!configPath || !statePath || extra.length)
    throw Error(
      'Usage: node scripts/uptime-monitor.mjs config.json /absolute/persistent/state.json',
    );
  const stop = await startMonitor(configPath, statePath);
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      void stop().catch(() => {
        process.exitCode = 1;
      });
    });
}
