import { createServer, type Socket } from 'node:net';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { connect } from 'node:net';
import { test, expect } from '@playwright/test';
import type { Readiness } from '../../../../packages/contracts/src/index';

// The gate only cuts this test's TCP sockets. It never stops shared databases,
// changes application configuration, or inserts/deletes application data.
test('E2E-API-2302 Mongo readiness recovers after first-connect and established outages without process restart @READINESS-RECOVERY-001 @TEST-SIMULATION', async () => {
  test.setTimeout(60000);
  const env = {
    ...parseEnv(
      await readFile(new URL('../../../../.env', import.meta.url), 'utf8'),
    ),
    ...process.env,
  };
  const mongo = new URL(env.MONGODB_URI ?? '');
  const postgres = new URL(env.DATABASE_URL ?? '');
  for (const uri of [mongo, postgres]) {
    expect(['localhost', '127.0.0.1', '[::1]']).toContain(uri.hostname);
  }
  expect(mongo.protocol).toBe('mongodb:');
  const targetPort = Number(mongo.port || '27017');
  const targetHost = mongo.hostname.replace(/^\[|\]$/g, '');
  let available = false;
  let connections = 0;
  const sockets = new Set<Socket>();
  const retain = (socket: Socket) => {
    sockets.add(socket);
    socket.on('error', () => socket.destroy());
    socket.on('close', () => sockets.delete(socket));
  };
  const gate = createServer((client) => {
    connections++;
    retain(client);
    if (!available) {
      client.destroy();
      return;
    }
    const upstream = connect(targetPort, targetHost);
    retain(upstream);
    client.once('close', () => upstream.destroy());
    upstream.once('close', () => client.destroy());
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>((resolve, reject) => {
    gate.once('error', reject);
    gate.listen(0, '127.0.0.1', resolve);
  });
  let probe:
    { check(): Promise<Readiness>; close(): Promise<void> } | undefined;
  try {
    const address = gate.address();
    if (!address || typeof address === 'string')
      throw Error('Missing test TCP gate.');
    mongo.hostname = '127.0.0.1';
    mongo.port = String(address.port);
    mongo.searchParams.set('directConnection', 'true');
    const { DatabaseProbe } = await import(
      new URL('../../../../apps/api/dist/readiness.js', import.meta.url).href
    );
    const { readConfig } = await import(
      new URL('../../../../apps/api/dist/config.js', import.meta.url).href
    );
    const actual: NonNullable<typeof probe> = new DatabaseProbe(
      readConfig({ ...env, MONGODB_URI: mongo.href }),
    );
    probe = actual;
    const first = await actual.check();
    expect(first).toEqual({
      status: 'unavailable',
      dependencies: { postgres: 'up', mongodb: 'down' },
    });
    available = true;
    await expect
      .poll(() => actual.check(), { timeout: 15000 })
      .toEqual({
        status: 'ready',
        dependencies: { postgres: 'up', mongodb: 'up' },
      });
    available = false;
    for (const socket of sockets) socket.destroy();
    await expect.poll(() => actual.check(), { timeout: 10000 }).toEqual(first);
    available = true;
    await expect
      .poll(() => actual.check(), { timeout: 15000 })
      .toEqual({
        status: 'ready',
        dependencies: { postgres: 'up', mongodb: 'up' },
      });
    // Concurrent callers share the probe, and shutdown cannot race a reconnect.
    const pending = actual.check();
    expect(actual.check()).toBe(pending);
    await Promise.all([pending, actual.close(), actual.close()]);
    const afterClose = connections;
    expect(await actual.check()).toEqual({
      status: 'unavailable',
      dependencies: { postgres: 'down', mongodb: 'down' },
    });
    expect(connections).toBe(afterClose);
  } finally {
    await probe?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      gate.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
