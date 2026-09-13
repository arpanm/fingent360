import {
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
export function filtered(req: OfflineRequest, items: FeedItem[]) {
  const q = (req.query.get('q') ?? '').trim().toLocaleLowerCase();
  const kind = req.query.get('kind');
  if (q.length > 200 || (kind && !['news', 'term', 'annual'].includes(kind)))
    fail(400, 'Invalid reading filters.');
  return items.filter(
    (v) =>
      (!kind || v.kind === kind) &&
      (!q ||
        `${v.title} ${v.summary} ${v.body} ${v.topics.join(' ')}`
          .toLocaleLowerCase()
          .includes(q)),
  );
}
export async function page(
  req: OfflineRequest,
  items: FeedItem[],
  binding: unknown,
) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      binding,
      req.query.get('q'),
      req.query.get('kind'),
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
          filtered(req, published(bundle)).sort(
            (a, b) =>
              b.publishedAt.localeCompare(a.publishedAt) ||
              a.id.localeCompare(b.id),
          ),
          bundle.generatedAt,
        )),
        evaluatedAt: bundle.generatedAt,
      }),
    };
  if (p === '/learning/catalog')
    return { body: LearningCatalogSchema.parse(bundle.learningCatalog) };
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
    /^\/discovery\/items\/([^/]+)(?:\/(history|evidence|media))?$/,
  );
  if (item) {
    const id = DiscoveryIdSchema.parse(decodeURIComponent(item[1]!));
    const current = bundle.feed.find(
      (v) => v.id === id && v.status !== 'draft',
    );
    if (!current) fail(404, 'Published item is not included in this snapshot.');
    const action = item[2];
    if (!action) return { body: current };
    if (action === 'history')
      return { body: bundle.histories[id] ?? [current] };
    if (action === 'media' && current.status !== 'published')
      fail(404, 'Source item was withdrawn.');
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
