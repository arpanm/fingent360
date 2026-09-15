import { captureIdentitySelections } from './identity-selection-snapshot.mjs';
import { captureEvents } from './event-snapshot.mjs';
import { captureEventLineage } from './event-lineage-snapshot.mjs';
import { finalizePublicSnapshot } from './lib/finalize-public-snapshot.mjs';
import { captureEcbRates } from './ecb-rate-snapshot.mjs';
import { captureOilBenchmarks } from './oil-benchmark-snapshot.mjs';
import { captureEcbFx } from './ecb-fx-snapshot.mjs';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import {
  EquitySnapshotSchema,
  EventScenarioSnapshotSchema,
  FundsSnapshotSchema,
  ReleaseCalendarSchema,
  FeedSchema,
  ResearchCatalogSchema,
  FeedItemSchema,
  MacroDashboardSchema,
  LearningCatalogSchema,
  CatalogSchema,
  MediaAssetSchema,
  SecurityDirectorySchema,
  SecurityHistorySchema,
  SecurityEvidenceSchema,
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
let bundle = {
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
  securities: null,
  securityHistories: {},
  securityEvidence: {},
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
    .filter((v) => v.status !== 'draft');
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
bundle.securities = SecurityDirectorySchema.parse(await get('/securities'));
if (bundle.securities.limited)
  throw Error(
    'Narrow the supported identity corpus before bundling more than 200 identities.',
  );
for (const identity of bundle.securities.items) {
  const history = SecurityHistorySchema.parse(
    await get(`/securities/${identity.isin}/history`),
  );
  bundle.securityHistories[identity.isin] = history;
  for (const edition of history.revisions) {
    bundle.securityEvidence[edition.sourceHash] = SecurityEvidenceSchema.parse(
      await get(`/securities/${identity.isin}/evidence/${edition.sourceHash}`),
    );
  }
}
bundle.researchCatalog = ResearchCatalogSchema.parse(
  await get('/discovery/catalog'),
);
bundle.learningCatalog = LearningCatalogSchema.parse(
  await get('/learning/catalog'),
);
bundle.journeyCatalog = CatalogSchema.parse(await get('/journey/catalog'));
bundle = finalizePublicSnapshot(
  bundle,
  await get('/discovery/publication-manifest'),
);
Object.assign(bundle, await captureEcbRates(get));
Object.assign(bundle, await captureOilBenchmarks(get));
Object.assign(bundle, await captureEcbFx(get));
Object.assign(bundle, {
  eventScenarios: EventScenarioSnapshotSchema.parse(
    await get('/event-scenarios/snapshot'),
  ),
});
Object.assign(bundle, {
  fundsBonds: FundsSnapshotSchema.parse(await get('/funds/snapshot')),
});
Object.assign(bundle, {
  researchCalendar: ReleaseCalendarSchema.parse(
    await get('/research-calendar'),
  ),
});
Object.assign(bundle, {
  equityCoverage: EquitySnapshotSchema.parse(await get('/equities/snapshot')),
});
Object.assign(bundle, await captureIdentitySelections(get, bundle.securities));
Object.assign(bundle, await captureEvents(get, bundle));
bundle.eventLineage = await captureEventLineage(get, bundle.events);
const directory = fileURLToPath(
  new URL('../apps/web/src/offline/', import.meta.url),
);
await mkdir(directory, { recursive: true });
await writeFile(
  `${directory}content-bundle.json.tmp`,
  JSON.stringify(bundle, null, 2) + '\n',
);
await rename(
  `${directory}content-bundle.json.tmp`,
  `${directory}content-bundle.json`,
);
console.log(
  `Bundled ${bundle.feed.length} published items, ${Object.keys(bundle.macroHistory).length} annual histories, ${Object.keys(bundle.media).length} reviewed visuals at ${bundle.generatedAt}. Only public GET routes were used.`,
);
