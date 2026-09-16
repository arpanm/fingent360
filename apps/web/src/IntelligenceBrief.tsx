import { useEffect, useRef, useState } from 'react';
import {
  IntelligenceBriefPublicSchema,
  IntelligenceBriefListSchema,
  IntelligenceBriefHistorySchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
export function IntelligenceBrief({ route }: { route: string }) {
  const id = route.split('?')[0]!.split('/')[1],
    epoch = useRef(0),
    [view, setView] = useState<ReturnType<
      typeof IntelligenceBriefPublicSchema.parse
    > | null>(null),
    [list, setList] = useState<ReturnType<
      typeof IntelligenceBriefListSchema.parse
    > | null>(null),
    [history, setHistory] = useState<ReturnType<
      typeof IntelligenceBriefHistorySchema.parse
    > | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function load(after?: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    setError('');
    setView(null);
    setHistory(null);
    try {
      if (id) {
        const value = IntelligenceBriefPublicSchema.parse(
          await json('/intelligence-briefs/' + id),
        );
        if (ticket === epoch.current) setView(value);
      } else {
        const value = IntelligenceBriefListSchema.parse(
          await json('/intelligence-briefs' + (after ? '?after=' + after : '')),
        );
        if (ticket === epoch.current) setList(value);
      }
    } catch (cause) {
      if (ticket === epoch.current)
        setError(cause instanceof Error ? cause.message : 'Brief unavailable.');
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, [id]);
  async function moreHistory() {
    if (!id) return;
    const ticket = epoch.current;
    setBusy(true);
    setError('');
    try {
      const value = IntelligenceBriefHistorySchema.parse(
        await json(
          `/intelligence-briefs/${id}/history` +
            (history?.nextBefore ? '?before=' + history.nextBefore : ''),
        ),
      );
      if (ticket === epoch.current) setHistory(value);
    } catch (cause) {
      if (ticket === epoch.current)
        setError(
          cause instanceof Error ? cause.message : 'History unavailable.',
        );
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  return (
    <main
      className="source-workflow"
      aria-label="Intelligence brief"
      aria-busy={busy}
    >
      <a href={id ? '#intelligence-briefs' : '#today'}>
        {id ? 'Back to briefs' : 'Back to Today'}
      </a>
      <h1>{view?.title ?? 'Your reviewed market brief'}</h1>
      <p>
        Five or six source-backed editorial points, independently reviewed. Each
        point retains its original event edition. This is educational context,
        not a prediction or financial action.
      </p>
      {busy && <p role="status">Loading admitted brief evidence…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh brief
      </button>
      {!id &&
        list?.items.map((item) => (
          <article key={item.id}>
            <h2>
              <a href={'#intelligence-briefs/' + item.id}>{item.title}</a>
            </h2>
            <p>
              Version {item.version} · issued {item.issuedAt} · {item.status}
            </p>
            <p>
              {item.points.filter((point) => point.status === 'current').length}{' '}
              of {item.points.length} points currently admitted.
            </p>
          </article>
        ))}
      {!id && list && !list.items.length && (
        <p>
          No independently issued brief yet. Browse available reviewed events
          while the editorial team prepares five or six supported points.
        </p>
      )}
      {!id && list?.next && (
        <button disabled={busy} onClick={() => void load(list.next!)}>
          Next briefs
        </button>
      )}
      {view && (
        <>
          <p>
            Issued {view.issuedAt} · version {view.version} · checked{' '}
            {view.evaluatedAt}
          </p>
          {view.status === 'withdrawn' ? (
            <p role="status">
              This brief was withdrawn. Its points are no longer displayed.
            </p>
          ) : (
            <ol aria-label="Reviewed brief points">
              {view.points.map((point, index) => (
                <li key={point.id}>
                  <h2>
                    {point.event?.event?.editorial.title ??
                      `Point ${index + 1} ${point.status}`}
                  </h2>
                  {point.reasons.map((reason) => (
                    <p key={reason} role="status">
                      {reason}
                    </p>
                  ))}
                  {point.event?.event && (
                    <>
                      <p>{point.event.event.editorial.explanation}</p>
                      <details>
                        <summary>
                          Sources and context for point {index + 1}
                        </summary>
                        {point.event.event.sources.map((source) => (
                          <p key={source.id}>
                            <a href={'#read/' + source.id}>
                              {source.source.name}: {source.title}
                            </a>{' '}
                            · {source.effectiveLabel} · source version{' '}
                            {source.version} · retrieved{' '}
                            {source.source.retrievedAt}
                          </p>
                        ))}
                        {point.event.event.editorial.links.map((link, n) => (
                          <p key={n}>
                            {link.kind === 'sector' ? (
                              <a
                                href={
                                  '#events?sector=' +
                                  encodeURIComponent(link.label)
                                }
                              >
                                {link.label} sector context
                              </a>
                            ) : (
                              <>
                                <a href={'#securities/' + link.isin}>
                                  Company identity {link.isin}
                                </a>
                                {' · '}
                                <a href={'?equity=' + link.isin + '#equities'}>
                                  Company evidence
                                </a>
                              </>
                            )}{' '}
                            · {link.rationale}
                          </p>
                        ))}
                      </details>
                    </>
                  )}
                  <a href={'#events/' + point.id}>
                    {point.status === 'current'
                      ? 'Open reviewed event'
                      : 'Check current event'}
                  </a>
                </li>
              ))}
            </ol>
          )}
          <button disabled={busy} onClick={() => void moreHistory()}>
            {history?.nextBefore
              ? 'Older issued versions'
              : 'Issued version history'}
          </button>
          {history && (
            <>
              <p>
                History identifies issued editions; changed or withdrawn point
                text is never silently restored.
              </p>
              <ul>
                {history.versions.map((version) => (
                  <li key={version.version}>
                    Version {version.version} · {version.issuedAt}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <a href="#events">Browse reviewed events</a>
      <p>
        An installed offline snapshot cannot know about changes made after it
        was built. Refresh or rebuild before relying on current-source
        admission.
      </p>
    </main>
  );
}
