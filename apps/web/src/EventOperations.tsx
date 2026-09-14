import { useDraftGuard } from './useDraftGuard';
import { useEffect, useRef, useState } from 'react';
import {
  IdentitySelectionPublicSchema,
  IdentitySelectionReceiptSchema,
  DiscoveryOperationsSchema,
  EventHistorySchema,
  EventOperationsSchema,
  EventOperationsListSchema,
  EventReceiptSchema,
  type PublicationProposalInput,
  type EventRevision,
  EventEditorialSchema,
  SecurityDirectorySchema,
} from '@fingent360/contracts';
import { json } from './net';
import { EventExtraction } from './EventExtraction';
type Editorial = typeof EventEditorialSchema._output;
const empty = (): Editorial => ({
  title: '',
  family: '',
  geography: ['India'],
  claimKind: 'fact',
  explanation: '',
  announcedAt: null,
  effectiveAt: null,
  citations: [],
  links: [],
});
export function EventOperations({
  request,
  onPropose,
}: {
  request: typeof json;
  onPropose?:
    ((input: PublicationProposalInput) => Promise<unknown>) | undefined;
}) {
  const [rows, setRows] = useState<
    typeof EventOperationsListSchema._output | null
  >(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sources, setSources] = useState<
    (typeof DiscoveryOperationsSchema._output)['items']
  >([]);
  const [selections, setSelections] = useState<
    Record<string, typeof IdentitySelectionReceiptSchema._output>
  >({});
  const [identities, setIdentities] = useState<
    (typeof SecurityDirectorySchema._output)['items']
  >([]);
  const [editorial, setEditorial] = useState<Editorial>(empty),
    [saved, setSaved] = useState<EventRevision | null>(null);
  const [history, setHistory] = useState<
    typeof EventHistorySchema._output | null
  >(null);
  const [reason, setReason] = useState(''),
    [note, setNote] = useState(''),
    [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const live = useRef(false),
    generation = useRef(0),
    id = useRef<string>(crypto.randomUUID());
  useDraftGuard(
    editing &&
      (busy ||
        JSON.stringify(editorial) !==
          JSON.stringify(saved?.editorial ?? empty())),
    'Leave the event editor with unsaved or unconfirmed changes?',
  );
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  async function action(work: (ticket: number) => Promise<void>) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      await work(ticket);
    } catch (failure) {
      if (live.current && ticket === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Event operation unavailable.',
        );
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  async function load(after?: string) {
    await action(async (ticket) => {
      const page = EventOperationsListSchema.parse(
        await request('/ops/events' + (after ? '?after=' + after : '')),
      );
      if (!live.current || ticket !== generation.current) return;
      setRows((old) =>
        after && old ? { ...page, items: [...old.items, ...page.items] } : page,
      );
    });
  }
  async function loadChoices(ticket: number) {
    const items = DiscoveryOperationsSchema.parse(
      await request('/ops/discovery/items'),
    ).items.filter(
      (item) => item.status === 'published' && item.sourceHash !== null,
    );
    if (!live.current || ticket !== generation.current) return false;
    const directory = SecurityDirectorySchema.parse(
      await request('/securities'),
    ).items;
    if (!live.current || ticket !== generation.current) return false;
    const choices: Record<
      string,
      typeof IdentitySelectionReceiptSchema._output
    > = {};
    for (let start = 0; start < directory.length; start += 5) {
      const batch = directory.slice(start, start + 5);
      const readings = await Promise.all(
        batch.map((identity) =>
          request('/securities/' + identity.isin + '/selection').then((raw) =>
            IdentitySelectionPublicSchema.parse(raw),
          ),
        ),
      );
      if (!live.current || ticket !== generation.current) return false;
      for (const reading of readings)
        if (reading.state === 'current' && reading.receipt)
          choices[reading.isin] = reading.receipt;
    }
    const security = directory.filter(
      (item) =>
        (item.resolution === 'matched' && item.candidates.length === 1) ||
        choices[item.isin],
    );
    if (!live.current || ticket !== generation.current) return false;
    setSources(items);
    setIdentities(security);
    setSelections(choices);
    return true;
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  function reset() {
    setHistory(null);
    setEditing(false);
    setSaved(null);
    setEditorial(empty());
    setReason('');
    setNote('');
    pending.current = null;
    id.current = crypto.randomUUID();
  }
  if (preparing)
    return (
      <EventExtraction
        request={request}
        onClose={() => {
          generation.current++;
          setPreparing(false);
          setBusy(false);
          void load();
        }}
        onOpenDraft={async (eventId) => {
          const ticket = ++generation.current;
          const value = EventOperationsSchema.parse(
            await request('/ops/events/' + eventId),
          );
          if (!live.current || ticket !== generation.current) return;
          if (!(await loadChoices(ticket))) return;
          id.current = value.state.id;
          setSaved(value.latest);
          setEditorial(value.latest.editorial);
          setEditing(true);
          setHistory(null);
          setReason('');
          setNote('');
          setReceipt(
            'Opened the stored event draft. Publication is a separate review.',
          );
          pending.current = null;
          setBusy(false);
          setPreparing(false);
        }}
      />
    );
  return (
    <section
      aria-label="Event editorial review"
      className="panel"
      data-feedback-private
    >
      <h2>Source-bound event review</h2>
      <p>
        Author explicit source context. Do not infer prices, sector
        classifications or causal impact. Publishing requires current evidence
        and an independent named identity when named mode is enabled.
      </p>
      {error && <p role="alert">{error}</p>}
      {receipt && <p role="status">{receipt}</p>}
      <button disabled={busy || editing} onClick={() => void load()}>
        Reload event workspace
      </button>
      <button
        disabled={busy || editing}
        onClick={() =>
          void action(async (ticket) => {
            if (!(await loadChoices(ticket))) return;
            reset();
            setEditing(true);
            setReceipt('');
          })
        }
      >
        Create event draft
      </button>
      <button
        disabled={busy || editing}
        onClick={() => {
          generation.current++;
          reset();
          setReceipt('');
          setError('');
          setPreparing(true);
        }}
      >
        Prepare event from a source
      </button>
      {rows?.items.map((row) => (
        <article className="panel" key={row.id}>
          <h3>{row.title}</h3>
          <p>
            Event {row.id} · draft revision {row.headVersion} · {row.status}
          </p>
          <button
            disabled={busy || editing}
            onClick={() =>
              void action(async (ticket) => {
                const value = EventOperationsSchema.parse(
                  await request('/ops/events/' + row.id),
                );
                if (!live.current || ticket !== generation.current) return;
                if (!(await loadChoices(ticket))) return;
                id.current = value.state.id;
                setSaved(value.latest);
                setEditorial(value.latest.editorial);
                setEditing(true);
                setReason('');
                setReceipt('');
                pending.current = null;
              })
            }
          >
            Open event {row.title}
          </button>
          {row.publishedVersion && (
            <a href={'#events/' + row.id}>Read public event</a>
          )}
        </article>
      ))}
      {rows?.next && (
        <button
          disabled={busy || editing}
          onClick={() => void load(rows.next!)}
        >
          More event drafts
        </button>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              const parsed = EventEditorialSchema.parse(editorial),
                key = JSON.stringify({
                  id: id.current,
                  expectedVersion: saved?.version ?? 0,
                  editorial: parsed,
                  reason,
                });
              if (pending.current?.key !== key)
                pending.current = { key, requestId: crypto.randomUUID() };
              const result = EventOperationsSchema.parse(
                await request(
                  '/ops/events/' + id.current,
                  {
                    requestId: pending.current.requestId,
                    expectedVersion: saved?.version ?? 0,
                    revisionReason: reason,
                    editorial: parsed,
                  },
                  'PUT',
                ),
              );
              if (!live.current) return;
              setSaved(result.latest);
              pending.current = null;
              setReceipt('Event draft saved. Public state is unchanged.');
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Editorial event</legend>
            <label htmlFor="event-title">Event title</label>
            <input
              id="event-title"
              required
              maxLength={200}
              value={editorial.title}
              onChange={(e) =>
                setEditorial({ ...editorial, title: e.target.value })
              }
            />
            <label htmlFor="event-family">Event family</label>
            <input
              id="event-family"
              required
              maxLength={80}
              value={editorial.family}
              onChange={(e) =>
                setEditorial({ ...editorial, family: e.target.value })
              }
            />
            <label htmlFor="event-kind">Claim kind</label>
            <select
              id="event-kind"
              value={editorial.claimKind}
              onChange={(e) =>
                setEditorial({
                  ...editorial,
                  claimKind: e.target.value as Editorial['claimKind'],
                })
              }
            >
              {['fact', 'expectation', 'scenario', 'inference'].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
            <label htmlFor="event-geography">Geography (one per comma)</label>
            <input
              id="event-geography"
              value={editorial.geography.join(',')}
              onChange={(e) =>
                setEditorial({
                  ...editorial,
                  geography: e.target.value
                    .split(',')
                    .map((value) => value.trim()),
                })
              }
            />
            <label htmlFor="event-explanation">Editorial explanation</label>
            <textarea
              id="event-explanation"
              required
              maxLength={2000}
              value={editorial.explanation}
              onChange={(e) =>
                setEditorial({ ...editorial, explanation: e.target.value })
              }
            />
            {(['announcedAt', 'effectiveAt'] as const).map((field) => (
              <label key={field}>
                {field === 'announcedAt'
                  ? 'Announced UTC time (optional)'
                  : 'Effective UTC time (optional)'}
                <input
                  placeholder="2026-09-14T00:00:00.000Z"
                  value={editorial[field] ?? ''}
                  onChange={(e) =>
                    setEditorial({
                      ...editorial,
                      [field]: e.target.value || null,
                    })
                  }
                />
              </label>
            ))}
            <h3>Exact source excerpts</h3>
            <button
              type="button"
              onClick={() =>
                void action(async (ticket) => {
                  await loadChoices(ticket);
                })
              }
            >
              Refresh available sources and identities
            </button>
            <p>
              Refreshing choices preserves this draft. Use the explicit
              source-edition button to replace an old excerpt.
            </p>
            <label htmlFor="event-source-search">
              Find stored source titles
            </label>
            <input
              id="event-source-search"
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
            />

            {editorial.citations.map((citation, index) => (
              <fieldset key={index}>
                <legend>Excerpt {index + 1}</legend>
                <label htmlFor={'event-source-' + index}>
                  Stored published source {index + 1}
                </label>
                <select
                  id={'event-source-' + index}
                  value={citation.sourceId}
                  onChange={(e) => {
                    const source = sources.find(
                      (item) => item.id === e.target.value,
                    );
                    if (source)
                      setEditorial({
                        ...editorial,
                        citations: editorial.citations.map((old, i) =>
                          i === index
                            ? {
                                sourceId: source.id,
                                version: source.version,
                                hash: source.sourceHash!,
                                field: 'title',
                                quote: source.title,
                              }
                            : old,
                        ),
                      });
                  }}
                >
                  {!sources.some((item) => item.id === citation.sourceId) && (
                    <option value={citation.sourceId}>
                      Previously selected source — reload if unavailable
                    </option>
                  )}
                  {sources
                    .filter(
                      (source) =>
                        source.id === citation.sourceId ||
                        source.title
                          .toLowerCase()
                          .includes(sourceSearch.toLowerCase()),
                    )
                    .map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title} · {source.version}
                      </option>
                    ))}
                </select>
                <label htmlFor={'event-field-' + index}>
                  Quoted field {index + 1}
                </label>
                <select
                  id={'event-field-' + index}
                  value={citation.field}
                  onChange={(e) =>
                    setEditorial({
                      ...editorial,
                      citations: editorial.citations.map((old, i) =>
                        i === index
                          ? {
                              ...old,
                              field: e.target.value as typeof citation.field,
                            }
                          : old,
                      ),
                    })
                  }
                >
                  {['title', 'summary', 'body'].map((field) => (
                    <option key={field}>{field}</option>
                  ))}
                </select>
                <label htmlFor={'event-quote-' + index}>
                  Exact excerpt {index + 1}
                </label>
                <textarea
                  id={'event-quote-' + index}
                  required
                  minLength={8}
                  maxLength={800}
                  value={citation.quote}
                  onChange={(e) =>
                    setEditorial({
                      ...editorial,
                      citations: editorial.citations.map((old, i) =>
                        i === index ? { ...old, quote: e.target.value } : old,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  disabled={
                    !sources.some((source) => source.id === citation.sourceId)
                  }
                  onClick={() => {
                    const source = sources.find(
                      (item) => item.id === citation.sourceId,
                    )!;
                    setEditorial({
                      ...editorial,
                      citations: editorial.citations.map((old, i) =>
                        i === index
                          ? {
                              ...old,
                              version: source.version,
                              hash: source.sourceHash!,
                              quote: source[citation.field].slice(0, 800),
                            }
                          : old,
                      ),
                    });
                  }}
                >
                  Use loaded source edition for excerpt {index + 1}
                </button>
                <p>
                  Bound edition {citation.version}. The button explicitly
                  replaces this excerpt with the loaded source field; inspect it
                  before saving.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      editorial.links.some((link) => link.citation === index) &&
                      !window.confirm(
                        'Remove this excerpt and every context link supported by it?',
                      )
                    )
                      return;
                    setEditorial({
                      ...editorial,
                      citations: editorial.citations.filter(
                        (_, i) => i !== index,
                      ),
                      links: editorial.links
                        .filter((link) => link.citation !== index)
                        .map((link) => ({
                          ...link,
                          citation:
                            link.citation > index
                              ? link.citation - 1
                              : link.citation,
                        })),
                    });
                    document.getElementById('event-add-source')?.focus();
                  }}
                >
                  Remove source excerpt {index + 1}
                </button>
                <a href={'#read/' + citation.sourceId}>Read source</a>
              </fieldset>
            ))}
            <button
              id="event-add-source"
              type="button"
              disabled={!sources.length || editorial.citations.length >= 5}
              onClick={() => {
                const source = sources[0]!;
                setEditorial({
                  ...editorial,
                  citations: [
                    ...editorial.citations,
                    {
                      sourceId: source.id,
                      version: source.version,
                      hash: source.sourceHash!,
                      field: 'title',
                      quote: source.title,
                    },
                  ],
                });
              }}
            >
              Add source excerpt
            </button>
            <h3>Optional editorial context</h3>
            {editorial.links.map((link, index) => (
              <fieldset key={index}>
                <legend>Context {index + 1}</legend>
                {link.kind === 'sector' ? (
                  <label>
                    Editorial sector label
                    <input
                      value={link.label}
                      onChange={(e) =>
                        setEditorial({
                          ...editorial,
                          links: editorial.links.map((old, i) =>
                            i === index
                              ? { ...link, label: e.target.value }
                              : old,
                          ),
                        })
                      }
                    />
                  </label>
                ) : (
                  <label>
                    Retained instrument identity
                    <select
                      value={link.isin}
                      onChange={(e) => {
                        const identity = identities.find(
                          (item) => item.isin === e.target.value,
                        )!;
                        setEditorial({
                          ...editorial,
                          links: editorial.links.map((old, i) =>
                            i === index
                              ? {
                                  ...link,
                                  isin: identity.isin,
                                  identityVersion: identity.version,
                                  selection: selections[identity.isin],
                                }
                              : old,
                          ),
                        });
                      }}
                    >
                      {!identities.some(
                        (identity) => identity.isin === link.isin,
                      ) && (
                        <option value={link.isin}>
                          Previously selected identity unavailable
                        </option>
                      )}
                      {identities.map((identity) => (
                        <option key={identity.isin} value={identity.isin}>
                          {selections[identity.isin]?.candidate.name ??
                            identity.candidates[0]!.name}{' '}
                          · {identity.isin}
                          {selections[identity.isin]
                            ? ' · editorial judgement'
                            : ' · unique provider match'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {link.kind === 'instrument' && link.selection && (
                  <p>
                    Explicit basis: editorial judgement revision{' '}
                    {link.selection.version}; provider ambiguity is unchanged.{' '}
                    {link.selection.rationale}
                  </p>
                )}
                {link.kind === 'instrument' && (
                  <button
                    type="button"
                    disabled={
                      !identities.some(
                        (identity) => identity.isin === link.isin,
                      )
                    }
                    onClick={() => {
                      const identity = identities.find(
                        (row) => row.isin === link.isin,
                      )!;
                      setEditorial({
                        ...editorial,
                        links: editorial.links.map((old, i) =>
                          i === index
                            ? {
                                ...link,
                                identityVersion: identity.version,
                                selection: selections[identity.isin],
                              }
                            : old,
                        ),
                      });
                    }}
                  >
                    Use loaded identity for context {index + 1}
                  </button>
                )}
                <label>
                  Supporting excerpt number
                  <input
                    type="number"
                    min={1}
                    max={editorial.citations.length}
                    value={link.citation + 1}
                    onChange={(e) =>
                      setEditorial({
                        ...editorial,
                        links: editorial.links.map((old, i) =>
                          i === index
                            ? { ...old, citation: Number(e.target.value) - 1 }
                            : old,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Context rationale
                  <textarea
                    value={link.rationale}
                    maxLength={1000}
                    onChange={(e) =>
                      setEditorial({
                        ...editorial,
                        links: editorial.links.map((old, i) =>
                          i === index
                            ? { ...old, rationale: e.target.value }
                            : old,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditorial({
                      ...editorial,
                      links: editorial.links.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove context {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={
                !editorial.citations.length || editorial.links.length >= 10
              }
              onClick={() =>
                setEditorial({
                  ...editorial,
                  links: [
                    ...editorial.links,
                    { kind: 'sector', label: '', citation: 0, rationale: '' },
                  ],
                })
              }
            >
              Add editorial sector context
            </button>
            <button
              type="button"
              disabled={
                !editorial.citations.length ||
                !identities.length ||
                editorial.links.length >= 10
              }
              onClick={() =>
                setEditorial({
                  ...editorial,
                  links: [
                    ...editorial.links,
                    {
                      kind: 'instrument',
                      isin: identities[0]!.isin,
                      identityVersion: identities[0]!.version,
                      selection: selections[identities[0]!.isin],
                      citation: 0,
                      rationale: '',
                    },
                  ],
                })
              }
            >
              Add retained instrument context
            </button>
            <label htmlFor="event-reason">Draft revision reason</label>
            <input
              id="event-reason"
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button>Save event draft</button>
          </fieldset>
        </form>
      )}
      {editing && saved && (
        <section className="panel">
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const value = EventHistorySchema.parse(
                  await request('/ops/events/' + id.current + '/history'),
                );
                if (live.current) setHistory(value);
              })
            }
          >
            Read internal revision history
          </button>
          {history && (
            <>
              <p>
                Internal history includes candidate drafts; no historical row is
                treated as current.
              </p>
              <ul>
                {history.revisions.map((row) => (
                  <li key={row.version}>
                    Revision {row.version} · {row.recordedAt}
                  </li>
                ))}
              </ul>
              {history.nextBefore && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const value = EventHistorySchema.parse(
                        await request(
                          '/ops/events/' +
                            id.current +
                            '/history?before=' +
                            history.nextBefore,
                        ),
                      );
                      if (live.current)
                        setHistory((old) =>
                          old
                            ? {
                                ...value,
                                revisions: [
                                  ...old.revisions,
                                  ...value.revisions,
                                ],
                              }
                            : value,
                        );
                    })
                  }
                >
                  More internal revisions
                </button>
              )}
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              if (
                JSON.stringify(editorial) !== JSON.stringify(saved.editorial) &&
                !window.confirm(
                  'Replace unsaved edits with the current stored event revision?',
                )
              )
                return;
              void action(async () => {
                const value = EventOperationsSchema.parse(
                  await request('/ops/events/' + id.current),
                );
                if (live.current) {
                  setSaved(value.latest);
                  setEditorial(value.latest.editorial);
                  setReason('');
                  pending.current = null;
                  setHistory(null);
                }
              });
            }}
          >
            Reload current event revision
          </button>
          <p>
            Review acts on saved revision {saved.version}. Unsaved form edits
            are not published.
          </p>
          <label htmlFor="event-review-note">Event review note</label>
          <textarea
            id="event-review-note"
            disabled={busy}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
          {(['published', 'withdrawn'] as const).map((status) => (
            <button
              key={status}
              disabled={
                busy ||
                !note.trim() ||
                JSON.stringify(editorial) !== JSON.stringify(saved.editorial)
              }
              onClick={() =>
                void action(async () => {
                  const key = JSON.stringify({
                    id: id.current,
                    version: saved.version,
                    status,
                    note,
                  });
                  if (pending.current?.key !== key)
                    pending.current = { key, requestId: crypto.randomUUID() };
                  const body = {
                    requestId: pending.current.requestId,
                    expectedVersion: saved.version,
                    status,
                    note: note.trim(),
                  };
                  if (onPropose)
                    await onPropose({
                      kind: 'event',
                      target: id.current,
                      body,
                    });
                  else
                    EventReceiptSchema.parse(
                      await request(
                        '/ops/events/' + id.current + '/review',
                        body,
                        'POST',
                      ),
                    );
                  if (live.current) {
                    setReceipt(
                      onPropose
                        ? 'Event proposal saved. An independent named identity must approve it.'
                        : 'Saved historical event review receipt. Reload the current event before further edits; read the public view to check availability.',
                    );
                    pending.current = null;
                  }
                })
              }
            >
              {onPropose ? 'Propose ' : 'Review '}
              {status === 'published'
                ? 'event publication'
                : 'event withdrawal'}
            </button>
          ))}
        </section>
      )}
      {editing && (
        <button
          disabled={busy}
          onClick={() => {
            if (
              JSON.stringify(editorial) !==
                JSON.stringify(saved?.editorial ?? empty()) &&
              !window.confirm('Discard unsaved event edits?')
            )
              return;
            reset();
            void load();
          }}
        >
          Close event editor
        </button>
      )}
    </section>
  );
}
