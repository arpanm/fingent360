import { useEffect, useRef, useState } from 'react';
import {
  EventExtractionOptionsSchema,
  EventExtractionInputSchema,
  EventExtractionViewSchema,
  EventExtractionListSchema,
  EventExtractionDecisionInputSchema,
  PublishingPageSchema,
  PublishingFiltersSchema,
  eventExtractionMaterial,
  type EventExtractionView,
  type EventExtractionAttempt,
  type FeedItem,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { useDraftGuard } from './useDraftGuard';
import './event-extraction.css';

type Decision = ReturnType<typeof EventExtractionDecisionInputSchema.parse>;
type Pending =
  | {
      kind: 'prepare';
      id: string;
      body: ReturnType<typeof EventExtractionInputSchema.parse>;
    }
  | { kind: 'decision'; id: string; body: Decision };
const outcomes: Record<EventExtractionAttempt['outcome'], string> = {
  pending: 'Preparation is still in progress.',
  template: 'Exact source template; no AI was used.',
  model:
    'AI selected exact source excerpts. No model-written claims were accepted.',
  'not-configured':
    'No selected provider is configured. An exact source template was prepared.',
  'provider-failed':
    'The provider failed. Any candidate below is an exact source template, not a successful AI result.',
  'invalid-selection':
    'The provider selection was rejected. Any candidate below is an exact source template.',
  'source-changed':
    'The source changed before preparation could finish. Select its current edition.',
  interrupted:
    'Preparation was interrupted. Inspect this outcome before starting a new request.',
  storage:
    'Preparation could not be stored. Inspect the outcome before starting a new request.',
};
const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
export function EventExtraction({
  request,
  onOpenDraft,
  onClose,
  onDenied,
}: {
  request: typeof json;
  onOpenDraft: (id: string) => Promise<void>;
  onClose: () => void;
  onDenied?: () => void;
}) {
  const [options, setOptions] = useState<ReturnType<
    typeof EventExtractionOptionsSchema.parse
  > | null>(null);
  const [page, setPage] = useState<ReturnType<
    typeof PublishingPageSchema.parse
  > | null>(null);
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<FeedItem | null>(null);
  const [method, setMethod] =
    useState<ReturnType<typeof EventExtractionInputSchema.parse>['method']>(
      'template',
    );
  const [view, setView] = useState<EventExtractionView | null>(null);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [history, setHistory] = useState<ReturnType<
    typeof EventExtractionListSchema.parse
  > | null>(null);
  const [title, setTitle] = useState(''),
    [family, setFamily] = useState(''),
    [geography, setGeography] = useState('');
  const [claim, setClaim] = useState(''),
    [explanation, setExplanation] = useState(''),
    [reason, setReason] = useState('');
  const [review, setReview] = useState<'draft' | 'decline' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const live = useRef(false),
    generation = useRef(0),
    working = useRef(false),
    formId = useRef<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const dirty =
    !!pending ||
    (!!view?.attempt.candidate &&
      !view.decision &&
      (!!family ||
        !!geography ||
        !!claim ||
        !!reason ||
        title !== view.attempt.candidate.title ||
        explanation !==
          view.attempt.candidate.excerpts
            .map((item) => item.quote)
            .join('\n\n')));
  useDraftGuard(
    dirty,
    'Leave this source candidate with unsaved or unconfirmed work?',
  );
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  function clearCandidate() {
    setView(null);
    setSourceConfirmed(false);
    setPending(null);
    setReview(null);
    formId.current = null;
    setTitle('');
    setFamily('');
    setGeography('');
    setClaim('');
    setExplanation('');
    setReason('');
    setMessage('');
  }
  function receive(value: EventExtractionView) {
    setView(value);
    setSourceConfirmed(true);
    const candidate = value.attempt.candidate;
    if (candidate && formId.current !== value.attempt.requestId) {
      formId.current = value.attempt.requestId;
      setTitle(candidate.title);
      setExplanation(candidate.excerpts.map((item) => item.quote).join('\n\n'));
      setFamily('');
      setGeography('');
      setClaim('');
      setReason('');
      setReview(null);
    }
  }
  function parseView(raw: unknown, expectedId: string) {
    const result = EventExtractionViewSchema.parse(raw);
    if (result.attempt.requestId.toLowerCase() !== expectedId.toLowerCase())
      throw Error(
        'The returned extraction receipt belongs to another request. Retry the same request.',
      );
    return result;
  }
  async function action(work: (ticket: number) => Promise<void>) {
    if (working.current) return;
    working.current = true;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work(ticket);
    } catch (failure) {
      if (!live.current) return;
      if (failure instanceof RequestError && failure.status === 401) {
        generation.current++;
        clearCandidate();
        setSelected(null);
        setPage(null);
        setOptions(null);
        setHistory(null);
        setSearch('');
        setBusy(false);
        setError('Sign in to Operations again.');
        onDenied?.();
      } else if (ticket === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Candidate preparation is unavailable. Retry.',
        );
    } finally {
      working.current = false;
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  async function loadSources(ticket: number, cursor?: string) {
    const queryText = cursor ? page?.filters.q : search.trim();
    const filters = PublishingFiltersSchema.parse({
      status: 'published',
      ...(queryText ? { q: queryText } : {}),
    });
    const query = new URLSearchParams({ status: 'published' });
    if (filters.q) query.set('q', filters.q);
    if (cursor) query.set('cursor', cursor);
    const result = PublishingPageSchema.parse(
      await request('/ops/discovery/queue?' + query),
    );
    if (live.current && ticket === generation.current) {
      setPage(result);
      setSelected(null);
    }
  }
  useEffect(() => {
    live.current = true;
    const setup = ++generation.current;
    // Defer setup until the active mount survives StrictMode's cleanup/replay.
    void Promise.resolve().then(() => {
      if (!live.current || setup !== generation.current) return;
      return action(async (ticket) => {
        const result = EventExtractionOptionsSchema.parse(
          await request('/ops/event-extractions/options'),
        );
        if (!live.current || ticket !== generation.current) return;
        setOptions(result);
        setMethod(result.defaultMethod);
        await loadSources(ticket);
      });
    });
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  async function mutate(item: Pending, ticket: number) {
    setPending(item);
    let body: unknown;
    try {
      body =
        item.kind === 'prepare'
          ? await request('/ops/event-extractions/' + item.id, item.body, 'PUT')
          : await request(
              '/ops/event-extractions/' + item.id + '/decision',
              item.body,
              'POST',
            );
    } catch (failure) {
      if (
        live.current &&
        ticket === generation.current &&
        failure instanceof RequestError &&
        [400, 404, 409, 422].includes(failure.status) &&
        !(item.kind === 'prepare' && failure.status === 409)
      ) {
        setPending(null);
        setReview(null);
      }
      throw failure;
    }
    const result = parseView(body, item.id);
    if (
      item.kind === 'prepare' &&
      (result.attempt.source.id !== item.body.sourceId ||
        result.attempt.source.version !== item.body.expectedVersion ||
        result.attempt.source.hash !== item.body.sourceHash ||
        result.attempt.requestedMethod !== item.body.method)
    )
      throw Error(
        'The returned preparation does not match the selected source and method. Retry the same request.',
      );
    if (
      item.kind === 'decision' &&
      (!result.decision ||
        result.decision.requestId.toLowerCase() !==
          item.body.requestId.toLowerCase() ||
        result.decision.kind !== item.body.kind)
    )
      throw Error(
        'The returned decision does not confirm this request. Check the saved extraction receipt before continuing.',
      );
    if (!live.current || ticket !== generation.current) return;
    receive(result);
    setPending(result.attempt.status === 'running' ? item : null);
    setReview(null);
    setMessage(
      result.decision
        ? 'Decision saved. This is its historical receipt; publication is a separate review.'
        : 'Preparation receipt loaded. Review the exact excerpts and enter the missing event context.',
    );
  }
  function draftDecision(): Decision {
    if (!view?.attempt.candidate)
      throw Error('Load a prepared source candidate first.');
    return EventExtractionDecisionInputSchema.parse({
      requestId: crypto.randomUUID(),
      kind: 'draft',
      reason,
      editorial: {
        title,
        family,
        geography: geography
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        claimKind: claim,
        explanation,
        announcedAt: null,
        effectiveAt: null,
        links: [],
        citations: view.attempt.candidate.excerpts.map((excerpt) => ({
          sourceId: view.attempt.source.id,
          version: view.attempt.source.version,
          hash: view.attempt.source.hash,
          field: excerpt.field,
          quote: excerpt.quote,
        })),
      },
    });
  }
  function startReview(kind: 'draft' | 'decline') {
    try {
      if (kind === 'draft') draftDecision();
      else
        EventExtractionDecisionInputSchema.parse({
          requestId: crypto.randomUUID(),
          kind,
          reason,
        });
      setReview(kind);
      setError('');
    } catch {
      setError(
        kind === 'draft'
          ? 'Enter a title, event family, geography, claim type, explanation and review reason. Inspect every retained excerpt.'
          : 'Enter a reason before declining this candidate.',
      );
    }
  }
  function abandon(next: () => void) {
    if (
      !dirty ||
      window.confirm(
        'Leave this candidate with unsaved or unconfirmed work? Saved receipts remain available in history.',
      )
    )
      next();
  }
  const candidate = view?.attempt.candidate;
  const editable =
    sourceConfirmed &&
    !!candidate &&
    !view?.decision &&
    view?.currentSource === 'current';
  let preview: ReturnType<typeof eventExtractionMaterial> | null = null;
  if (selected) {
    try {
      preview = eventExtractionMaterial(selected);
    } catch {
      /* Invalid source cannot be prepared from this view. */
    }
  }
  return (
    <section
      className="event-extraction"
      aria-label="Prepare event from source"
      data-feedback-private
    >
      <button
        className="text-link back-control"
        onClick={() => abandon(onClose)}
      >
        Back to event review
      </button>
      <h2>Prepare an event from a source</h2>
      <p>
        Start with exact retained excerpts, add human-reviewed context, then
        save an ordinary draft. Preparation never publishes an event.
      </p>
      {busy && <p role="status">Working on the source candidate…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {pending && (
        <section className="panel" aria-label="Unconfirmed extraction request">
          <p>
            The last request is unconfirmed. Keep the same request identity when
            retrying. A busy response may mean the original preparation is still
            running; inspect its receipt before starting anything new.
          </p>
          <button
            disabled={busy}
            onClick={() => void action((ticket) => mutate(pending, ticket))}
          >
            Retry same extraction request
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async (ticket) => {
                setSourceConfirmed(false);
                const result = parseView(
                  await request('/ops/event-extractions/' + pending.id),
                  pending.id,
                );
                if (!live.current || ticket !== generation.current) return;
                receive(result);
                if (
                  result.decision ||
                  (pending.kind === 'prepare' &&
                    result.attempt.status !== 'running')
                )
                  setPending(null);
              })
            }
          >
            Check saved extraction receipt
          </button>
        </section>
      )}
      {!view && !pending && (
        <>
          {!options && (
            <button
              disabled={busy}
              onClick={() =>
                void action(async (ticket) => {
                  const result = EventExtractionOptionsSchema.parse(
                    await request('/ops/event-extractions/options'),
                  );
                  if (live.current && ticket === generation.current) {
                    setOptions(result);
                    setMethod(result.defaultMethod);
                  }
                  await loadSources(ticket);
                })
              }
            >
              Retry preparation setup
            </button>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action((ticket) => loadSources(ticket));
            }}
          >
            <label htmlFor="extraction-search">
              Find retained published sources
            </label>
            <div className="extraction-search">
              <input
                id="extraction-search"
                maxLength={120}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={busy}
              />
              <button disabled={busy}>Search sources</button>
            </div>
          </form>
          {page && (
            <fieldset disabled={busy}>
              <legend>Choose a retained source</legend>
              {page.items
                .filter((row) => row.item.sourceHash !== null)
                .map(({ item }) => (
                  <label className="extraction-source" key={item.id}>
                    <input
                      type="radio"
                      name="extraction-source"
                      checked={selected?.id === item.id}
                      onChange={() => setSelected(item)}
                    />
                    <span>
                      {item.title}
                      <small>
                        {item.source.name} · edition {item.version}
                      </small>
                    </span>
                  </label>
                ))}
              {!page.items.some((row) => row.item.sourceHash !== null) && (
                <p>
                  No eligible source on this page. Search again
                  {page.nextCursor ? ' or continue to the next page' : ''}.
                </p>
              )}
              {page.nextCursor && (
                <button
                  type="button"
                  onClick={() =>
                    void action((ticket) =>
                      loadSources(ticket, page.nextCursor!),
                    )
                  }
                >
                  More source choices
                </button>
              )}
            </fieldset>
          )}
          {selected && (
            <section className="panel" aria-label="Selected source preview">
              <h3>{selected.title}</h3>
              <p>
                {selected.source.name} · retained edition {selected.version}
              </p>
              {preview ? (
                <>
                  {(['title', 'summary', 'body'] as const).map((field) => (
                    <details key={field}>
                      <summary>Preview source {field}</summary>
                      <p className="extraction-source-text">
                        {preview[field] || 'No text in this field.'}
                      </p>
                      {preview[field].length < selected[field].length && (
                        <p>
                          Only the bounded beginning of this field is used for
                          preparation.
                        </p>
                      )}
                    </details>
                  ))}
                  <p>
                    The optional provider receives only this bounded source
                    text, never account records.
                  </p>
                </>
              ) : (
                <p role="alert">
                  This source cannot supply a valid bounded preview. Choose
                  another source.
                </p>
              )}
              <a
                href={'#read/' + encodeURIComponent(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open current published source (new tab)
              </a>
            </section>
          )}
          {options && (
            <>
              <label htmlFor="extraction-method">Preparation method</label>
              <select
                id="extraction-method"
                disabled={busy}
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as typeof method)
                }
              >
                <option value="template">Exact source template · no AI</option>
                <option value="auto">
                  Automatic · configured provider or template
                </option>
                {options.providers.map((provider) => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.provider} · {provider.model}
                  </option>
                ))}
              </select>
              <p>
                No provider configured? The source-template workflow still
                works. AI can choose exact excerpts; it cannot write claims into
                this candidate.
              </p>
              <button
                disabled={busy || !selected || !preview}
                onClick={() =>
                  void action((ticket) => {
                    const source = selected!;
                    return mutate(
                      {
                        kind: 'prepare',
                        id: crypto.randomUUID(),
                        body: EventExtractionInputSchema.parse({
                          sourceId: source.id,
                          expectedVersion: source.version,
                          sourceHash: source.sourceHash,
                          method,
                        }),
                      },
                      ticket,
                    );
                  })
                }
              >
                Prepare source candidate
              </button>
            </>
          )}
        </>
      )}
      {view && (
        <>
          <section className="panel" aria-label="Retained extraction candidate">
            <h3>{candidate?.title ?? 'Preparation outcome'}</h3>
            <p>{outcomes[view.attempt.outcome]}</p>
            <p>
              Started{' '}
              <time dateTime={view.attempt.startedAt}>
                {when(view.attempt.startedAt)}
              </time>
              {view.attempt.finishedAt && (
                <>
                  {' '}
                  · finished{' '}
                  <time dateTime={view.attempt.finishedAt}>
                    {when(view.attempt.finishedAt)}
                  </time>
                </>
              )}
            </p>
            {view.attempt.provider && (
              <p>
                Selected provider: {view.attempt.provider} ·{' '}
                {view.attempt.model}
              </p>
            )}
            <p>
              Current source state: <strong>{view.currentSource}</strong>. The
              retained receipt does not establish current permission to create a
              draft.
            </p>
            {!sourceConfirmed && (
              <p role="status">
                Refresh the candidate status before continuing its review.
              </p>
            )}
            {view.currentSource !== 'current' && (
              <p role="status">
                This source is no longer the admitted edition. A draft cannot be
                created from this candidate.
              </p>
            )}
            {candidate?.titleTruncated && (
              <p>
                The source title was shortened to fit a draft. Review it before
                saving.
              </p>
            )}
            {candidate?.excerpts.map((excerpt, index) => (
              <figure key={index}>
                <figcaption>
                  Exact excerpt {index + 1} · {excerpt.field}
                </figcaption>
                <blockquote>{excerpt.quote}</blockquote>
                <details>
                  <summary>Excerpt {index + 1} source binding</summary>
                  <p>
                    Edition {view.attempt.source.version} · UTF-16 offsets{' '}
                    {excerpt.start}–{excerpt.end}
                  </p>
                  <p>Source hash: {view.attempt.source.hash}</p>
                </details>
              </figure>
            ))}
            <button
              disabled={busy}
              onClick={() =>
                void action(async (ticket) => {
                  setSourceConfirmed(false);
                  const result = parseView(
                    await request(
                      '/ops/event-extractions/' + view.attempt.requestId,
                    ),
                    view.attempt.requestId,
                  );
                  if (!live.current || ticket !== generation.current) return;
                  receive(result);
                  if (
                    result.decision ||
                    (pending?.kind === 'prepare' &&
                      result.attempt.status !== 'running')
                  )
                    setPending(null);
                })
              }
            >
              Refresh candidate status
            </button>
          </section>
          {candidate && !view.decision && (
            <>
              {editable && !review && (
                <fieldset disabled={busy || !!pending}>
                  <legend>Add human-reviewed event context</legend>
                  <label htmlFor="extraction-title">
                    Candidate event title
                  </label>
                  <input
                    id="extraction-title"
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <label htmlFor="extraction-family">
                    Candidate event family
                  </label>
                  <input
                    id="extraction-family"
                    maxLength={80}
                    value={family}
                    onChange={(event) => setFamily(event.target.value)}
                  />
                  <label htmlFor="extraction-geography">
                    Candidate geography, comma separated
                  </label>
                  <input
                    id="extraction-geography"
                    value={geography}
                    onChange={(event) => setGeography(event.target.value)}
                  />
                  <label htmlFor="extraction-claim">Candidate claim type</label>
                  <select
                    id="extraction-claim"
                    value={claim}
                    onChange={(event) => setClaim(event.target.value)}
                  >
                    <option value="">Choose after reading the source</option>
                    {['fact', 'expectation', 'scenario', 'inference'].map(
                      (kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ),
                    )}
                  </select>
                  <label htmlFor="extraction-explanation">
                    Candidate editorial explanation
                  </label>
                  <textarea
                    id="extraction-explanation"
                    maxLength={2000}
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                  />
                  <p>
                    Dates and instrument/sector links stay unknown here. Add any
                    supported context later in the ordinary event editor.
                  </p>
                </fieldset>
              )}
              {!review && (
                <>
                  <label htmlFor="extraction-reason">
                    Candidate review reason
                  </label>
                  <textarea
                    id="extraction-reason"
                    maxLength={1000}
                    value={reason}
                    disabled={busy || !!pending}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <div className="extraction-actions">
                    <button
                      disabled={busy || !!pending || !editable}
                      onClick={() => startReview('draft')}
                    >
                      Review event draft
                    </button>
                    <button
                      disabled={busy || !!pending}
                      onClick={() => startReview('decline')}
                    >
                      Decline candidate
                    </button>
                  </div>
                </>
              )}
              {review && (
                <section
                  className="panel"
                  aria-label="Confirm candidate decision"
                >
                  <h3 tabIndex={-1} ref={reviewHeading}>
                    {review === 'draft'
                      ? 'Review the event draft'
                      : 'Review candidate decline'}
                  </h3>
                  {review === 'draft' && (
                    <>
                      <h4>{title}</h4>
                      <dl>
                        <dt>Family</dt>
                        <dd>{family}</dd>
                        <dt>Geography</dt>
                        <dd>{geography}</dd>
                        <dt>Claim type</dt>
                        <dd>{claim}</dd>
                      </dl>
                      <p className="extraction-source-text">{explanation}</p>
                      <p>
                        The exact retained excerpts above will be the citations.
                        No dates or context links are inferred.
                      </p>
                    </>
                  )}
                  <p>Reason: {reason}</p>
                  <p>
                    {review === 'draft'
                      ? 'This creates revision 1 of an ordinary draft. Publication still requires its separate review.'
                      : 'This records a decline. No event or public content is created.'}
                  </p>
                  <button
                    disabled={
                      busy || !!pending || (review === 'draft' && !editable)
                    }
                    onClick={() =>
                      void action((ticket) =>
                        mutate(
                          {
                            kind: 'decision',
                            id: view.attempt.requestId,
                            body:
                              review === 'draft'
                                ? draftDecision()
                                : EventExtractionDecisionInputSchema.parse({
                                    requestId: crypto.randomUUID(),
                                    kind: 'decline',
                                    reason,
                                  }),
                          },
                          ticket,
                        ),
                      )
                    }
                  >
                    {review === 'draft'
                      ? 'Confirm and create event draft'
                      : 'Confirm candidate decline'}
                  </button>
                  <button
                    disabled={busy || !!pending}
                    onClick={() => setReview(null)}
                  >
                    Back to candidate editing
                  </button>
                </section>
              )}
            </>
          )}
          {view.decision && (
            <section className="panel" aria-label="Extraction decision receipt">
              <h3>
                {view.decision.kind === 'draft'
                  ? 'Event draft created'
                  : 'Candidate declined'}
              </h3>
              <p>{view.decision.reason}</p>
              <p>
                Recorded{' '}
                <time dateTime={view.decision.decidedAt}>
                  {when(view.decision.decidedAt)}
                </time>
                . This is a historical decision.
              </p>
              {view.decision.eventId && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() => onOpenDraft(view.decision!.eventId!))
                  }
                >
                  Open created event draft
                </button>
              )}
            </section>
          )}
          <button
            disabled={busy}
            onClick={() =>
              abandon(() => {
                clearCandidate();
                setSelected(null);
              })
            }
          >
            Choose another source
          </button>
        </>
      )}
      <section aria-label="Extraction history">
        <h3>Earlier preparations</h3>
        <button
          disabled={busy || !!pending}
          onClick={() =>
            abandon(() => {
              void action(async (ticket) => {
                const result = EventExtractionListSchema.parse(
                  await request('/ops/event-extractions'),
                );
                if (live.current && ticket === generation.current)
                  setHistory(result);
              });
            })
          }
        >
          Load extraction history
        </button>
        {history?.items.map((item) => (
          <article key={item.attempt.requestId}>
            <p>
              {item.attempt.candidate?.title ?? item.attempt.outcome} ·{' '}
              {when(item.attempt.startedAt)}
            </p>
            <p>{item.decision?.kind ?? item.attempt.status}</p>
            <button
              disabled={busy || !!pending}
              onClick={() =>
                abandon(() => {
                  void action(async (ticket) => {
                    const result = parseView(
                      await request(
                        '/ops/event-extractions/' + item.attempt.requestId,
                      ),
                      item.attempt.requestId,
                    );
                    if (live.current && ticket === generation.current) {
                      clearCandidate();
                      receive(result);
                    }
                  });
                })
              }
            >
              Open preparation {item.attempt.requestId}
            </button>
          </article>
        ))}
        {history && !history.items.length && <p>No retained preparations.</p>}
        {history?.next && (
          <button
            disabled={busy || !!pending}
            onClick={() =>
              void action(async (ticket) => {
                const result = EventExtractionListSchema.parse(
                  await request('/ops/event-extractions?after=' + history.next),
                );
                if (live.current && ticket === generation.current)
                  setHistory(result);
              })
            }
          >
            More extraction history
          </button>
        )}
      </section>
    </section>
  );
}
