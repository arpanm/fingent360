import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
export async function operatorKey(): Promise<string> {
  // Called only inside manually executed tests. Never print the token or env file.
  const env = parseEnv(
    await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
  );
  const token = env.RESEARCH_ADMIN_TOKEN;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Error(
      'Run pnpm research:setup and restart the API before real-data tests.',
    );
  return token;
}
