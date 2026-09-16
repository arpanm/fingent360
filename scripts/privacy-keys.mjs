import { randomBytes } from 'node:crypto';
import { lstat, readFile, open, rename, unlink, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const names = [
  'PRIVATE_DATA_ACTIVE_KEY',
  'PRIVATE_DATA_KEYS',
  'PRIVATE_IDENTITY_LOOKUP_KEY',
];
const invalid = () =>
  new Error(
    'Existing private key settings are invalid or ambiguous. Correct them locally; no keys were replaced.',
  );
export function keyPlan(content, mode = 'setup', entropy = randomBytes) {
  if (!['setup', 'status', 'rotate', 'add-identity-key'].includes(mode))
    throw new Error(
      'Use no option, --status, --rotate, or --add-identity-key.',
    );
  let env;
  try {
    env = parseEnv(content);
  } catch {
    throw invalid();
  }
  const lines = content.split(/\r?\n/);
  const positions = new Map();
  for (const name of names) {
    const pattern = new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=');
    const found = lines.flatMap((line, index) =>
      pattern.test(line) ? [index] : [],
    );
    if (found.length > 1) throw invalid();
    if (found.length) {
      let single;
      try {
        single = parseEnv(lines[found[0]])[name];
      } catch {
        throw invalid();
      }
      if (single !== env[name]) throw invalid();
      positions.set(name, found[0]);
    }
  }
  let active = env.PRIVATE_DATA_ACTIVE_KEY || '',
    ring = {};
  if (active || env.PRIVATE_DATA_KEYS) {
    try {
      ring = JSON.parse(env.PRIVATE_DATA_KEYS || '');
      if (!ring || typeof ring !== 'object' || Array.isArray(ring))
        throw invalid();
      const entries = Object.entries(ring);
      if (
        !/^[A-Za-z0-9_-]{1,40}$/.test(active) ||
        !Object.hasOwn(ring, active) ||
        entries.length < 1 ||
        entries.length > 10
      )
        throw invalid();
      for (const [id, value] of entries) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || typeof value !== 'string')
          throw invalid();
        const bytes = Buffer.from(value, 'base64');
        if (bytes.length !== 32 || bytes.toString('base64') !== value)
          throw invalid();
      }
    } catch {
      throw invalid();
    }
  }
  let lookup = env.PRIVATE_IDENTITY_LOOKUP_KEY || '';
  if (
    lookup &&
    (!active ||
      Buffer.from(lookup, 'base64').length !== 32 ||
      Buffer.from(lookup, 'base64').toString('base64') !== lookup)
  )
    throw invalid();
  if (
    mode === 'status' ||
    (active && mode === 'setup') ||
    (mode === 'add-identity-key' && lookup)
  )
    return {
      content,
      changed: false,
      configured: Boolean(active),
      active,
      count: Object.keys(ring).length,
      identityConfigured: Boolean(lookup),
    };
  if ((mode === 'rotate' || mode === 'add-identity-key') && !active)
    throw new Error('No configured key ring. Run pnpm privacy:keys first.');
  if (mode === 'rotate' && !lookup)
    throw new Error(
      'Identity lookup key is missing. Restore it if identity encryption was used; otherwise initialize once with --add-identity-key before migration081.',
    );
  if (mode !== 'add-identity-key') {
    if (Object.keys(ring).length >= 10)
      throw new Error(
        'Ten keys are retained. Confirm full record/history/backup rewrap before manual retirement; no keys were removed.',
      );
    const id = 'local_' + entropy(12).toString('hex');
    if (Object.hasOwn(ring, id))
      throw new Error('New key identifier collision. Retry; no changes made.');
    ring = { ...ring, [id]: entropy(32).toString('base64') };
    active = id;
  }
  if (!lookup) lookup = entropy(32).toString('base64');
  const replacements = {
    PRIVATE_DATA_ACTIVE_KEY: active,
    PRIVATE_DATA_KEYS: `'${JSON.stringify(ring)}'`,
    PRIVATE_IDENTITY_LOOKUP_KEY: lookup,
  };
  for (const name of names) {
    const line = `${name}=${replacements[name]}`;
    if (positions.has(name)) lines[positions.get(name)] = line;
    else lines.push(line);
  }
  return {
    content: lines.join('\n').replace(/\n*$/, '\n'),
    changed: true,
    configured: true,
    active,
    count: Object.keys(ring).length,
    identityConfigured: true,
  };
}

export async function configureLocalKeys(path, mode = 'setup') {
  const lockPath = path + '.privacy-key.lock',
    tempPath = path + '.privacy-key-' + randomBytes(8).toString('hex') + '.tmp';
  let lock,
    tempExists = false;
  try {
    if (mode !== 'status') {
      try {
        lock = await open(lockPath, 'wx', 0o600);
      } catch {
        throw new Error(
          'Key setup is locked. Finish the other invocation; inspect a stale .env.privacy-key.lock locally.',
        );
      }
    }
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
      throw new Error(
        'Key setup requires a regular, non-linked local .env file.',
      );
    const original = await readFile(path, 'utf8'),
      plan = keyPlan(original, mode);
    if (plan.changed) {
      const temp = await open(tempPath, 'wx', 0o600);
      tempExists = true;
      try {
        await temp.writeFile(plan.content);
        await temp.sync();
      } finally {
        await temp.close();
      }
      const now = await lstat(path);
      if (
        !now.isFile() ||
        now.isSymbolicLink() ||
        now.ino !== info.ino ||
        now.nlink !== 1 ||
        (await readFile(path, 'utf8')) !== original
      )
        throw new Error(
          '.env changed during key setup. Retry after other configuration writers finish.',
        );
      await rename(tempPath, path);
      tempExists = false;
    } else if (mode !== 'status') await chmod(path, 0o600);
    return {
      changed: plan.changed,
      configured: plan.configured,
      active: plan.active,
      count: plan.count,
      identityConfigured: plan.identityConfigured,
    };
  } finally {
    if (tempExists) await unlink(tempPath).catch(() => {});
    if (lock) {
      await lock.close();
      await unlink(lockPath);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.length > 1 ||
      (args.length &&
        !['--status', '--rotate', '--add-identity-key'].includes(args[0]))
    )
      throw new Error(
        'Usage: pnpm privacy:keys [--status | --rotate | --add-identity-key]',
      );
    const result = await configureLocalKeys(
      fileURLToPath(new URL('../.env', import.meta.url)),
      args[0]?.slice(2) || 'setup',
    );
    console.log(
      result.configured
        ? `Private key ring: active ${result.active}; ${result.count} retained key(s). Values are not printed.`
        : 'Private key ring is not configured. Run pnpm privacy:keys to create it.',
    );
    console.log(
      result.identityConfigured
        ? 'Stable identity lookup key configured; payload rotation preserves it.'
        : 'Identity lookup key missing. Restore a lost key; use --add-identity-key only for first identity-encryption rollout.',
    );
    if (args[0] !== '--status')
      console.log(
        'Restart the API to load configuration. Preserve old keys and secure backups; this command does not rewrap database records.',
      );
  } catch (error) {
    console.error(
      error?.code
        ? 'Cannot safely access local .env. Check that bootstrap created it and inspect file permissions; no secret values are printed.'
        : error instanceof Error
          ? error.message
          : 'Private key setup failed.',
    );
    process.exitCode = 1;
  }
}
