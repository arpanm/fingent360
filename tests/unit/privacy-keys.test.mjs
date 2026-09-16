import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readFile,
  lstat,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { keyPlan, configureLocalKeys } from '../../scripts/privacy-keys.mjs';

test('first setup preserves unrelated settings and repeated setup preserves every key', () => {
  const original =
    '# synthetic configuration\nDATABASE_URL=postgres://synthetic\nANOTHER="keep this"\n';
  const first = keyPlan(original),
    values = parseEnv(first.content);
  assert.match(first.content, /DATABASE_URL=postgres:\/\/synthetic/);
  assert.equal(values.ANOTHER, 'keep this');
  assert.equal(
    Buffer.from(
      JSON.parse(values.PRIVATE_DATA_KEYS)[values.PRIVATE_DATA_ACTIVE_KEY],
      'base64',
    ).length,
    32,
  );
  assert.equal(keyPlan(first.content).content, first.content);
  const rotated = keyPlan(first.content, 'rotate'),
    next = parseEnv(rotated.content);
  assert.notEqual(next.PRIVATE_DATA_ACTIVE_KEY, values.PRIVATE_DATA_ACTIVE_KEY);
  assert.equal(
    JSON.parse(next.PRIVATE_DATA_KEYS)[values.PRIVATE_DATA_ACTIVE_KEY],
    JSON.parse(values.PRIVATE_DATA_KEYS)[values.PRIVATE_DATA_ACTIVE_KEY],
  );
  assert.equal(rotated.count, 2);
  assert.equal(
    next.PRIVATE_IDENTITY_LOOKUP_KEY,
    values.PRIVATE_IDENTITY_LOOKUP_KEY,
  );
});

test('invalid, duplicate and multiline key settings never get replaced', () => {
  const generated = keyPlan('').content;
  for (const content of [
    'PRIVATE_DATA_KEYS=not-json\n',
    generated + 'PRIVATE_DATA_ACTIVE_KEY=second\n',
    'PRIVATE_DATA_ACTIVE_KEY=missing\nPRIVATE_DATA_KEYS={}\n',
    'PRIVATE_DATA_ACTIVE_KEY=key\nPRIVATE_DATA_KEYS=\'{"key":"broken"}\'\n',
    'PRIVATE_DATA_ACTIVE_KEY=key\nPRIVATE_DATA_KEYS=\'{\n"key":"' +
      Buffer.alloc(32, 1).toString('base64') +
      '"}\'\n',
  ])
    assert.throws(() => keyPlan(content), /invalid or ambiguous/);
  assert.throws(() => keyPlan('', 'rotate'), /first/);
  const full = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      'key' + i,
      Buffer.alloc(32, i).toString('base64'),
    ]),
  );
  assert.throws(
    () =>
      keyPlan(
        `PRIVATE_DATA_ACTIVE_KEY=key0\nPRIVATE_DATA_KEYS='${JSON.stringify(full)}'\nPRIVATE_IDENTITY_LOOKUP_KEY=${Buffer.alloc(32, 11).toString('base64')}\n`,
        'rotate',
      ),
    /Ten keys/,
  );
});

test('existing payload ring cannot silently recreate a missing identity key', () => {
  const original = keyPlan('').content;
  const missing = original.replace(/^PRIVATE_IDENTITY_LOOKUP_KEY=.*\n/gm, '');
  assert.equal(keyPlan(missing).content, missing);
  assert.equal(keyPlan(missing, 'status').identityConfigured, false);
  assert.throws(() => keyPlan(missing, 'rotate'), /Restore/);
  const initialized = keyPlan(missing, 'add-identity-key');
  assert.equal(
    parseEnv(initialized.content).PRIVATE_DATA_KEYS,
    parseEnv(missing).PRIVATE_DATA_KEYS,
  );
  assert.equal(initialized.identityConfigured, true);
  assert.equal(keyPlan(initialized.content, 'add-identity-key').changed, false);
  assert.throws(
    () => keyPlan(original + 'PRIVATE_IDENTITY_LOOKUP_KEY=broken\n'),
    /invalid/,
  );
});

test('filesystem setup is restrictive and status does not rewrite config or expose secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fingent-key-test-')),
    path = join(directory, '.env');
  try {
    await writeFile(path, 'UNRELATED=synthetic\n', { mode: 0o644 });
    const initial = await configureLocalKeys(path);
    const content = await readFile(path, 'utf8'),
      info = await lstat(path);
    assert.equal(info.mode & 0o777, 0o600);
    assert.equal(initial.configured, true);
    const status = await configureLocalKeys(path, 'status');
    assert.equal(status.changed, false);
    assert.equal(await readFile(path, 'utf8'), content);
    const secret = JSON.parse(parseEnv(content).PRIVATE_DATA_KEYS)[
      initial.active
    ];
    assert.equal(JSON.stringify(status).includes(secret), false);
    assert.equal((await configureLocalKeys(path, 'rotate')).count, 2);
    await writeFile(path + '.privacy-key.lock', '');
    await assert.rejects(() => configureLocalKeys(path), /locked/);
    assert.equal((await lstat(path + '.privacy-key.lock')).isFile(), true);
    const link = join(directory, '.env.link');
    await symlink(path, link);
    await assert.rejects(() => configureLocalKeys(link), /non-linked/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
