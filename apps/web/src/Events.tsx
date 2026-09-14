import { useEffect, useRef, useState } from 'react';
import {
  EventListSchema,
  EventPublicSchema,
  EventHistorySchema,
  type EventRevision,
} from '@fingent360/contracts';
import { json } from './net';
import './events.css';
import { EventLineage } from './EventLineage';
const eventDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not specified by the researcher';
function EventBody({ event }: { event: EventRevision }) {
  return (
    <>
      <p className="page-kicker">
        {event.editorial.claimKind} · editorial event · revision {event.version}
      </p>
      <h1>{event.editorial.title}</h1>
      <p>
        <a
          href={'#events?family=' + encodeURIComponent(event.editorial.family)}
        >
          {event.editorial.family}
        </a>{' '}
        · {event.editorial.geography.join(', ')}
      </p>
      <p>{event.editorial.explanation}</p>
      <dl>
        <dt>Announced</dt>
        <dd>{eventDate(event.editorial.announcedAt)}</dd>
        <dt>Effective</dt>
        <dd>{eventDate(event.editorial.effectiveAt)}</dd>
        <dt>Record captured</dt>
        <dd>
          <time dateTime={event.recordedAt}>{eventDate(event.recordedAt)}</time>
        </dd>
      </dl>
      <p>
        Price direction, causal effect and financial action: unavailable. These
        links are reviewed editorial context, not a recommendation or an
        exposure calculation.
      </p>
      <h2>Read the supporting source excerpts</h2>
      {event.editorial.citations.map((citation, index) => (
        <article className="panel" key={index}>
          <blockquote>{citation.quote}</blockquote>
          <p>
            {
              event.sources.find((source) => source.id === citation.sourceId)
                ?.source.name
            }{' '}
            · source edition {citation.version}
          </p>
          <a href={'#read/' + encodeURIComponent(citation.sourceId)}>
            Read cited source
          </a>
          <details>
            <summary>Exact evidence reference</summary>
            <p>Source field: {citation.field}</p>
            <p className="hash">Evidence reference: {citation.hash}</p>
          </details>
        </article>
      ))}
      <h2>Connected context</h2>
      {!event.editorial.links.length && (
        <p>No sector or instrument connection was reviewed for this event.</p>
      )}
      {event.editorial.links.map((link, index) => (
        <article className="panel" key={index}>
          <h3>
            {link.kind === 'sector'
              ? link.label
              : event.identities.find((row) => row.isin === link.isin)
                  ?.candidates[0]?.name}
          </h3>
          <p>
            {link.kind === 'sector'
              ? 'Editorial sector context; not a verified instrument classification.'
              : 'Retained security identity; no portfolio exposure or price assertion.'}
          </p>
          <p>{link.rationale}</p>
          <p>Supported by excerpt {link.citation + 1}. Direction: unknown.</p>
          {link.kind === 'instrument' && (
            <a href={'#securities/' + link.isin}>Look up instrument identity</a>
          )}
          <a
            href={
              '#events?' +
              (link.kind === 'sector'
                ? 'sector=' + encodeURIComponent(link.label)
                : 'isin=' + link.isin)
            }
          >
            More events with this context
          </a>
        </article>
      ))}
    </>
  );
}
export function Events({ route }: { route: string }) {
  const [list, setList] = useState<typeof EventListSchema._output | null>(null);
  const [detail, setDetail] = useState<typeof EventPublicSchema._output | null>(
    null,
  );
  const [history, setHistory] = useState<
    typeof EventHistorySchema._output | null
  >(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const live = useRef(false),
    generation = useRef(0);
  const id = route.split('?')[0]!.startsWith('events/')
    ? route.split('?')[0]!.slice(7)
    : null;
  const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
  async function load(after?: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    if (!after) {
      setList(null);
      setDetail(null);
      setHistory(null);
    }
    try {
      if (id) {
        const value = EventPublicSchema.parse(
          await json('/events/' + encodeURIComponent(id)),
        );
        if (live.current && ticket === generation.current) setDetail(value);
      } else {
        const params = new URLSearchParams(query);
        if (after) params.set('after', after);
        const value = EventListSchema.parse(await json('/events?' + params));
        if (live.current && ticket === generation.current)
          setList((old) =>
            after && old
              ? { ...value, items: [...old.items, ...value.items] }
              : value,
          );
      }
    } catch (failure) {
      if (live.current && ticket === generation.current)
        setError(
          failure instanceof Error ? failure.message : 'Events unavailable.',
        );
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  async function loadHistory(before?: number) {
    if (!id) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const value = EventHistorySchema.parse(
        await json(
          '/events/' +
            encodeURIComponent(id) +
            '/history' +
            (before ? '?before=' + before : ''),
        ),
      );
      if (live.current && ticket === generation.current)
        setHistory((old) =>
          before && old
            ? { ...value, revisions: [...old.revisions, ...value.revisions] }
            : value,
        );
    } catch (failure) {
      if (live.current && ticket === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Publication history unavailable.',
        );
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
    };
  }, [route]);
  return (
    <section className="account reviewed-events" aria-label="Reviewed events">
      <a href={id ? '#events' : '#explore'}>
        Back to {id ? 'events' : 'Explore'}
      </a>
      {!id && (
        <>
          <h1>Reviewed events</h1>
          <p>
            Explicitly reviewed source context. No automated market-impact
            claims.
          </p>
        </>
      )}
      {busy && <p role="status">Loading reviewed events…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Reload events
      </button>
      {detail?.reviewedAt && (
        <p>
          Publication reviewed{' '}
          <time dateTime={detail.reviewedAt}>
            {eventDate(detail.reviewedAt)}
          </time>
          .
        </p>
      )}
      {detail &&
        (detail.event ? (
          <EventBody event={detail.event} />
        ) : (
          <p role="status">
            This event is {detail.status}. Its source or identity context
            changed; the original event content is unavailable pending review.
          </p>
        ))}
      {detail?.event?.editorial.links
        .filter((link) => link.kind === 'instrument' && link.selection)
        .map((link, index) => (
          <p key={index}>
            Identity context uses editorial judgement, not externally verified
            identity:{' '}
            {link.kind === 'instrument' && link.selection?.candidate.name}.
            Provider ambiguity is unchanged.
          </p>
        ))}
      {detail && <EventLineage id={detail.id} />}
      {detail && (
        <section aria-label="Event publication history">
          <button disabled={busy} onClick={() => void loadHistory()}>
            Read publication history
          </button>
          {history && (
            <>
              <p>
                Dated reviewed publication/withdrawal revisions; unpublished
                drafts and original withdrawn text are excluded.
              </p>
              <ul>
                {history.revisions.map((row) => (
                  <li key={row.version}>
                    Revision {row.version} ·{' '}
                    <time dateTime={row.recordedAt}>
                      {eventDate(row.recordedAt)}
                    </time>
                  </li>
                ))}
              </ul>
              {history.nextBefore && (
                <button
                  disabled={busy}
                  onClick={() => void loadHistory(history.nextBefore!)}
                >
                  More publication history
                </button>
              )}
            </>
          )}
        </section>
      )}
      {list && (
        <>
          {!list.items.length && !busy && (
            <p>
              No reviewed events match this page. Check the next page when
              available.
            </p>
          )}
          {list.items.map((item) => (
            <article className="panel" key={item.id}>
              {item.event ? (
                <>
                  <p>
                    {item.event.editorial.claimKind} ·{' '}
                    {item.event.editorial.family}
                  </p>
                  <h2>
                    <a href={'#events/' + item.id}>
                      {item.event.editorial.title}
                    </a>
                  </h2>
                  <p>{item.event.editorial.explanation}</p>
                </>
              ) : (
                <p>An event is {item.status}; its content is unavailable.</p>
              )}
            </article>
          ))}
          {list.next && (
            <button disabled={busy} onClick={() => void load(list.next!)}>
              More reviewed events
            </button>
          )}
          <p>
            Checked{' '}
            <time dateTime={list.evaluatedAt}>
              {eventDate(list.evaluatedAt)}
            </time>
            . On-device results reflect only the installed dated bundle.
          </p>
        </>
      )}
    </section>
  );
}
