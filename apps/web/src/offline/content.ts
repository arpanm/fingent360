import { publicBeaEdition } from '@fingent360/contracts';
import { learningContentItems } from '@fingent360/contracts';
import {
  ResearchFiltersSchema,
  ResearchCatalogSchema,
  researchSelection,
  filterResearchItems,
  buildResearchContext,
  FeedSchema,
  FeedItemSchema,
  DiscoveryIdSchema,
  LearningCatalogSchema,
  type FeedItem,
} from '@fingent360/contracts';
import {
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';

export function published(bundle: OfflineBundle): FeedItem[] {
  return bundle.feed
    .map((v) => FeedItemSchema.parse(v))
    .filter((v) => v.status === 'published');
}
export function filtersFor(req: OfflineRequest) {
  const input = Object.fromEntries(
    ['q', 'kind', 'source', 'topic', 'region', 'view']
      .filter((key) => req.query.has(key))
      .map((key) => [key, req.query.get(key)]),
  );
  const parsed = ResearchFiltersSchema.safeParse(input);
  if (!parsed.success) fail(400, 'Invalid reading filters.');
  return parsed.data;
}
export function filtered(req: OfflineRequest, items: FeedItem[]) {
  return filterResearchItems(items, filtersFor(req));
}
export async function page(
  req: OfflineRequest,
  items: FeedItem[],
  binding: unknown,
) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      binding,
      filtersFor(req),
      items.map((v) => [v.id, v.version]),
    ]),
  );
  const fingerprint = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  let offset = 0;
  const cursor = req.query.get('cursor');
  if (cursor) {
    if (!/^[a-f0-9]{64}_[0-9]+$/.test(cursor))
      fail(400, 'Invalid reading cursor.');
    const [hash, value] = cursor.split('_');
    if (hash !== fingerprint)
      fail(409, 'Feed changed. Refresh from the first page.');
    offset = Number(value);
    if (
      !Number.isSafeInteger(offset) ||
      offset <= 0 ||
      offset % 20 ||
      offset >= items.length
    )
      fail(400, 'Invalid reading cursor.');
  }
  return {
    items: items.slice(offset, offset + 20),
    nextCursor:
      offset + 20 < items.length ? `${fingerprint}_${offset + 20}` : null,
  };
}
export async function handleContent(
  req: OfflineRequest,
  _state: LocalState,
  bundle: OfflineBundle,
): Promise<OfflineResult | undefined> {
  if (req.method !== 'GET') return undefined;
  const p = req.path.replace(/^\/api\/v1/, '');
  if (p === '/discovery/feed')
    return {
      body: FeedSchema.parse({
        ...(await page(
          req,
          researchSelection(published(bundle), filtersFor(req)),
          bundle.generatedAt,
        )),
        evaluatedAt: bundle.generatedAt,
      }),
    };
  if (p === '/discovery/catalog') {
    if (!bundle.researchCatalog)
      fail(
        503,
        'This snapshot predates source filters. Install the latest app update.',
      );
    return { body: ResearchCatalogSchema.parse(bundle.researchCatalog) };
  }
  if (p === '/learning/catalog')
    return {
      body: LearningCatalogSchema.parse({ items: learningContentItems }),
    };
  if (p === '/macro') return { body: bundle.macro };
  if (p === '/sources') return { body: bundle.sources };
  const history = p.match(/^\/macro\/([^/]+)\/history\/([^/]+)$/);
  if (history) {
    const value = bundle.macroHistory[`${history[1]}/${history[2]}`];
    if (!value)
      fail(
        404,
        'This historical period is not included in the offline snapshot.',
      );
    return { body: value };
  }
  const evidence = p.match(/^\/macro\/evidence\/([^/]+)$/);
  if (evidence) {
    const value = bundle.macroEvidence[evidence[1]!];
    if (!value) fail(404, 'Evidence is not bundled for offline reading.');
    return { body: value };
  }
  const item = p.match(
    /^\/discovery\/items\/([^/]+)(?:\/(history|evidence|media|context))?$/,
  );
  if (item) {
    const id = DiscoveryIdSchema.parse(decodeURIComponent(item[1]!));
    const current = bundle.feed.find(
      (v) => v.id === id && v.status !== 'draft',
    );
    if (!current) fail(404, 'Published item is not included in this snapshot.');
    const action = item[2];
    if (!action) return { body: publicBeaEdition(current) };
    if (action === 'history')
      return {
        body: (bundle.histories[id] ?? [current]).map((v) =>
          publicBeaEdition(
            FeedItemSchema.parse(v),
            current.status === 'withdrawn',
          ),
        ),
      };
    if (id.startsWith('bea-') && current.status !== 'published')
      fail(404, 'BEA release evidence is unavailable or withdrawn.');
    if (
      (action === 'media' || action === 'context') &&
      current.status !== 'published'
    )
      fail(404, 'Source item was withdrawn.');
    if (action === 'context')
      return { body: buildResearchContext(current, published(bundle)) };
    const value = action === 'media' ? bundle.media[id] : bundle.evidence[id];
    if (!value)
      fail(
        404,
        `${action === 'media' ? 'Reviewed visual' : 'Source evidence'} is not bundled for this item.`,
      );
    return { body: value };
  }
  return undefined;
}
