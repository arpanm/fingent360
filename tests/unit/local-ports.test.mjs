import assert from 'node:assert/strict';
import { test } from 'node:test';
import net from 'node:net';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import {
  availablePort,
  databaseUrls,
  updateLocalEnv,
  localOrigin,
} from '../../scripts/local-ports.mjs';

test('occupied listener remains alive while a different port is selected', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const occupied = server.address().port;
    const chosen = await availablePort(occupied);
    assert.notEqual(chosen, occupied);
    assert.equal(server.listening, true);
    assert.notEqual(
      await availablePort(chosen, '127.0.0.1', new Set([chosen])),
      chosen,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('database mapping changes preserve credentials, database and query parameters', () => {
  const result = databaseUrls(
    {
      DATABASE_URL:
        'postgresql://user:fakepass@127.0.0.1:55432/local?sslmode=disable',
      MONGODB_URI:
        'mongodb://user:fakepass@127.0.0.1:57017/local?authSource=admin',
    },
    55433,
    57018,
  );
  assert.equal(new URL(result.DATABASE_URL).port, '55433');
  assert.equal(new URL(result.DATABASE_URL).password, 'fakepass');
  assert.equal(new URL(result.MONGODB_URI).search, '?authSource=admin');
  assert.throws(() =>
    databaseUrls(
      {
        DATABASE_URL: 'postgresql://remote.example/db',
        MONGODB_URI: 'mongodb://localhost/db',
      },
      1,
      2,
    ),
  );
});
test('selected env values update without changing unrelated configuration', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'f360-ports-'));
  const file = path.join(dir, '.env');
  try {
    await writeFile(file, '# preserve\nSECRET="fake $ value"\nAPI_PORT=4100\n');
    await updateLocalEnv(
      { API_PORT: '4101', WEB_ORIGIN: 'http://127.0.0.1:5174' },
      file,
    );
    const content = await readFile(file, 'utf8');
    const env = parseEnv(content);
    assert.equal(env.API_PORT, '4101');
    assert.equal(env.WEB_ORIGIN, 'http://127.0.0.1:5174');
    assert.equal(env.SECRET, 'fake $ value');
    assert.ok(content.startsWith('# preserve'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('test target validation rejects remote or credential-bearing URLs', () => {
  assert.equal(localOrigin('http://127.0.0.1:5174'), 'http://127.0.0.1:5174');
  assert.throws(() => localOrigin('http://user:fakepass@localhost:5174'));
  assert.throws(() => localOrigin('https://example.com'));
});
