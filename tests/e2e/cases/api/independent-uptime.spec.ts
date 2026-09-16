import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('E2E-API-1650 independent observer retains actual outage and recovery across journal reopen without API database @DEV-021 @TEST-SIMULATION', async () => {
  const core = await import(
    new URL('../../../../scripts/uptime-core.mjs', import.meta.url).href
  );
  let up = false;
  const server = createServer((_req, res) => {
    res.writeHead(up ? 200 : 503, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        status: up ? 'ok' : 'unavailable',
        service: 'fingent360-api',
        timestamp: new Date().toISOString(),
      }),
    );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw Error('Fixture listener absent');
  const dir = await mkdtemp(join(tmpdir(), 'f360-uptime-')),
    path = join(dir, 'journal.json');
  try {
    const config = core.parseUptimeConfig({
      allowLoopback: true,
      targets: [
        {
          id: 'owned-api',
          url: `http://127.0.0.1:${address.port}/api/v1/health`,
        },
      ],
    });
    let journal = core.newJournal(config);
    journal = core.recordObservation(
      journal,
      await core.probeTarget(config.targets[0], config),
    );
    expect(journal.incidents).toHaveLength(1);
    expect(journal.incidents[0].recoveredAt).toBeNull();
    await core.saveJournal(path, journal);
    journal = await core.readJournal(path, config);
    up = true;
    journal = core.recordObservation(
      journal,
      await core.probeTarget(config.targets[0], config),
    );
    expect(journal.incidents[0].recoveredAt).not.toBeNull();
    expect(core.monitorView(config, journal).targets[0].status).toBe('healthy');
    expect(
      core.monitorView(config, journal, Date.now() + 240000).targets[0].status,
    ).toBe('unknown');
    await writeFile(path, 'broken');
    await expect(core.readJournal(path, config)).rejects.toThrow();
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    await rm(dir, { recursive: true, force: true });
  }
});
test('E2E-API-1651 independent observer rejects unsafe config private DNS redirect and misleading status @DEV-021 @TEST-SIMULATION', async () => {
  const core = await import(
    new URL('../../../../scripts/uptime-core.mjs', import.meta.url).href
  );
  for (const url of [
    'http://example.com/api/v1/health',
    'https://example.com/private',
    'https://u:p@example.com/api/v1/health',
    'https://example.com/api/v1/health?target=bad',
  ])
    expect(() =>
      core.parseUptimeConfig({ targets: [{ id: 'a', url }] }),
    ).toThrow();
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '224.0.0.1',
    '100.64.0.1',
  ])
    expect(core.publicV4(ip)).toBe(false);
  const config = core.parseUptimeConfig({
    targets: [{ id: 'a', url: 'https://example.com/api/v1/health' }],
  });
  let calls = 0;
  const result = await core.probeTarget(config.targets[0], config, {
    resolve: async () => ['127.0.0.1'],
    secureRequest: () => {
      calls++;
      throw Error('Must not connect');
    },
  });
  expect(result.ok).toBe(false);
  expect(calls).toBe(0);
  let redirect = false;
  const server = createServer((_req, res) => {
    res
      .writeHead(redirect ? 302 : 200, {
        'Content-Type': 'application/json',
        Location: 'http://127.0.0.1/private',
      })
      .end(JSON.stringify({ status: 'ok' }));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  try {
    const address = server.address();
    if (!address || typeof address === 'string')
      throw Error('Fixture listener absent');
    const local = core.parseUptimeConfig({
      allowLoopback: true,
      targets: [
        { id: 'local', url: `http://127.0.0.1:${address.port}/api/v1/health` },
      ],
    });
    expect((await core.probeTarget(local.targets[0], local)).ok).toBe(false);
    redirect = true;
    expect((await core.probeTarget(local.targets[0], local)).ok).toBe(false);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
