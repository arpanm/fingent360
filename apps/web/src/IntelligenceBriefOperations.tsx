import { useEffect, useRef, useState } from 'react';
import {
  IntelligenceBriefQueueSchema,
  IntelligenceBriefReceiptSchema,
  EventListSchema,
} from '@fingent360/contracts';
import type { json } from './net';
import './source-workflows.css';
export function IntelligenceBriefOperations({
  request,
}: {
  request: typeof json;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof IntelligenceBriefQueueSchema.parse
    > | null>(null),
    [candidates, setCandidates] = useState<ReturnType<
      typeof EventListSchema.parse
    > | null>(null),
    [selected, setSelected] = useState<{ id: string; version: number }[]>([]),
    [id, setId] = useState<string>(() => crypto.randomUUID()),
    [version, setVersion] = useState(0),
    [title, setTitle] = useState(''),
    [reason, setReason] = useState(''),
    [reviewReason, setReviewReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const live = useRef(true),
    pending = useRef<{ key: string; requestId: string } | null>(null);
  async function load(after?: string) {
    setBusy(true);
    setError('');
    try {
      const values = await Promise.all([
        request('/ops/intelligence-briefs' + (after ? '?after=' + after : '')),
        request('/ops/intelligence-briefs/candidates'),
      ]);
      if (live.current) {
        setQueue(IntelligenceBriefQueueSchema.parse(values[0]));
        setCandidates(EventListSchema.parse(values[1]));
      }
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Brief preparation unavailable.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, []);
  async function send(
    path: string,
    method: 'PUT' | 'POST',
    input: Record<string, unknown>,
  ) {
    const key = JSON.stringify({ path, method, input });
    if (pending.current?.key !== key)
      pending.current = { key, requestId: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(
        '/ops/intelligence-briefs/' + path,
        { ...input, requestId: pending.current.requestId },
        method,
      );
      if (method === 'PUT') {
        const saved = IntelligenceBriefReceiptSchema.parse(result);
        setVersion(saved.version);
      }
      pending.current = null;
      setNotice(
        method === 'PUT'
          ? 'Brief draft retained. A different named reviewer must issue it.'
          : 'Brief review saved. Current source admission still governs every point.',
      );
      await load();
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Brief operation unavailable.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function nextCandidates() {
    if (!candidates?.next) return;
    setBusy(true);
    setError('');
    try {
      const next = EventListSchema.parse(
        await request(
          '/ops/intelligence-briefs/candidates?after=' + candidates.next,
        ),
      );
      if (live.current) setCandidates(next);
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Candidate page unavailable.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Editorial brief preparation"
      aria-busy={busy}
    >
      <h2>Five or six points worth understanding</h2>
      <p>
        Choose current reviewed fact events. Their exact explanation and source
        bindings become the brief points. At least one actual sector link and
        company identity must be present. There are no generated filler points.
      </p>
      {busy && <p role="status">Loading or saving brief…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh editorial briefs
      </button>
      <button
        disabled={busy}
        onClick={() => {
          setId(crypto.randomUUID());
          setVersion(0);
          setTitle('');
          setReason('');
          setSelected([]);
          pending.current = null;
        }}
      >
        Start a new brief
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(id, 'PUT', {
            expectedVersion: version,
            title,
            reason,
            events: selected,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Brief version {version + 1}</legend>
          <label>
            Brief title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={5}
              maxLength={160}
              required
            />
          </label>
          <label>
            Preparation or correction reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={12}
              maxLength={2000}
              required
            />
          </label>
          <p>{selected.length} selected; choose five or six distinct points.</p>
          {candidates?.items.map(
            (item) =>
              item.event && (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected.some((row) => row.id === item.id)}
                    disabled={
                      !selected.some((row) => row.id === item.id) &&
                      selected.length >= 6
                    }
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [
                              ...old,
                              { id: item.id, version: item.event!.version },
                            ]
                          : old.filter((row) => row.id !== item.id),
                      )
                    }
                  />
                  {item.event.editorial.title} · version {item.event.version}
                  {selected.some(
                    (row) =>
                      row.id === item.id && row.version !== item.event!.version,
                  ) && (
                    <span>
                      Selected older version: uncheck and select again to accept
                      this current reviewed version.
                    </span>
                  )}
                  <a href={'#events/' + item.id}>Inspect event and sources</a>
                </label>
              ),
          )}
          {candidates && !candidates.items.length && (
            <p>
              No admitted fact events on this page. Prepare and review
              source-backed Events first.
            </p>
          )}
          {candidates?.next && (
            <button type="button" onClick={() => void nextCandidates()}>
              Next candidate events
            </button>
          )}
          {selected.length > 0 && (
            <details>
              <summary>Selected event IDs and versions</summary>
              {selected.map((row) => (
                <p key={row.id}>
                  {row.id} · {row.version}
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((old) =>
                        old.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    Remove selected event {row.id}
                  </button>
                </p>
              ))}
            </details>
          )}
          <button disabled={selected.length < 5 || selected.length > 6}>
            Save brief draft
          </button>
        </fieldset>
      </form>
      <label>
        Independent publication or withdrawal reason
        <textarea
          value={reviewReason}
          onChange={(e) => setReviewReason(e.target.value)}
          minLength={12}
          maxLength={2000}
        />
      </label>
      {queue?.items.map((item) => (
        <article key={item.receipt.id}>
          <h3>{item.receipt.input.title}</h3>
          <p>
            Prepared version {item.receipt.version} · current state {item.state}{' '}
            · published version {item.publishedVersion ?? 'none'}
          </p>
          <details>
            <summary>Inspect prepared points</summary>
            {item.receipt.events.map((event) => (
              <p key={event.id}>
                <a href={'#events/' + event.id}>
                  {event.event!.editorial.title}
                </a>{' '}
                · version {event.event!.version}
              </p>
            ))}
          </details>
          <button
            disabled={busy}
            onClick={() => {
              setId(item.receipt.id);
              setVersion(item.receipt.version);
              setTitle(item.receipt.input.title);
              setReason('');
              setSelected(item.receipt.input.events);
              pending.current = null;
            }}
          >
            Prepare corrected version
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={busy || reviewReason.trim().length < 12}
              onClick={() =>
                void send(item.receipt.id + '/review', 'POST', {
                  expectedVersion: item.receipt.version,
                  decision,
                  reason: reviewReason,
                })
              }
            >
              {decision === 'publish'
                ? 'Independently issue brief'
                : 'Withdraw brief'}
            </button>
          ))}
          {item.publishedVersion && (
            <a href={'#intelligence-briefs/' + item.receipt.id}>
              Read issued brief
            </a>
          )}
        </article>
      ))}
      {queue && !queue.items.length && <p>No editorial briefs prepared yet.</p>}
      {queue?.next && (
        <button disabled={busy} onClick={() => void load(queue.next!)}>
          Next prepared briefs
        </button>
      )}
    </section>
  );
}
