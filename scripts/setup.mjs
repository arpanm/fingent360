import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
const major = Number(process.versions.node.split('.')[0]);
if (major < 24 || major > 26)
  throw new Error('Use Node 24 LTS (or Node 26 for local development).');
try {
  await copyFile(
    new URL('../.env.example', import.meta.url),
    new URL('../.env', import.meta.url),
    constants.COPYFILE_EXCL,
  );
  console.log('Created .env with local development defaults.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
console.log(
  'Next: pnpm install --frozen-lockfile, pnpm db:up, pnpm check, pnpm dev',
);
