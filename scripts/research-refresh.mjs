import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import {
  ResearchRunsSchema,
  ResearchCatalogSchema,
  ResearchRefreshInputSchema,
  DiscoveryOperationsSchema,
  DiscoveryRunSchema,
  FeedItemSchema,
  sourceIdFor,
} from '../packages/contracts/dist/index.js';
const env = {
  ...parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8')),
  ...process.env,
};
const args = process.argv.slice(2),
  publish = args.includes('--publish');
const sources = args
  .find((v) => v.startsWith('--sources='))
  ?.slice(10)
  .split(',');
const note = args.find((v) => v.startsWith('--note='))?.slice(7);
if (
  args.some(
    (v) =>
      v !== '--publish' &&
      !v.startsWith('--sources=') &&
      !v.startsWith('--note='),
  )
)
  throw Error('Use --sources=id,id [--publish --note="review basis"].');
if (!sources?.length)
  throw Error('Choose explicit --sources=id,id. No sources were fetched.');
if (publish && (!note?.trim() || note.length > 2000))
  throw Error(
    '--publish requires a non-empty --note describing your review basis (maximum2000 characters).',
  );
const input = ResearchRefreshInputSchema.parse({ sourceIds: sources });
if (!/^[a-f0-9]{64}$/.test(env.RESEARCH_ADMIN_TOKEN ?? ''))
  throw Error('Configure the local RESEARCH_ADMIN_TOKEN first.');
if (!/^\d+$/.test(env.API_PORT ?? '')) throw Error('Configure API_PORT first.');
const base = `http://127.0.0.1:${env.API_PORT}/api/v1`,
  origin = new URL(env.WEB_ORIGIN).origin;
let cookie = '';
async function request(path, body, method = 'GET') {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(300000),
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw Error(
      `Research operation ${path} failed with HTTP ${response.status}. Inspect local operations status; no request is automatically retried.`,
    );
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  return data;
}
const catalog = ResearchCatalogSchema.parse(
  await request('/discovery/catalog'),
);
for (const id of input.sourceIds ?? [])
  if (!catalog.sources.some((s) => s.id === id && s.access === 'enabled'))
    throw Error(`Source ${id} is not enabled. No refresh started.`);
await request('/ops/session', { key: env.RESEARCH_ADMIN_TOKEN }, 'POST');
try {
  const before = DiscoveryOperationsSchema.parse(
    await request('/ops/discovery/items'),
  );
  const run = DiscoveryRunSchema.parse(
    await request('/ops/discovery/refresh', input, 'POST'),
  );
  console.log(`${run.status}: ${run.message}`);
  const outcomes = ResearchRunsSchema.parse(
    await request('/ops/discovery/runs'),
  ).runs.filter((value) => value.runId === run.id);
  for (const outcome of outcomes)
    console.log(`${outcome.sourceId}: ${outcome.status}; ${outcome.message}`);
  if (outcomes.some((value) => value.status !== 'succeeded'))
    process.exitCode = 1;
  const after = DiscoveryOperationsSchema.parse(
    await request('/ops/discovery/items'),
  );
  const drafts = after.items.filter(
    (item) =>
      item.status === 'draft' &&
      input.sourceIds?.includes(sourceIdFor(item)) &&
      !before.items.some(
        (old) => old.id === item.id && old.version === item.version,
      ),
  );
  console.log(
    `${drafts.length} new or changed drafts in the selected sources. ${publish ? 'Explicit publication requested.' : 'Open #ops to review; nothing was published.'}`,
  );
  if (publish)
    for (const item of drafts) {
      try {
        FeedItemSchema.parse(
          await request(
            `/ops/discovery/items/${item.id}`,
            {
              expectedVersion: item.version,
              status: 'published',
              correctionNote: note.trim(),
            },
            'PUT',
          ),
        );
        console.log(
          `Published ${item.id} from reviewed draft version ${item.version}.`,
        );
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  if (run.status !== 'succeeded') process.exitCode = 1;
} finally {
  await request('/ops/session', undefined, 'DELETE').catch(() =>
    console.error(
      'Session cleanup failed; the short-lived session will expire.',
    ),
  );
}
