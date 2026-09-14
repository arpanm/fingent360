import {
  currentPublications,
  publicEdition,
  editionEvidence,
  PublicationManifestSchema,
  MediaAssetSchema,
  EvidenceExplanationQuerySchema,
  explainEdition,
} from '@fingent360/contracts';
import { learningContentItems } from '@fingent360/contracts';
import {
  ResearchFiltersSchema,
  ResearchCatalogSchema,
  researchSelection,
  filterResearchItems,
  buildResearchContext,
  FeedSchema,
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
  return currentPublications(bundle.feed, bundle.histories).filter(
    (v) => v.status === 'published',
  );
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
  if (p === '/discovery/publication-manifest')
    return {
      body: PublicationManifestSchema.parse({
        admittedAt: bundle.generatedAt,
        items: published(bundle).map((v) => {
          const parsed = MediaAssetSchema.safeParse(bundle.media[v.id]);
          const asset = parsed.success ? parsed.data : null;
          return {
            id: v.id,
            version: v.version,
            mediaId:
              asset?.itemId === v.id &&
              asset.itemVersion === v.version &&
              asset.status === 'published'
                ? asset.id
                : null,
          };
        }),
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
    /^\/discovery\/items\/([^/]+)(?:\/(history|evidence|media|context|explanation))?$/,
  );
  if (item) {
    const id = DiscoveryIdSchema.parse(decodeURIComponent(item[1]!));
    const explanationQuery =
      item[2] === 'explanation'
        ? EvidenceExplanationQuerySchema.safeParse(
            Object.fromEntries(req.query),
          )
        : null;
    if (
      item[2] === 'explanation' &&
      req.query.getAll('expectedVersion').length !== 1
    )
      fail(400, 'Invalid explanation edition.');
    if (explanationQuery && !explanationQuery.success)
      fail(400, 'Invalid explanation edition.');
    const current = currentPublications(bundle.feed, bundle.histories).find(
      (v) => v.id === id,
    );
    if (!current) fail(404, 'Published item is not included in this snapshot.');
    const action = item[2];
    if (!action) return { body: publicEdition(current) };
    if (action === 'history') {
      const editions = new Map(
        (bundle.histories[id] ?? [])
          .concat(current)
          .filter((v) => v.status !== 'draft')
          .map((v) => [v.version, v]),
      );
      return {
        body: [...editions.values()]
          .sort((a, b) => b.version - a.version)
          .map((v) => publicEdition(v, current.status === 'withdrawn')),
      };
    }
    if (current.status !== 'published') fail(404, 'Source item was withdrawn.');
    if (action === 'explanation' && explanationQuery?.success) {
      if (current.version !== explanationQuery.data.expectedVersion)
        fail(
          409,
          'This source edition changed. Refresh reading before opening its explanation.',
        );
      const previous =
        [...bundle.feed, ...(bundle.histories[id] ?? [])]
          .filter(
            (v) =>
              v.id === id &&
              v.version < current.version &&
              v.status !== 'draft',
          )
          .sort((a, b) => b.version - a.version)[0] ?? null;
      return {
        body: explainEdition(
          current,
          previous,
          new Date().toISOString(),
          bundle.generatedAt,
        ),
      };
    }
    if (action === 'context')
      return { body: buildResearchContext(current, published(bundle)) };
    const value = action === 'media' ? bundle.media[id] : bundle.evidence[id];
    if (!value)
      fail(
        404,
        `${action === 'media' ? 'Reviewed visual' : 'Source evidence'} is not bundled for this item.`,
      );
    if (action === 'media') {
      const asset = MediaAssetSchema.parse(value);
      if (
        asset.itemId !== current.id ||
        asset.itemVersion !== current.version ||
        asset.status !== 'published'
      )
        fail(404, 'Reviewed visual is unavailable for this source edition.');
      return { body: asset };
    }
    return {
      body: action === 'evidence' ? editionEvidence(current, value) : value,
    };
  }
  return undefined;
}
