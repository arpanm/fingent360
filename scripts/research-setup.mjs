import { chmod, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
const path = new URL('../.env', import.meta.url);
const existing = await readFile(path, 'utf8');
const value = parseEnv(existing).RESEARCH_ADMIN_TOKEN;
if (value) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Existing RESEARCH_ADMIN_TOKEN is invalid; correct it locally. No changes made.');
  console.log('Existing research operator key preserved.');
} else {
  const content = existing.replace(/^RESEARCH_ADMIN_TOKEN=.*$/gm, '');
  await writeFile(path, `${content.trimEnd()}\nRESEARCH_ADMIN_TOKEN=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  console.log('Research operator key saved in .env; key is not printed. Restart the API to load it.');
}

await chmod(path, 0o600);
