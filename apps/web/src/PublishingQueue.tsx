import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PublishingFiltersSchema,
  PublishingPageSchema,
  publishingSources,
  publishingSourceLabels,
  type PublishingFilters,
  type PublishingPage,
  type FeedItem,
} from '@fingent360/contracts';
import { json, RequestError } from './net';

type Selection = {
  filters: PublishingFilters;
  cursor: string | null;
  previous: (string | null)[];
};
export function PublishingQueue({
  request,
  refreshKey,
  renderItem,
  onLatestRun,
}: {
  request: typeof json;
  refreshKey: number;
  renderItem: (item: FeedItem) => ReactNode;
  onLatestRun: (message: string) => void;
}) {
  const [page, setPage] = useState<PublishingPage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retryable, setRetryable] = useState(false),
    [source, setSource] = useState(''),
    [status, setStatus] = useState(''),
    [text, setText] = useState(''),
    [selection, setSelection] = useState<Selection>({
      filters: {},
      cursor: null,
      previous: [],
    });
  const requestRef = useRef(request),
    latestRef = useRef(onLatestRun),
    live = useRef(false),
    generation = useRef(0),
    lastRequest = useRef<Selection>({
      filters: {},
      cursor: null,
      previous: [],
    }),
    heading = useRef<HTMLHeadingElement>(null);
  requestRef.current = request;
  latestRef.current = onLatestRun;
  const unapplied =
    source !== (selection.filters.source ?? '') ||
    status !== (selection.filters.status ?? '') ||
    text.trim() !== (selection.filters.q ?? '');

  async function load(next: Selection, focus = false) {
    const ticket = ++generation.current;
    lastRequest.current = next;
    setSelection(next);
    setLoading(true);
    setError('');
    setRetryable(false);
    setPage(null);
    const params = new URLSearchParams();
    if (next.filters.source) params.set('source', next.filters.source);
    if (next.filters.status) params.set('status', next.filters.status);
    if (next.filters.q) params.set('q', next.filters.q);
    if (next.cursor) params.set('cursor', next.cursor);
    try {
      const parsed = PublishingPageSchema.safeParse(
        await requestRef.current(
          `/ops/discovery/queue${params.size ? `?${params}` : ''}`,
          undefined,
          'GET',
        ),
      );
      if (!parsed.success)
        throw Error(
          'The publishing page could not be read. Retry or reset the queue.',
        );
      const value = parsed.data;
      if (JSON.stringify(value.filters) !== JSON.stringify(next.filters))
        throw Error(
          'The queue returned different filters. Reset the publishing queue.',
        );
      if (!live.current || ticket !== generation.current) return;
      setPage(value);
      latestRef.current(
        value.latestRun
          ? `${value.latestRun.status}: ${value.latestRun.message}`
          : 'No discovery refresh yet.',
      );
      if (focus) heading.current?.focus();
    } catch (cause) {
      // The parent request handles every same-session401, including after this
      // component unmounts. Local rendering alone follows this request ticket.
      if (!live.current || ticket !== generation.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : 'Publishing queue unavailable.',
      );
      setRetryable(!(cause instanceof RequestError) || cause.status !== 400);
    } finally {
      if (live.current && ticket === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load({
      filters: lastRequest.current.filters,
      cursor: null,
      previous: [],
    });
    return () => {
      live.current = false;
      generation.current++;
    };
  }, [refreshKey]);

  return (
    <section
      aria-label="Publishing queue"
      className="panel"
      data-feedback-private
      aria-busy={loading}
    >
      <h2 id="publishing-queue-heading" ref={heading} tabIndex={-1}>
        Publishing queue
      </h2>
      <p>
        Latest changed editions first. Pages show current heads, not a frozen
        snapshot. Changes can move items between pages; reset to see newly
        changed heads.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = PublishingFiltersSchema.safeParse({
            ...(source ? { source } : {}),
            ...(status ? { status } : {}),
            ...(text.trim() ? { q: text.trim() } : {}),
          });
          if (!parsed.success) {
            setError(
              'Choose valid filters and no more than 120 characters of text.',
            );
            setRetryable(false);
            return;
          }
          void load({ filters: parsed.data, cursor: null, previous: [] }, true);
        }}
      >
        <label htmlFor="publishing-source">Publishing source</label>
        <select
          id="publishing-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {publishingSources.map((id) => (
            <option key={id} value={id}>
              {publishingSourceLabels[id]}
            </option>
          ))}
        </select>
        <label htmlFor="publishing-status">Publication status</label>
        <select
          id="publishing-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <label htmlFor="publishing-text">
          Search publication titles and summaries
        </label>
        <input
          id="publishing-text"
          type="search"
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="page-actions">
          <button type="submit">Apply publishing filters</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSource('');
              setStatus('');
              setText('');
              void load({ filters: {}, cursor: null, previous: [] }, true);
            }}
          >
            Reset publishing queue
          </button>
        </div>
      </form>
      {unapplied && (
        <p className="muted" aria-live="polite">
          Filters changed. Apply them to update results. Retry and page
          navigation use the applied filters.
        </p>
      )}
      {loading && <p role="status">Loading publishing queue…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {retryable && (
            <button onClick={() => void load(lastRequest.current, true)}>
              Retry publishing page
            </button>
          )}
        </div>
      )}
      {page && (
        <>
          <p role="status">
            {page.items.length} shown on page {selection.previous.length + 1}.
            Up to 20 per page.
          </p>
          <p className="muted">
            Opened {new Date(page.openedAt).toLocaleString()}. Current page read{' '}
            {new Date(page.evaluatedAt).toLocaleString()}.
          </p>
          <p className="muted">
            Applied filters:{' '}
            {page.filters.source
              ? publishingSourceLabels[page.filters.source]
              : 'All sources'}
            ; {page.filters.status ?? 'all statuses'};{' '}
            {page.filters.q ? (
              <>text “{page.filters.q}”</>
            ) : (
              'any title or summary'
            )}
            .
          </p>
          {page.items.length === 0 && (
            <p>
              No publication heads match this page. Change filters or reset the
              queue.
            </p>
          )}
          <div className="ops-items">
            {page.items.map(({ item, changedAt }) => (
              <div
                key={`${item.id}:${item.version}`}
                style={{ minWidth: 0, overflowWrap: 'anywhere' }}
              >
                <p className="muted">
                  Edition changed {new Date(changedAt).toLocaleString()}
                </p>
                {renderItem(item)}
              </div>
            ))}
          </div>
        </>
      )}
      <nav aria-label="Publishing pages" className="page-actions">
        <button
          disabled={loading || selection.previous.length === 0}
          onClick={() => {
            const previous = selection.previous.slice(0, -1);
            void load(
              {
                filters: selection.filters,
                cursor: selection.previous.at(-1) ?? null,
                previous,
              },
              true,
            );
          }}
        >
          Previous publishing page
        </button>
        <button
          disabled={loading || !page?.nextCursor}
          onClick={() => {
            if (page?.nextCursor)
              void load(
                {
                  filters: selection.filters,
                  cursor: page.nextCursor,
                  previous: [...selection.previous, selection.cursor],
                },
                true,
              );
          }}
        >
          Next publishing page
        </button>
      </nav>
    </section>
  );
}
