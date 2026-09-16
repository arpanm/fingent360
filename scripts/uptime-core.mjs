import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve4 } from 'node:dns/promises';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
export function publicV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((v) => !Number.isInteger(v) || v < 0 || v > 255))
    return false;
  return !(
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 168 || p[1] === 0 || p[1] === 2)) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51)) ||
    (p[0] === 203 && p[1] === 0)
  );
}
export function parseUptimeConfig(value) {
  if (
    !value ||
    Object.keys(value).some(
      (k) =>
        !['targets', 'intervalSeconds', 'port', 'allowLoopback'].includes(k),
    )
  )
    throw Error('Unknown monitor configuration field.');
  const {
    targets,
    intervalSeconds = 60,
    port = 9410,
    allowLoopback = false,
  } = value;
  if (
    typeof allowLoopback !== 'boolean' ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 30 ||
    intervalSeconds > 3600 ||
    !Array.isArray(targets) ||
    targets.length < 1 ||
    targets.length > 10
  )
    throw Error('Invalid bounded monitor configuration.');
  const ids = new Set();
  for (const t of targets) {
    if (
      !t ||
      Object.keys(t).some((k) => !['id', 'url'].includes(k)) ||
      typeof t.id !== 'string' ||
      !/^[a-z0-9-]{1,50}$/.test(t.id) ||
      ids.has(t.id)
    )
      throw Error('Invalid or repeated monitor target.');
    ids.add(t.id);
    const u = new URL(t.url);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !['/api/v1/health', '/api/v1/ready'].includes(u.pathname) ||
      !(
        (u.protocol === 'https:' && !u.port) ||
        (allowLoopback && u.protocol === 'http:' && u.hostname === '127.0.0.1')
      )
    )
      throw Error(
        'Only public HTTPS health/readiness or explicit loopback targets are allowed.',
      );
  }
  return { targets, intervalSeconds, port, allowLoopback };
}
export async function probeTarget(
  target,
  config,
  {
    resolve = resolve4,
    secureRequest = httpsRequest,
    localRequest = httpRequest,
  } = {},
) {
  const start = Date.now(),
    url = new URL(target.url);
  try {
    const local =
      config.allowLoopback &&
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1';
    const addresses = local
      ? ['127.0.0.1']
      : await Promise.race([
          resolve(url.hostname),
          new Promise((_, reject) => {
            const timer = setTimeout(() => reject(Error('DNS timeout')), 5000);
            timer.unref();
          }),
        ]);
    if (!addresses.length || (!local && addresses.some((ip) => !publicV4(ip))))
      throw Error('Destination not public IPv4');
    const body = await new Promise((resolve, reject) => {
      const req = (local ? localRequest : secureRequest)(
        url,
        {
          method: 'GET',
          agent: false,
          rejectUnauthorized: true,
          lookup: (_host, options, callback) =>
            options.all
              ? callback(
                  null,
                  addresses.map((address) => ({ address, family: 4 })),
                )
              : callback(null, addresses[0], 4),
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(Error('HTTP status ' + res.statusCode));
            return;
          }
          const chunks = [];
          let bytes = 0;
          res.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > 16384) {
              res.destroy();
              reject(Error('Response too large'));
            } else chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        },
      );
      req.on('error', reject);
      req.end();
    });
    const value = JSON.parse(body);
    const ready = url.pathname.endsWith('/ready');
    const healthy = ready
      ? value.status === 'ready' &&
        value.dependencies?.postgres === 'up' &&
        value.dependencies?.mongodb === 'up'
      : value.status === 'ok' &&
        value.service === 'fingent360-api' &&
        Number.isFinite(Date.parse(value.timestamp));
    return {
      id: target.id,
      at: new Date().toISOString(),
      ok: healthy,
      latencyMs: Date.now() - start,
      reason: healthy
        ? 'Expected health response'
        : 'Unexpected health response',
    };
  } catch {
    return {
      id: target.id,
      at: new Date().toISOString(),
      ok: false,
      latencyMs: Date.now() - start,
      reason: 'Connection, TLS, status or response validation failed',
    };
  }
}
export function newJournal(config) {
  return {
    version: 1,
    configuration: createHash('sha256')
      .update(JSON.stringify(config.targets))
      .digest('hex'),
    updatedAt: null,
    observations: [],
    incidents: [],
  };
}
export function recordObservation(journal, observation) {
  const next = structuredClone(journal);
  next.updatedAt = observation.at;
  next.observations.push(observation);
  next.observations = next.observations.slice(-10000);
  const open = next.incidents.find(
    (i) => i.target === observation.id && i.recoveredAt === null,
  );
  if (!observation.ok && !open)
    next.incidents.push({
      id: randomUUID(),
      target: observation.id,
      firstFailureAt: observation.at,
      recoveredAt: null,
    });
  if (observation.ok && open) open.recoveredAt = observation.at;
  const active = next.incidents.filter((i) => i.recoveredAt === null),
    resolved = next.incidents
      .filter((i) => i.recoveredAt !== null)
      .slice(-(500 - active.length));
  next.incidents = [...resolved, ...active];
  return next;
}
export async function saveJournal(path, journal) {
  const temp = path + '.' + process.pid + '.tmp';
  await writeFile(temp, JSON.stringify(journal), { mode: 0o600, flush: true });
  await rename(temp, path);
}
export async function readJournal(path, config) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return newJournal(config);
    throw error;
  }
  if (raw.length > 8000000) throw Error('Monitor journal exceeds limit.');
  const value = JSON.parse(raw);
  if (
    value.version !== 1 ||
    value.configuration !== newJournal(config).configuration ||
    !Array.isArray(value.observations) ||
    value.observations.length > 10000 ||
    !Array.isArray(value.incidents) ||
    value.incidents.length > 500
  )
    throw Error(
      'Journal corrupt or targets changed; preserve it and choose a new state file.',
    );
  for (const row of value.observations)
    if (
      !config.targets.some((t) => t.id === row.id) ||
      typeof row.ok !== 'boolean' ||
      !Number.isFinite(Date.parse(row.at)) ||
      !Number.isFinite(row.latencyMs) ||
      typeof row.reason !== 'string'
    )
      throw Error('Journal observation invalid.');
  for (const row of value.incidents)
    if (
      !config.targets.some((t) => t.id === row.target) ||
      typeof row.id !== 'string' ||
      !Number.isFinite(Date.parse(row.firstFailureAt)) ||
      (row.recoveredAt !== null &&
        !Number.isFinite(Date.parse(row.recoveredAt)))
    )
      throw Error('Journal incident invalid.');
  return value;
}
export function monitorView(config, journal, now = Date.now()) {
  return {
    updatedAt: journal.updatedAt,
    intervalSeconds: config.intervalSeconds,
    targets: config.targets.map((t) => {
      const latest = journal.observations.findLast((o) => o.id === t.id);
      return {
        id: t.id,
        status:
          !latest ||
          now < Date.parse(latest.at) ||
          now - Date.parse(latest.at) > config.intervalSeconds * 3000
            ? 'unknown'
            : latest.ok
              ? 'healthy'
              : 'failed',
        latest: latest ?? null,
      };
    }),
    incidents: journal.incidents.slice().reverse(),
    sampleCount: journal.observations.length,
  };
}
