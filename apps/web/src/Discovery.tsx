import './research.css';
import { TermLink } from './TermLink';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  FeedSchema,
  ResearchCatalogSchema,
  ResearchContextSchema,
  sourceIdFor,
  connectionSource,
  type ResearchCatalog,
  type ResearchContext,
  FeedItemSchema,
  FeedRankingSchema,
  DiscoveryEvidenceSchema,
  PublicDiscoveryEvidenceSchema,
  type FeedItem,
  type Library,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { Icon, shortDate } from './ui';
import { returnTo, restorePosition } from './navigation';
import { Dialog } from './Dialog';
import { MediaSummary } from './MediaSummary';
import {
  fetchLibrary,
  saveLibraryItem,
  unsaveLibraryItem,
  reactToLibraryItem,
  clearLibraryReaction,
  saveReadingPosition,
  createLibraryReminder,
  LibrarySignInRequired,
} from './library-client';
const labels = {
  news: 'NEWS',
  term: 'A LITTLE KNOWLEDGE',
  annual: 'ANNUAL DATA',
};
type ReadingView = {
  mode: 'scan' | 'stories';
  index: number;
  query: string;
  kind: string;
  expanded: boolean;
  items: FeedItem[];
  reasons: Record<string, string>;
  cursor: string | null;
  loaded: boolean;
  authenticated: boolean;
};
const memory = new Map<string, ReadingView>();
window.addEventListener('f360-session-changed', () => memory.clear());
let readingOrder: FeedItem[] = [];
export function Discovery({ explore = false }: { explore?: boolean }) {
  const key = explore ? 'explore' : 'today';
  const routeQuery = new URLSearchParams(
    window.location.hash.split('?')[1] ?? '',
  );
  const stored = memory.get(window.location.hash.slice(1) || key);
  const [mode, setMode] = useState<'scan' | 'stories'>(
    routeQuery.get('mode') === 'stories' ? 'stories' : (stored?.mode ?? 'scan'),
  );
  const [index, setIndex] = useState(stored?.index ?? 0);
  const [query, setQuery] = useState(
    routeQuery.get('q') ?? stored?.query ?? '',
  );
  const [kind, setKind] = useState(
    routeQuery.get('kind') ?? stored?.kind ?? 'all',
  );
  const [catalog, setCatalog] = useState<ResearchCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [source, setSource] = useState(routeQuery.get('source') ?? '');
  const [topic, setTopic] = useState(routeQuery.get('topic') ?? '');
  const [region, setRegion] = useState(routeQuery.get('region') ?? '');
  const [expanded, setExpanded] = useState(stored?.expanded ?? false);
  const [items, setItems] = useState<FeedItem[]>(stored?.items ?? []);
  const [reasons, setReasons] = useState<Record<string, string>>(
    stored?.reasons ?? {},
  );
  const [cursor, setCursor] = useState<string | null>(stored?.cursor ?? null);
  const [authenticated, setAuthenticated] = useState(
    stored?.authenticated ?? false,
  );
  const [loading, setLoading] = useState(!stored?.loaded);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const initial = useRef(!!stored?.loaded);
  const requestId = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let active = true;
    setCatalogError('');
    void json('/discovery/catalog')
      .then((value) => {
        if (active) setCatalog(ResearchCatalogSchema.parse(value));
      })
      .catch((e: unknown) => {
        if (active)
          setCatalogError(
            e instanceof Error
              ? e.message
              : 'Source choices could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [catalogRetry]);
  const params = (next?: string) => {
    const p = new URLSearchParams();
    if (next) p.set('cursor', next);
    p.set('view', explore ? 'explore' : 'today');
    if (source) p.set('source', source);
    if (topic) p.set('topic', topic);
    if (region) p.set('region', region);
    if (query.trim()) p.set('q', query.trim());
    if (kind !== 'all') p.set('kind', kind);
    return p.toString() ? `?${p}` : '';
  };
  useEffect(() => {
    const reset = () => {
      initial.current = false;
      setItems([]);
      setReasons({});
      setCursor(null);
      setRevision((n) => n + 1);
    };
    window.addEventListener('f360-session-changed', reset);
    return () => window.removeEventListener('f360-session-changed', reset);
  }, []);
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      restorePosition();
      return;
    }
    const generation = ++requestId.current;
    setLoading(true);
    setError('');
    setMoreLoading(false);
    const timer = setTimeout(
      () => {
        const load = async () => {
          const suffix = params();
          try {
            const result = FeedRankingSchema.parse(
              await json(`/account/library/feed${suffix}`),
            );
            if (generation === requestId.current) {
              setItems(result.items);
              setReasons(result.whyShown);
              setCursor(result.nextCursor);
              setAuthenticated(true);
            }
          } catch (e) {
            if (!(e instanceof RequestError) || e.status !== 401) throw e;
            const result = FeedSchema.parse(
              await json(`/discovery/feed${suffix}`),
            );
            if (generation === requestId.current) {
              setItems(result.items);
              setReasons({});
              setCursor(result.nextCursor);
              setAuthenticated(false);
            }
          }
        };
        void load()
          .catch((e: unknown) => {
            if (generation === requestId.current)
              setError(
                e instanceof Error
                  ? e.message
                  : 'Your reading could not be loaded.',
              );
          })
          .finally(() => {
            if (generation === requestId.current) {
              setLoading(false);
              restorePosition();
            }
          });
      },
      query ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [query, kind, source, topic, region, revision]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (kind !== 'all') p.set('kind', kind);
    if (source) p.set('source', source);
    if (topic) p.set('topic', topic);
    if (region) p.set('region', region);
    if (mode === 'stories') p.set('mode', mode);
    memory.set(`${key}${p.size ? `?${p}` : ''}`, {
      mode,
      index,
      query,
      kind,
      expanded,
      items,
      reasons,
      cursor,
      loaded: !loading && !error,
      authenticated,
    });
  }, [
    key,
    mode,
    index,
    query,
    kind,
    source,
    topic,
    region,
    expanded,
    items,
    reasons,
    cursor,
    loading,
    error,
    authenticated,
  ]);
  useEffect(() => {
    const sync = () => {
      if ((window.location.hash.slice(1).split('?')[0] || 'today') !== key)
        return;
      const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      setQuery(p.get('q') ?? '');
      setKind(p.get('kind') ?? 'all');
      setSource(p.get('source') ?? '');
      setTopic(p.get('topic') ?? '');
      setRegion(p.get('region') ?? '');
      setMode(p.get('mode') === 'stories' ? 'stories' : 'scan');
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [key]);
  useEffect(() => {
    if ((window.location.hash.slice(1).split('?')[0] || 'today') !== key)
      return;
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (kind !== 'all') p.set('kind', kind);
    if (source) p.set('source', source);
    if (topic) p.set('topic', topic);
    if (region) p.set('region', region);
    if (mode === 'stories') p.set('mode', mode);
    const route = `${key}${p.size ? `?${p}` : ''}`;
    window.history.replaceState(
      { ...window.history.state, route },
      '',
      `#${route}`,
    );
  }, [key, query, kind, source, topic, region, mode]);
  async function more() {
    if (!cursor || moreLoading) return;
    const generation = requestId.current;
    setMoreLoading(true);
    setError('');
    try {
      const result = await json(
        `${authenticated ? '/account/library/feed' : '/discovery/feed'}${params(cursor)}`,
      );
      const parsed = authenticated
        ? FeedRankingSchema.parse(result)
        : FeedSchema.parse(result);
      if (generation !== requestId.current) return;
      setItems((old) => [
        ...old,
        ...parsed.items.filter(
          (item) => !old.some((previous) => previous.id === item.id),
        ),
      ]);
      if (authenticated) {
        const ranked = FeedRankingSchema.parse(result);
        setReasons((old) => ({ ...old, ...ranked.whyShown }));
      }
      setCursor(parsed.nextCursor);
      setExpanded(true);
    } catch (e) {
      if (generation !== requestId.current) return;
      if (e instanceof RequestError && (e.status === 409 || e.status === 401))
        setCursor(null);
      setError(
        e instanceof Error ? e.message : 'More reading could not be loaded.',
      );
    } finally {
      if (generation === requestId.current) setMoreLoading(false);
    }
  }
  const visible = items;
  const selected = Math.min(index, Math.max(0, visible.length - 1));
  const story = visible[selected];
  const step = (delta: number) =>
    setIndex((n) => Math.max(0, Math.min(visible.length - 1, n + delta)));
  const prepareReader = (at: number) => {
    setIndex(at);
    readingOrder = visible;
  };
  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div className="edition-line">
        <span>
          {new Intl.DateTimeFormat('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(new Date())}
        </span>
        <span>A CLEARER PERSPECTIVE</span>
      </div>
      <div className="discovery-heading">
        <div>
          <p className="page-kicker">
            {explore ? 'FOLLOW YOUR CURIOSITY' : 'YOUR DAILY PERSPECTIVE'}
          </p>
          <h1 id="discovery-title">
            {explore ? (
              'Make sense of it.'
            ) : (
              <>
                A little wiser.
                <br />
                <em>Every day.</em>
              </>
            )}
          </h1>
          <p>
            {explore
              ? 'Find a topic. Follow a connection. Learn something useful.'
              : 'A considered selection of news, ideas and economic context.'}
          </p>
        </div>
        <div className="view-switch" role="group" aria-label="Reading view">
          <button
            aria-pressed={mode === 'scan'}
            onClick={() => setMode('scan')}
          >
            Scan
          </button>
          <button
            aria-pressed={mode === 'stories'}
            onClick={() => setMode('stories')}
          >
            Stories
          </button>
        </div>
      </div>
      <details
        className="research-filters"
        aria-label="Filter research"
        open={
          explore || !!(source || topic || region || query || kind !== 'all')
        }
      >
        <summary>
          Shape your reading{' '}
          <span>
            {source || topic || region
              ? 'Selected filters'
              : 'Sources, topics & focus'}
          </span>
        </summary>
        <div className="research-filter-grid">
          <label htmlFor={`${key}-source`}>
            Source
            <select
              id={`${key}-source`}
              aria-label="Research source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setIndex(0);
              }}
            >
              <option value="">All published sources</option>
              {catalog?.sources
                .filter((s) => s.publishedCount > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.publishedCount})
                  </option>
                ))}
              {source &&
                !catalog?.sources.some(
                  (s) => s.id === source && s.publishedCount > 0,
                ) && (
                  <option value={source}>{source} · no published items</option>
                )}
            </select>
          </label>
          <label htmlFor={`${key}-topic`}>
            Topic
            <select
              id={`${key}-topic`}
              aria-label="Research topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setIndex(0);
              }}
            >
              <option value="">All topics</option>
              {catalog?.topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {topic && !catalog?.topics.includes(topic) && (
                <option value={topic}>{topic}</option>
              )}
            </select>
          </label>
          <label htmlFor={`${key}-region`}>
            Focus
            <select
              id={`${key}-region`}
              aria-label="Research region"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setIndex(0);
              }}
            >
              <option value="">India and the world</option>
              <option value="india">India</option>
              <option value="global">Global context</option>
            </select>
          </label>
        </div>
        <div className="research-coverage">
          {catalog && (
            <span>
              {catalog.sources.filter((s) => s.publishedCount > 0).length}{' '}
              published collections · checked {shortDate(catalog.evaluatedAt)}
            </span>
          )}
          <a href="#sources">See source coverage and limits</a>
          {(source || topic || region || query || kind !== 'all') && (
            <button
              className="text-link"
              onClick={() => {
                setSource('');
                setTopic('');
                setRegion('');
                setQuery('');
                setKind('all');
                setIndex(0);
              }}
            >
              Reset selection
            </button>
          )}
        </div>
        {catalogError && (
          <p role="alert">
            {catalogError}{' '}
            <button onClick={() => setCatalogRetry((n) => n + 1)}>
              Retry source choices
            </button>
          </p>
        )}
      </details>
      {explore && (
        <>
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">Search topics and reading</span>
            <input
              maxLength={200}
              type="search"
              placeholder="Inflation, interest rates, a new idea…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
              }}
            />
          </label>
          <div className="topic-strip" role="group" aria-label="Content type">
            {[
              ['all', 'Everything'],
              ['news', 'News'],
              ['term', 'Terms'],
              ['annual', 'Annual data'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value!);
                  setIndex(0);
                }}
              >
                {label}
              </button>
            ))}
            <a href="#macro">
              India macro <Icon name="arrow" size={14} />
            </a>
          </div>
        </>
      )}
      {loading && (
        <div className="feed-loading" role="status">
          Gathering your reading…
          <div />
          <div />
          <div />
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>
            Refresh reading
          </button>
          {cursor && (
            <button disabled={moreLoading} onClick={() => void more()}>
              Retry more reading
            </button>
          )}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="empty-state">
          <Icon name="learn" size={40} />
          <h2>
            {query || kind !== 'all' || source || topic || region
              ? 'Try another topic'
              : 'Your next perspective is on its way'}
          </h2>
          <p>
            {query || kind !== 'all' || source || topic || region
              ? 'No published items match those filters.'
              : 'There are no published items available here yet. You can explore the economic record or your own plans.'}
          </p>
          <button
            className="secondary"
            onClick={() => {
              setQuery('');
              setKind('all');
              setSource('');
              setTopic('');
              setRegion('');
              setIndex(0);
            }}
          >
            Clear reading filters
          </button>
          <a className="button" href="#macro">
            Explore annual data
          </a>
        </div>
      )}
      {!loading && mode === 'scan' && (
        <div className="editorial-list">
          {visible.map((item, i) => (
            <article
              key={item.id}
              className={`editorial-item priority-${item.importance} ${i === 0 ? 'lead-item' : ''}`}
            >
              <div className="item-index">{String(i + 1).padStart(2, '0')}</div>
              <div>
                <div className="item-meta">
                  <span>{labels[item.kind]}</span>
                  <span>
                    {item.kind === 'news'
                      ? `${shortDate(item.publishedAt)} · ${item.effectiveLabel}`
                      : item.effectiveLabel}
                  </span>
                  {item.importance > 1 && (
                    <span className="sr-only">
                      Editorial emphasis {item.importance} of 3
                    </span>
                  )}
                </div>
                <a
                  className="headline-link"
                  data-item-id={item.id}
                  href={`#read/${item.id}`}
                  onClick={() => prepareReader(i)}
                >
                  <h2>{item.title}</h2>
                  <Icon name="arrow" size={22} />
                </a>
                <p>{item.summary !== item.title ? item.summary : null}</p>
                <div className="item-source">
                  <span>{item.source.name}</span>
                  {reasons[item.id] && (
                    <span className="reason">{reasons[item.id]}</span>
                  )}
                </div>
                {item.relatedIds.length > 0 && (
                  <div className="related-chips">
                    {item.relatedIds.slice(0, 3).map((id) => (
                      <a href={`#read/${id}`} key={id}>
                        {id.replace(/^term-/, '').replaceAll('-', ' ')}{' '}
                        <span>↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && mode === 'stories' && story && (
        <div
          className="story-stage"
          tabIndex={0}
          role="region"
          aria-label="Reading story"
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (
              ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              step(['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1);
            }
          }}
          onPointerDown={(e) => {
            if (
              !e.isPrimary ||
              e.button !== 0 ||
              !(e.target as HTMLElement).closest('.story-swipe-area') ||
              e.clientX < 24 ||
              e.clientX > innerWidth - 24
            )
              return;
            e.currentTarget.setPointerCapture(e.pointerId);
            touch.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerCancel={() => {
            touch.current = null;
          }}
          onPointerUp={(e) => {
            const p = touch.current;
            touch.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            if (
              p &&
              Math.abs(e.clientY - p.y) > 90 &&
              Math.abs(e.clientY - p.y) > Math.abs(e.clientX - p.x) * 2
            )
              step(e.clientY < p.y ? 1 : -1);
          }}
        >
          <span className="story-number" role="status">
            {selected + 1} / {visible.length}
          </span>
          <span className="story-glyph" aria-hidden="true">
            {story.kind === 'term' ? 'Aa' : story.kind === 'annual' ? '%' : '↗'}
          </span>
          <span className="eyebrow">
            {labels[story.kind]} · {story.effectiveLabel}
          </span>
          <h2>{story.title}</h2>
          <p className="story-excerpt">
            {story.summary !== story.title ? story.summary : null}
          </p>
          <a
            className="button"
            href={`#read/${story.id}`}
            data-item-id={story.id}
            onClick={() => prepareReader(selected)}
          >
            Read the story <Icon name="arrow" />
          </a>
          <div className="story-swipe-area" aria-label="Story swipe area">
            <span aria-hidden="true">↑ ↓</span>
            Swipe up for next · down for previous
          </div>
          <div className="story-controls">
            <button
              className="secondary"
              disabled={selected === 0}
              onClick={() => step(-1)}
            >
              Previous
            </button>
            <span>{story.source.name}</span>
            <button
              className="secondary"
              disabled={selected >= visible.length - 1}
              onClick={() => step(1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {!loading && visible.length > 0 && (
        <div className="brief-end">
          <span className="end-mark">✦</span>
          <h2>
            {explore
              ? 'Keep following your curiosity.'
              : 'A good place to pause.'}
          </h2>
          <p>
            {explore
              ? 'Your next connection starts with a question.'
              : 'You’ve reached the end of this selection. Return to something worth keeping.'}
          </p>
          <div className="page-actions">
            {!explore ? (
              <a className="button secondary" href="#explore">
                Explore all reading
              </a>
            ) : (
              cursor && (
                <button
                  className="secondary"
                  disabled={moreLoading}
                  onClick={() => void more()}
                >
                  {moreLoading ? 'Loading more…' : 'More reading'}
                </button>
              )
            )}
            <a href="#saved">
              Open saved reading <Icon name="arrow" size={16} />
            </a>
            <a href="#learning">Try a little learning</a>
          </div>
          <button
            className="text-link"
            onClick={() => setRevision((n) => n + 1)}
          >
            Check for new reading
          </button>
        </div>
      )}
    </section>
  );
}
export function Reader({ id }: { id: string }) {
  const [item, setItem] = useState<FeedItem | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [libraryState, setLibraryState] = useState<
    'loading' | 'signed-out' | 'ready' | 'error'
  >('loading');
  const [libraryError, setLibraryError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<
    'more' | 'remind' | 'evidence' | 'history' | 'term' | null
  >(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [termId, setTermId] = useState('');
  const detailGeneration = useRef(0);
  const [due, setDue] = useState('');
  const pendingReminder = useRef<{ signature: string; key: string } | null>(
    null,
  );
  const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const [swipe, setSwipe] = useState(0);
  const pointer = useRef<{
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | null;
    long: boolean;
  } | null>(null);
  const content = useRef<HTMLElement>(null);
  const resumed = useRef(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    let active = true;
    resumed.current = false;
    setItem(null);
    setError('');
    setNotice('');
    setModal(null);
    setUndo(null);
    setLibraryState('loading');
    void json(`/discovery/items/${encodeURIComponent(id)}`)
      .then((v) => {
        if (active) setItem(FeedItemSchema.parse(v));
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'This item could not be opened.',
          );
      });
    const loadLibrary = async () => {
      try {
        const value = await fetchLibrary();
        if (active) {
          setLibrary(value);
          setLibraryState('ready');
          setLibraryError('');
        }
      } catch (e) {
        if (active) {
          setLibrary(null);
          setLibraryState(
            e instanceof LibrarySignInRequired ? 'signed-out' : 'error',
          );
          setLibraryError(
            e instanceof LibrarySignInRequired
              ? ''
              : e instanceof Error
                ? e.message
                : 'Your saved reading could not be loaded.',
          );
        }
      }
    };
    const session = () => {
      setLibrary(null);
      setUndo(null);
      setNotice('');
      setLibraryState('loading');
      void loadLibrary();
    };
    void loadLibrary();
    window.addEventListener('f360-session-changed', session);
    return () => {
      active = false;
      detailGeneration.current++;
      window.removeEventListener('f360-session-changed', session);
    };
  }, [id, revision]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modal && !e.defaultPrevented)
        returnTo('today');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal]);
  useEffect(() => {
    if (!item) return;
    restorePosition();
  }, [item]);
  useEffect(() => {
    if (!item) return;
    if (
      !library ||
      resumed.current ||
      !new URLSearchParams(window.location.hash.split('?')[1]).has('resume')
    )
      return;
    resumed.current = true;
    const position = library.positions.find(
      (value) => value.itemId === item.id,
    );
    if (position?.version === item.version)
      requestAnimationFrame(() => {
        const total = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo(0, Math.max(0, (total * position.percent) / 100));
        setNotice(`Resumed at ${position.percent}% of this version.`);
      });
    else if (position)
      setNotice(
        'This item has been updated. You’re reading its latest version from the beginning.',
      );
  }, [item, library]);
  useEffect(() => {
    if (!item || libraryState !== 'ready' || item.status !== 'published')
      return;
    let last = -1;
    const record = () => {
      if (document.hidden) return;
      const total = document.documentElement.scrollHeight - innerHeight;
      const percent = Math.min(
        100,
        Math.max(0, Math.round(total > 0 ? (scrollY / total) * 100 : 100)),
      );
      if (percent !== last) {
        last = percent;
        void saveReadingPosition(item.id, item.version, percent).catch(
          () => {},
        );
      }
    };
    const timer = setInterval(record, 4000);
    // Closing a reader retains the last measured position without collecting dwell time.
    return () => {
      clearInterval(timer);
    };
  }, [item, libraryState]);
  const action = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await work();
      setLibrary(await fetchLibrary());
      setLibraryState('ready');
    } catch (e) {
      if (e instanceof LibrarySignInRequired) {
        setLibrary(null);
        setLibraryState('signed-out');
      }
      setError(
        e instanceof Error
          ? e.message
          : 'This could not be saved. Please try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const auth = () => {
    if (libraryState === 'ready') return true;
    setError(
      libraryState === 'loading'
        ? 'Your saved reading is still loading.'
        : libraryState === 'error'
          ? libraryError
          : 'Sign in to keep your reading and preferences.',
    );
    return false;
  };
  const reaction = library?.reactions.find((r) => r.itemId === id)?.reaction;
  const react = (value: 'more' | 'less') => {
    if (!auth() || item?.status !== 'published') return;
    const previous = reaction;
    void action(async () => {
      await reactToLibraryItem(id, value);
      setNotice(
        library?.preferences.mode === 'for_you'
          ? value === 'more'
            ? 'We’ll show more coverage like this.'
            : 'We’ll show less coverage like this.'
          : 'Preference saved. Choose “For you” in Reading preferences to use it in your feed.',
      );
      setUndo(() => async () => {
        if (previous) await reactToLibraryItem(id, previous);
        else await clearLibraryReaction(id);
        setNotice('Preference restored.');
        setUndo(null);
      });
    });
  };
  const saved = library?.saved.some((s) => s.itemId === id) ?? false;
  const save = () => {
    if (!item || !auth()) return;
    void action(async () => {
      if (saved) await unsaveLibraryItem(id);
      else await saveLibraryItem(id, item.version);
      setNotice(
        saved
          ? 'Removed from saved reading.'
          : 'Saved. Find it in your library.',
      );
      setUndo(() => async () => {
        if (saved) await saveLibraryItem(id, item.version);
        else await unsaveLibraryItem(id);
        setNotice('Save change undone.');
        setUndo(null);
      });
    });
  };
  const closeModal = () => {
    detailGeneration.current++;
    setModal(null);
  };
  const openDetail = async (
    which: 'evidence' | 'history' | 'term',
    related = '',
  ) => {
    const generation = ++detailGeneration.current;
    setModal(which);
    setTermId(related);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await json(
        which === 'term'
          ? `/discovery/items/${encodeURIComponent(related)}`
          : `/discovery/items/${id}/${which}`,
      );
      if (generation === detailGeneration.current)
        setDetail(
          which === 'evidence'
            ? PublicDiscoveryEvidenceSchema.parse(data)
            : which === 'term'
              ? FeedItemSchema.parse(data)
              : FeedItemSchema.array().parse(data),
        );
    } catch (e) {
      if (generation === detailGeneration.current)
        setDetailError(
          e instanceof Error ? e.message : 'This context is unavailable.',
        );
    } finally {
      if (generation === detailGeneration.current) setDetailLoading(false);
    }
  };
  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      e.clientX < 28 ||
      e.clientX > innerWidth - 28 ||
      (e.target as HTMLElement).closest('a,button,input,select,textarea')
    )
      return;
    pointer.current = {
      x: e.clientX,
      y: e.clientY,
      long: false,
      timer: setTimeout(() => {
        if (pointer.current && !window.getSelection()?.toString()) {
          pointer.current.long = true;
          setModal('more');
        }
      }, 600),
    };
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pointer.current;
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) > 12 && p.timer) {
      clearTimeout(p.timer);
      p.timer = null;
    }
    if (Math.abs(dx) > Math.abs(dy) * 2)
      setSwipe(Math.max(-120, Math.min(120, dx)));
    else setSwipe(0);
  };
  const clear = () => {
    if (pointer.current?.timer) clearTimeout(pointer.current.timer);
    pointer.current = null;
    setSwipe(0);
  };
  const up = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pointer.current;
    if (p && !p.long && !window.getSelection()?.toString()) {
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      if (Math.abs(dx) >= 80 && Math.abs(dx) > Math.abs(dy) * 2)
        react(dx > 0 ? 'more' : 'less');
    }
    clear();
  };
  useEffect(
    () => () => {
      if (pointer.current?.timer) clearTimeout(pointer.current.timer);
    },
    [],
  );
  const localTime = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const preset = (tomorrow: boolean) => {
    const date = new Date();
    date.setHours(tomorrow ? 9 : 19, 0, 0, 0);
    if (tomorrow || date.getTime() <= Date.now())
      date.setDate(date.getDate() + 1);
    setDue(localTime(date));
  };
  if (!item)
    return (
      <section className="reader">
        <button className="text-link" onClick={() => returnTo('today')}>
          ← Back to reading
        </button>
        {error ? (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setRevision((n) => n + 1)}>Try again</button>
          </div>
        ) : (
          <p role="status">Opening your reading…</p>
        )}
      </section>
    );
  const at = readingOrder.findIndex((value) => value.id === id);
  const withdrawn = item.status === 'withdrawn';
  return (
    <article className="reader" ref={content}>
      <div className="reader-top">
        <button className="text-link" onClick={() => returnTo('today')}>
          <Icon name="back" /> Back
        </button>
        <span>{labels[item.kind]}</span>
        <button
          type="button"
          className="text-link"
          onClick={() => setRevision((n) => n + 1)}
        >
          Refresh reading
        </button>
        <button
          className="icon-button"
          aria-label="More item actions"
          onClick={() => {
            setDetailError('');
            setModal('more');
          }}
        >
          <Icon name="more" />
        </button>
      </div>
      <div
        className="reader-intro"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={clear}
      >
        <p className="eyebrow">{item.effectiveLabel}</p>
        <h1>{item.title}</h1>
        <p className="reader-deck">
          {withdrawn
            ? 'This item has been withdrawn from publication.'
            : item.summary !== item.body && item.summary !== item.title
              ? item.summary
              : null}
        </p>
        <div className="byline">
          <span className="source-monogram">{item.source.name[0]}</span>
          <div>
            <strong>{item.source.name}</strong>
            <span>
              {item.kind === 'annual'
                ? item.effectiveLabel
                : `Published ${shortDate(item.publishedAt)}`}
            </span>
          </div>
        </div>
        {!withdrawn && (
          <div
            className="reading-gesture-area"
            aria-label="Swipe for reading preferences"
          >
            Swipe right for more like this · left for less
          </div>
        )}
        {swipe !== 0 && (
          <div className="swipe-preview" aria-live="polite">
            {swipe > 0 ? 'More like this →' : '← Less like this'}
            {Math.abs(swipe) < 80 ? ' · Keep swiping' : ' · Release to apply'}
          </div>
        )}
      </div>
      {item.correctionNote && (
        <details className="correction-note">
          <summary>Edition {item.version} · editorial notes</summary>
          <p>{item.correctionNote}</p>
        </details>
      )}
      {!withdrawn && (
        <>
          <MediaSummary itemId={item.id} itemVersion={item.version} />
          {item.id.startsWith('bea-') && (
            <p className="panel">
              BEA headline only. Open the original release for its reference
              period, units and estimates. This reading does not establish an
              effect on your holdings or goals.
            </p>
          )}
          <div className="reading-body">
            {(item.body === item.title ? [] : item.body.split(/\n\n+/)).map(
              (p, i) => (
                <p key={i}>{p}</p>
              ),
            )}
          </div>
          {connectionSource(item) && (
            <section
              className="panel"
              aria-label="Connect reading to your records"
            >
              <h2>Your research connection</h2>
              <p>
                Keep your own reason for connecting this source edition to a
                saved holding or goal.
              </p>
              <a
                className="button secondary"
                href={`#connections?itemId=${item.id}&sourceVersion=${item.version}&sourceHash=${item.sourceHash}`}
              >
                Connect to my records
              </a>
            </section>
          )}
          <ReadingContext item={item} />
          {item.relatedIds.length > 0 && (
            <section className="reader-related">
              <span className="eyebrow">MAKE A CONNECTION</span>
              <h2>A little more context</h2>
              <div className="related-chips">
                {item.relatedIds.map((related) => (
                  <TermLink
                    key={related}
                    id={related}
                    onOpen={() => void openDetail('term', related)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <section className="reader-source">
        <span className="eyebrow">CHECK THE BASIS</span>
        <h2>Follow the source.</h2>
        <p>
          {item.source.name} · checked {shortDate(item.source.retrievedAt)}
        </p>
        <div className="page-actions">
          <a href={`#explore?source=${encodeURIComponent(sourceIdFor(item))}`}>
            More from this source
          </a>
          {!withdrawn && (
            <a href={item.source.url} target="_blank" rel="noreferrer">
              Original source <Icon name="arrow" size={16} />
            </a>
          )}
          {item.sourceHash && !withdrawn && (
            <button
              className="text-link"
              onClick={() => void openDetail('evidence')}
            >
              Stored evidence
            </button>
          )}
          <button
            className="text-link"
            onClick={() => void openDetail('history')}
          >
            Version history
          </button>
        </div>
        <details>
          <summary>About this source</summary>
          <p>{item.source.rights}</p>
        </details>
      </section>
      {libraryError && (
        <p className="error" role="alert">
          {libraryError}
          <button onClick={() => setRevision((n) => n + 1)}>
            Reload saved reading
          </button>
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
          {libraryState === 'signed-out' && (
            <a href={`#account?next=${encodeURIComponent(`read/${id}`)}`}>
              Sign in or create an account
            </a>
          )}
        </div>
      )}
      {notice && (
        <div className="reader-notice" role="status">
          {notice}
          {undo && (
            <button disabled={busy} onClick={() => void action(undo)}>
              Undo
            </button>
          )}
        </div>
      )}
      {!withdrawn && (
        <div className="reader-actions" aria-label="Reading actions">
          <button
            disabled={busy || libraryState === 'loading'}
            aria-pressed={reaction === 'more'}
            onClick={() => react('more')}
          >
            <Icon name="like" />
            <span>More like this</span>
          </button>
          <button
            disabled={busy || libraryState === 'loading'}
            aria-pressed={reaction === 'less'}
            onClick={() => react('less')}
          >
            <Icon name="dislike" />
            <span>Less like this</span>
          </button>
          <button
            disabled={busy || libraryState === 'loading'}
            aria-pressed={saved}
            onClick={save}
          >
            <Icon name="bookmark" />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            disabled={busy || libraryState === 'loading'}
            onClick={() => {
              if (auth()) setModal('remind');
            }}
          >
            <Icon name="bell" />
            <span>Remind me</span>
          </button>
        </div>
      )}
      {at >= 0 && readingOrder.length > 1 && (
        <nav
          className="reader-sequence"
          aria-label="More reading in this selection"
        >
          {at > 0 ? (
            <a href={`#read/${readingOrder[at - 1]!.id}`}>← Previous item</a>
          ) : (
            <span />
          )}
          <span>
            {at + 1} / {readingOrder.length}
          </span>
          {at < readingOrder.length - 1 && (
            <a href={`#read/${readingOrder[at + 1]!.id}`}>Next item →</a>
          )}
        </nav>
      )}
      {modal && (
        <Dialog
          title={
            modal === 'more'
              ? 'Keep this perspective'
              : modal === 'remind'
                ? 'Remind me to read'
                : modal === 'evidence'
                  ? 'Stored source evidence'
                  : modal === 'term'
                    ? 'A little more context'
                    : 'Version history'
          }
          onClose={closeModal}
        >
          {modal === 'more' ? (
            <div className="menu-actions">
              {!withdrawn && (
                <>
                  <button
                    onClick={() => {
                      closeModal();
                      save();
                    }}
                  >
                    {saved ? 'Remove saved item' : 'Save for later'}
                  </button>
                  <button
                    onClick={() => {
                      if (auth()) setModal('remind');
                      else closeModal();
                    }}
                  >
                    Remind me
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => {
                      setNotice('Link copied.');
                      closeModal();
                    })
                    .catch(() =>
                      setDetailError(
                        'Could not copy. Use the address bar to copy this link.',
                      ),
                    );
                }}
              >
                Copy link
              </button>
              {detailError && <p role="alert">{detailError}</p>}
            </div>
          ) : modal === 'remind' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const date = new Date(due);
                  if (
                    !Number.isFinite(date.getTime()) ||
                    localTime(date) !== due
                  )
                    throw new Error('Choose a valid local date and time.');
                  const dueAt = date.toISOString();
                  const signature = JSON.stringify({
                    itemId: id,
                    dueAt,
                    timeZone,
                  });
                  if (pendingReminder.current?.signature !== signature)
                    pendingReminder.current = {
                      signature,
                      key: crypto.randomUUID(),
                    };
                  await createLibraryReminder({
                    itemId: id,
                    dueAt,
                    timeZone,
                    idempotencyKey: pendingReminder.current.key,
                  });
                  pendingReminder.current = null;
                  closeModal();
                  setNotice(
                    'Reminder saved. It will appear in Saved when due.',
                  );
                });
              }}
            >
              <p>
                Choose when this appears in your in-app reminders. It does not
                send email or device notifications.
              </p>
              <div className="page-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => preset(false)}
                >
                  Next evening
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => preset(true)}
                >
                  Tomorrow morning
                </button>
              </div>
              <label>
                When to read
                <input
                  type="datetime-local"
                  required
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <p className="muted">{timeZone}</p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button disabled={busy || !due} type="submit">
                Save reminder
              </button>
            </form>
          ) : (
            <>
              {detailLoading && <p role="status">Loading selected {modal}…</p>}
              {detailError && (
                <div role="alert" className="error">
                  {detailError}
                  <button onClick={() => void openDetail(modal, termId)}>
                    Retry
                  </button>
                </div>
              )}
              {detail && modal === 'evidence' && (
                <Evidence data={PublicDiscoveryEvidenceSchema.parse(detail)} />
              )}
              {detail &&
                modal === 'history' &&
                FeedItemSchema.array()
                  .parse(detail)
                  .map((v) => (
                    <section key={v.version} className="version-entry">
                      <h3>
                        Version {v.version} · {v.status}
                      </h3>
                      <p>{v.title}</p>
                      <p>{v.correctionNote ?? 'Original published version.'}</p>
                      <p>
                        {v.effectiveLabel} · reviewed {shortDate(v.reviewedAt)}
                      </p>
                    </section>
                  ))}
              {detail && modal === 'term' && (
                <TermPreview item={FeedItemSchema.parse(detail)} />
              )}
            </>
          )}
        </Dialog>
      )}
    </article>
  );
}
function TermPreview({ item }: { item: FeedItem }) {
  return (
    <>
      <h3>{item.title}</h3>
      {item.status === 'withdrawn' ? (
        <p>This explanation has been withdrawn. {item.correctionNote}</p>
      ) : (
        <>
          <p>{item.summary}</p>
          <div className="reading-body">
            {item.body.split(/\n\n+/).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        </>
      )}
      {item.status === 'published' && (
        <a href={item.source.url} target="_blank" rel="noreferrer">
          {item.source.name} · original source
        </a>
      )}
      <p className="muted">
        {item.effectiveLabel} · version {item.version}
      </p>
    </>
  );
}
function Evidence({
  data,
}: {
  data: ReturnType<typeof DiscoveryEvidenceSchema.parse>;
}) {
  return (
    <>
      <p>Retrieved {shortDate(data.retrievedAt)}</p>
      <a href={data.url} target="_blank" rel="noreferrer">
        Open original provider record
      </a>
      {data.scope === 'release-metadata' && (
        <p>
          Selected release metadata only: title, link and publication date. The
          hash identifies the full stored RSS document; descriptions, numerical
          fields and media are excluded from this excerpt.
        </p>
      )}
      {data.scope === 'published-edition' && (
        <p>
          Selected published edition only. This excerpt reproduces its reviewed
          title, text and dates. The hash identifies the complete retained
          provider response, not these excerpt bytes. Other releases and
          unreviewed document content are excluded.
        </p>
      )}
      <details>
        <summary>
          {data.scope === 'release-metadata'
            ? 'Advanced: permitted metadata excerpt'
            : data.scope === 'published-edition'
              ? 'Advanced: published edition excerpt'
              : 'Advanced: original response'}
        </summary>
        <p className="hash">{data.hash}</p>
        <pre>{data.body}</pre>
      </details>
    </>
  );
}

function ReadingContext({ item }: { item: FeedItem }) {
  const [value, setValue] = useState<ResearchContext | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setValue(null);
    setError('');
    void json(`/discovery/items/${encodeURIComponent(item.id)}/context`)
      .then((raw) => {
        const next = ResearchContextSchema.parse(raw);
        if (next.itemId !== item.id || next.itemVersion !== item.version)
          throw new Error(
            'This reading changed. Reopen it for its latest context.',
          );
        if (active) setValue(next);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Context could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [item.id, item.version, retry]);
  return (
    <section className="research-context" aria-label="Reading context">
      <span className="eyebrow">MAKE SENSE OF THE CONNECTION</span>
      <h2>Put this in context.</h2>
      {!value && !error && <p role="status">Finding related reading…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((n) => n + 1)}>Retry context</button>
        </p>
      )}
      {value && (
        <>
          <p className="data-note">{value.caveat}</p>
          {value.explanations.map((v, i) => (
            <div key={`${v.href}-${i}`}>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
              <a href={v.href}>Read the explanation</a>
            </div>
          ))}
          <div className="research-connections">
            {value.related.map((v) => (
              <a key={v.id} href={`#read/${v.id}`}>
                <strong>{v.title}</strong>
                <small>
                  {v.source.name} · {shortDate(v.publishedAt)}
                </small>
              </a>
            ))}
            {value.terms.map((v) => (
              <a key={v.id} href={`#read/${v.id}`}>
                <strong>{v.title}</strong>
                <small>Understand the term · sourced explanation</small>
              </a>
            ))}
          </div>
          {value.learning.length > 0 && (
            <div className="page-actions">
              {value.learning.map((v) => (
                <a key={v.id} href={v.href}>
                  Try: {v.title}
                </a>
              ))}
            </div>
          )}
          {!value.related.length &&
            !value.terms.length &&
            !value.learning.length && (
              <p>
                No additional published connections are available for this item
                yet.
              </p>
            )}
          <div className="related-chips">
            {value.topics.map((topic) => (
              <a
                key={topic}
                href={`#explore?topic=${encodeURIComponent(topic)}`}
              >
                Explore {topic}
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
