import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import {
  FeedSchema,
  ResearchCatalogSchema,
  FeedItemSchema,
  MacroDashboardSchema,
  LearningCatalogSchema,
  CatalogSchema,
  MediaAssetSchema,
} from '../packages/contracts/dist/index.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const local = existsSync(envPath)
  ? parseEnv(readFileSync(envPath, 'utf8'))
  : {};
const origin = new URL(
  process.env.OFFLINE_SOURCE_API ||
    `http://127.0.0.1:${process.env.API_PORT || local.API_PORT || 4100}`,
);
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw Error('Snapshot export requires a loopback API origin.');
async function get(path, optional = false) {
  const response = await fetch(`${origin.origin}/api/v1${path}`, {
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  if (optional && response.status === 404) return undefined;
  if (!response.ok)
    throw Error(`Public snapshot ${path}: HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw Error('Snapshot response too large.');
  return JSON.parse(text);
}
const bundle = {
  generatedAt: new Date().toISOString(),
  feed: [],
  histories: {},
  evidence: {},
  macro: null,
  macroHistory: {},
  macroEvidence: {},
  sources: [],
  researchCatalog: null,
  learningCatalog: null,
  journeyCatalog: null,
  media: {},
};
let cursor = null;
do {
  const page = FeedSchema.parse(
    await get(
      `/discovery/feed?view=explore${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  );
  bundle.feed.push(...page.items.filter((item) => item.status === 'published'));
  cursor = page.nextCursor;
  if (bundle.feed.length > 2000)
    throw Error(
      'Snapshot has more than 2000 published items. Narrow the supported corpus before bundling.',
    );
} while (cursor);
for (const item of bundle.feed) {
  const history = await get(
    `/discovery/items/${encodeURIComponent(item.id)}/history`,
  );
  bundle.histories[item.id] = history
    .map((v) => FeedItemSchema.parse(v))
    .filter((v) => v.status === 'published');
  if (item.sourceHash) {
    const evidence = await get(
      `/discovery/items/${encodeURIComponent(item.id)}/evidence`,
      true,
    );
    if (evidence) bundle.evidence[item.id] = evidence;
  }
  const media = await get(
    `/discovery/items/${encodeURIComponent(item.id)}/media`,
    true,
  );
  if (media) bundle.media[item.id] = MediaAssetSchema.parse(media);
}
bundle.macro = MacroDashboardSchema.parse(await get('/macro'));
for (const source of bundle.macro.sources)
  for (const observation of source.observations) {
    bundle.macroHistory[`${source.indicator}/${observation.year}`] = await get(
      `/macro/${source.indicator}/history/${observation.year}`,
    );
    if (!bundle.macroEvidence[observation.sourceHash])
      bundle.macroEvidence[observation.sourceHash] = await get(
        `/macro/evidence/${observation.sourceHash}`,
      );
  }
bundle.sources = await get('/sources');
bundle.researchCatalog = ResearchCatalogSchema.parse(
  await get('/discovery/catalog'),
);
bundle.learningCatalog = LearningCatalogSchema.parse(
  await get('/learning/catalog'),
);
bundle.journeyCatalog = CatalogSchema.parse(await get('/journey/catalog'));
const directory = fileURLToPath(
  new URL('../apps/web/src/offline/', import.meta.url),
);
await mkdir(directory, { recursive: true });
await writeFile(
  `${directory}content-bundle.json`,
  JSON.stringify(bundle, null, 2) + '\n',
);
console.log(
  `Bundled ${bundle.feed.length} published items, ${Object.keys(bundle.macroHistory).length} annual histories, ${Object.keys(bundle.media).length} reviewed visuals at ${bundle.generatedAt}. Only public GET routes were used.`,
);
