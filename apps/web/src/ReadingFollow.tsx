import { ReadingCalendarContext } from './ReadingCalendarContext';
import { useEffect, useRef, useState } from 'react';
import {
  ReadingFollowViewSchema,
  ReadingFollowReceiptSchema,
  ReadingFollowExportSchema,
  ResearchCatalogSchema,
  type ReadingFollowConfig,
  type ReadingFollowReceipt,
  type ReadingFollowEvent,
  type ResearchCatalog,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { Dialog } from './Dialog';
import { json, RequestError } from './net';
import { useDraftGuard } from './useDraftGuard';
type View = ReturnType<typeof ReadingFollowViewSchema.parse>;
type Pending = { path: string; body: unknown; method: string };
export function ReadingFollow() {
  const [data, setData] = useState<View | null>(null),
    [catalog, setCatalog] = useState<ResearchCatalog | null>(null),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [guest, setGuest] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<ReadingFollowReceipt | null>(null),
    [pending, setPending] = useState<Pending | null>(null),
    [draft, setDraft] = useState<ReadingFollowConfig | null>(null),
    [review, setReview] = useState(false),
    [consent, setConsent] = useState(false),
    [historyBusy, setHistoryBusy] = useState(false),
    [history, setHistory] = useState<ReadingFollowEvent[] | null>(null),
    [nextHistory, setNextHistory] = useState<{
      after: string;
      upper: string;
    } | null>(null);
  const [filter, setFilter] = useState('all');
  const live = useRef(false),
    denied = useRef(false),
    generation = useRef(0),
    historyGeneration = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  useDraftGuard(
    !!draft && JSON.stringify(draft) !== JSON.stringify(data?.config),
    'Discard unsaved reading subscription choices?',
  );
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      denied.current = true;
      generation.current++;
      historyGeneration.current++;
      setGuest(true);
      setData(null);
      setCatalog(null);
      setDraft(null);
      setHistory(null);
      setReceipt(null);
      setPending(null);
      setReview(false);
      setReady(false);
      setError('');
      return;
    }
    setError(
      e instanceof Error ? e.message : 'Reading updates unavailable. Retry.',
    );
  }
  async function load(after?: string) {
    if (denied.current) return;
    const ticket = ++generation.current;
    setBusy(true);
    setReady(false);
    setError('');
    try {
      const result = ReadingFollowViewSchema.parse(
        await json(
          `/account/reading-follow${after ? '?after=' + encodeURIComponent(after) : ''}`,
        ),
      );
      if (!live.current || denied.current || ticket !== generation.current)
        return;
      setData(result);
      setReady(true);
    } catch (e) {
      if (
        (e instanceof RequestError && e.status === 401) ||
        ticket === generation.current
      )
        fail(e);
    } finally {
      if (live.current && !denied.current && ticket === generation.current)
        setBusy(false);
    }
  }
  async function act(action: Pending) {
    if (denied.current) return;
    setBusy(true);
    setReady(false);
    setError('');
    setPending(action);
    setReview(false);
    generation.current++;
    try {
      const result = ReadingFollowReceiptSchema.parse(
        await json(
          '/account/reading-follow' + action.path,
          action.body,
          action.method,
        ),
      );
      if (!live.current || denied.current) return;
      setReceipt(result);
      setPending(null);
      setDraft(null);
      setConsent(false);
      await load();
      heading.current?.focus();
    } catch (e) {
      if (e instanceof RequestError && e.status === 409) setPending(null);
      fail(e);
    } finally {
      if (live.current && !denied.current) setBusy(false);
    }
  }
  async function loadHistory(older = false) {
    const ticket = ++historyGeneration.current;
    setHistoryBusy(true);
    setError('');
    try {
      const page = ReadingFollowExportSchema.parse(
        await json(
          '/account/reading-follow/export' +
            (older && nextHistory
              ? '?' + new URLSearchParams(nextHistory)
              : ''),
        ),
      );
      if (
        !live.current ||
        denied.current ||
        ticket !== historyGeneration.current
      )
        return;
      setHistory((previous) =>
        older ? [...(previous ?? []), ...page.events] : page.events,
      );
      setNextHistory(
        page.next ? { after: page.next, upper: page.upper } : null,
      );
    } catch (e) {
      if (
        (e instanceof RequestError && e.status === 401) ||
        ticket === historyGeneration.current
      )
        fail(e);
    } finally {
      if (
        live.current &&
        !denied.current &&
        ticket === historyGeneration.current
      )
        setHistoryBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    void json('/discovery/catalog')
      .then((value) => {
        if (live.current && !denied.current)
          setCatalog(ResearchCatalogSchema.parse(value));
      })
      .catch(fail);
    return () => {
      live.current = false;
      generation.current++;
      historyGeneration.current++;
    };
  }, []);
  if (guest)
    return (
      <AccountGate
        next="reading-follow"
        title="Sign in for reading updates"
        description="Follow reviewed sources and topics in your own private workspace."
      />
    );
  const edited =
    !!draft && JSON.stringify(draft) !== JSON.stringify(data?.config);
  const visibleItems =
    data?.items.filter((item) => filter === 'all' || item.status === filter) ??
    [];
  return (
    <section
      className="account"
      aria-label="Reading updates"
      data-feedback-private
    >
      <header className="page-header">
        <p className="page-kicker">YOUR READING</p>
        <h1 ref={heading} tabIndex={-1}>
          Reading updates
        </h1>
        <p>
          Follow sources or topics, then check already reviewed reading when you
          choose. This does not fetch providers, send alerts or change your
          investments.
        </p>
      </header>
      <nav className="page-actions">
        <a href="#saved">Saved reading</a>
        <a href="#explore">Explore</a>
        <a href="#privacy">Privacy and complete export</a>
      </nav>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading reading updates…</p>}
      <button className="secondary" disabled={busy} onClick={() => void load()}>
        Reload reading updates
      </button>
      {data && !ready && (
        <p role="note">
          These observations are historical. Reload successfully before another
          action or opening reading.
        </p>
      )}
      {pending && (
        <aside className="panel">
          <p>
            The result is uncertain. Retry this exact request to recover its
            original receipt.
          </p>
          <button disabled={busy} onClick={() => void act(pending)}>
            Retry same reading action
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setPending(null);
              setReady(false);
            }}
          >
            Dismiss retry
          </button>
        </aside>
      )}
      {receipt && (
        <section className="panel" aria-label="Saved reading action">
          <h2>Saved action receipt</h2>
          <p>
            {receipt.kind} completed {receipt.completedAt}. Examined{' '}
            {receipt.examined}; changed {receipt.changed}. This is a historical
            result; only a successful reload establishes currently available
            actions.
          </p>
        </section>
      )}
      {data && (
        <>
          <p>
            Observed {data.observedAt}.{' '}
            {data.bundleGeneratedAt
              ? `On this device, bundle ${data.bundleGeneratedAt}. Later server publications or withdrawals require an updated bundle.`
              : 'Reviewed editions stored on this server only.'}
          </p>
          {data.calendarContext && (
            <ReadingCalendarContext value={data.calendarContext} />
          )}
          <section className="panel">
            <h2>What you follow</h2>
            <p>
              Sources:{' '}
              {data.config.sources
                .map(
                  (id) =>
                    catalog?.sources.find((source) => source.id === id)?.name ??
                    id,
                )
                .join(', ') || 'None'}
              . Topics: {data.config.topics.join(', ') || 'None'}.{' '}
              {data.config.muted ? 'Muted' : 'Active'} · settings revision{' '}
              {data.config.version}.
            </p>
            <p>
              These subscriptions are separate from For you ranking preferences.
            </p>
            <button
              disabled={!ready || busy || !!pending || !!draft || !catalog}
              onClick={() => {
                setDraft(structuredClone(data.config));
                setConsent(false);
              }}
            >
              Choose sources and topics
            </button>
            {!catalog && (
              <button
                disabled={busy}
                onClick={() =>
                  void json('/discovery/catalog')
                    .then((value) =>
                      setCatalog(ResearchCatalogSchema.parse(value)),
                    )
                    .catch(fail)
                }
              >
                Retry catalogue choices
              </button>
            )}
            <button
              disabled={
                !ready ||
                busy ||
                !!pending ||
                !!draft ||
                !data.config.version ||
                data.config.muted
              }
              onClick={() =>
                void act({
                  path: '/check',
                  method: 'POST',
                  body: {
                    requestId: crypto.randomUUID(),
                    expectedVersion: data.config.version,
                  },
                })
              }
            >
              Check for reading updates
            </button>
            {!data.config.version && (
              <p>
                Choose what to follow. Saving establishes a baseline with no
                historical backlog.
              </p>
            )}
            {data.config.muted && (
              <p>
                Checks are paused. Edit subscriptions to unmute and establish a
                fresh baseline without the muted-period backlog.
              </p>
            )}
          </section>
          {draft && (
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                setReview(true);
              }}
            >
              <h2>Edit subscriptions</h2>
              <fieldset disabled={busy || !!pending}>
                <legend>Sources</legend>
                {catalog?.sources.map((source) => (
                  <label className="check-label" key={source.id}>
                    <input
                      type="checkbox"
                      checked={draft.sources.includes(source.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sources: e.target.checked
                            ? [...draft.sources, source.id]
                            : draft.sources.filter((id) => id !== source.id),
                        })
                      }
                    />
                    {source.name}
                  </label>
                ))}
              </fieldset>
              <fieldset disabled={busy || !!pending}>
                <legend>Topics</legend>
                {[
                  ...new Set([
                    ...(catalog?.topics ?? []),
                    ...data.config.topics,
                    ...draft.topics,
                  ]),
                ]
                  .sort()
                  .map((topic) => (
                    <label className="check-label" key={topic}>
                      <input
                        type="checkbox"
                        checked={draft.topics.includes(topic)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            topics: e.target.checked
                              ? [...draft.topics, topic]
                              : draft.topics.filter((t) => t !== topic),
                          })
                        }
                      />
                      {topic}
                      {!catalog?.topics.includes(topic)
                        ? ' (not currently published)'
                        : ''}
                    </label>
                  ))}
              </fieldset>
              <label className="check-label">
                <input
                  type="checkbox"
                  disabled={busy || !!pending}
                  checked={draft.muted}
                  onChange={(e) =>
                    setDraft({ ...draft, muted: e.target.checked })
                  }
                />
                Mute reading updates
              </label>
              <p>
                New follows start with a fresh baseline. Retained follows keep
                their notices. Mute preserves their last observed editions;
                unmute explicitly resets the baseline without delivering the
                muted-period backlog.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  disabled={busy || !!pending}
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I agree to store my reading subscriptions and dated update
                history.
              </label>
              <div className="page-actions">
                <button
                  disabled={!edited || !consent || busy || !ready || !!pending}
                >
                  Review subscription changes
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || !!pending}
                  onClick={() => {
                    if (
                      !edited ||
                      window.confirm('Discard unsaved subscription choices?')
                    ) {
                      setDraft(null);
                      setReview(false);
                      setConsent(false);
                      void load();
                    }
                  }}
                >
                  Discard draft and reload
                </button>
              </div>
            </form>
          )}
          <section aria-label="Reading update inbox">
            <h2>Your dated reading updates</h2>
            <label htmlFor="reading-notice-filter">
              Notice status on this page
            </label>
            <select
              id="reading-notice-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <p>
              {data.items.filter((i) => i.status === 'open').length} open on
              this page. Reload returns to the first page.
            </p>
            {!data.items.length && (
              <p>
                No notices in this view. A baseline or unchanged check does not
                create an alert.
              </p>
            )}
            {data.items.length > 0 && !visibleItems.length && (
              <p>No {filter} notices on this page.</p>
            )}
            {visibleItems.map((item) => {
              const published = ready
                ? data.publishedReading.find(
                    (reading) => reading.id === item.itemId,
                  )
                : undefined;
              return (
                <article className="panel" key={item.itemId}>
                  <h3 style={{ overflowWrap: 'anywhere' }}>
                    {published?.title ??
                      (ready
                        ? 'Reading withdrawn or unavailable'
                        : 'Reading update')}
                  </h3>
                  {published && (
                    <p>
                      {published.sourceName} · Currently published edition{' '}
                      {published.edition}. Title checked with this view; the
                      notice below retains its observed edition.
                    </p>
                  )}
                  <details>
                    <summary>Notice reference</summary>
                    <p style={{ overflowWrap: 'anywhere' }}>{item.itemId}</p>
                  </details>
                  <p>
                    {item.status} ·{' '}
                    {
                      {
                        baseline: 'Starting baseline',
                        new: 'New reading',
                        edition: 'New edition',
                        withdrawn: 'Source withdrawn',
                        republished: 'Reading republished',
                        'no-longer-followed': 'No longer followed',
                      }[item.reason]
                    }{' '}
                    · observed edition {item.edition} at {item.observedAt}
                  </p>
                  <p>
                    Following:{' '}
                    {item.matched
                      .map((key) =>
                        key.startsWith('source:')
                          ? (catalog?.sources.find(
                              (source) => source.id === key.slice(7),
                            )?.name ?? 'Previously followed source')
                          : key.replace(/^topic:/, ''),
                      )
                      .join(', ') || 'No active subscription'}
                    . This is a reading change, not an investment signal.
                  </p>
                  {ready && data.availableIds.includes(item.itemId) ? (
                    <a href={`#read/${item.itemId}`}>
                      Open currently available reading
                    </a>
                  ) : (
                    <p>
                      Current reading is unavailable or has not been rechecked.
                      No article text is retained in notice history.
                    </p>
                  )}
                  {item.status === 'open' && (
                    <button
                      aria-label={`Acknowledge ${item.itemId}`}
                      disabled={!ready || busy || !!pending || !!draft}
                      onClick={() =>
                        void act({
                          path: `/notices/${item.itemId}/acknowledge`,
                          method: 'POST',
                          body: {
                            requestId: crypto.randomUUID(),
                            expectedVersion: item.version,
                          },
                        })
                      }
                    >
                      Mark as read
                    </button>
                  )}
                </article>
              );
            })}
            {data.next && (
              <button disabled={busy} onClick={() => void load(data.next!)}>
                More reading notices
              </button>
            )}
          </section>
          <button
            disabled={busy || historyBusy}
            onClick={() => void loadHistory()}
          >
            View reading update history
          </button>
        </>
      )}
      {historyBusy && <p role="status">Loading reading history…</p>}
      {history && (
        <section className="panel" aria-label="Reading update history">
          <h2>Immutable history</h2>
          <p>
            Historical events contain identifiers and your choices, never copied
            article text.
          </p>
          <ol>
            {history.map((event) => (
              <li key={event.sequence}>
                {event.sequence} · {event.record.kind} ·{' '}
                {event.record.kind === 'operation'
                  ? event.record.receipt.completedAt
                  : event.record.kind === 'config'
                    ? `settings revision ${event.record.config.version}`
                    : `${event.record.item.itemId}: ${event.record.item.status}, edition ${event.record.item.edition}`}
              </li>
            ))}
          </ol>
          {nextHistory && (
            <button
              disabled={busy || historyBusy}
              onClick={() => void loadHistory(true)}
            >
              More history entries
            </button>
          )}
          <button
            onClick={() => {
              historyGeneration.current++;
              setHistoryBusy(false);
              setHistory(null);
            }}
          >
            Close reading history
          </button>
        </section>
      )}
      {review && draft && (
        <Dialog
          title="Save subscription baseline?"
          onClose={() => setReview(false)}
        >
          <p>
            Following {draft.sources.length} sources and {draft.topics.length}{' '}
            topics.{' '}
            {draft.muted ? 'Updates will be muted.' : 'Updates will be active.'}{' '}
            Newly followed reading becomes a seen baseline. Retained follows
            keep existing notices when choices change or are muted. Unmuting
            explicitly refreshes all baselines and resolves prior notices
            without a historical backlog.
          </p>
          <button onClick={() => setReview(false)}>Back to choices</button>
          <button
            disabled={!ready || busy || !consent}
            onClick={() =>
              void act({
                path: '',
                method: 'PUT',
                body: {
                  requestId: crypto.randomUUID(),
                  expectedVersion: draft.version,
                  sources: draft.sources,
                  topics: draft.topics,
                  muted: draft.muted,
                  consent: true,
                },
              })
            }
          >
            Confirm subscription baseline
          </button>
        </Dialog>
      )}
    </section>
  );
}
