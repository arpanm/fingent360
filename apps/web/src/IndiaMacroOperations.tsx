import { IndiaGdpArchiveOperations } from './IndiaGdpArchiveOperations';
import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  IndiaMacroQueuePageSchema,
  IndiaMacroAttemptPageSchema,
  IndiaMacroOperationsSchema,
  IndiaCalendarInputSchema,
  IndiaMacroAttemptsSchema,
  IndiaMacroCaptureReceiptSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function IndiaMacroOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [rows, setRows] = useState<
      ReturnType<typeof IndiaMacroOperationsSchema.parse>
    >([]),
    [attempts, setAttempts] = useState<
      ReturnType<typeof IndiaMacroAttemptsSchema.parse>
    >([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [kind, setKind] = useState<'import' | 'calendar' | 'gdp'>('import'),
    [url, setUrl] = useState(''),
    [source, setSource] = useState(''),
    [api, setApi] = useState(''),
    [rights, setRights] = useState(''),
    [label, setLabel] = useState(''),
    [events, setEvents] = useState<
      ReturnType<typeof IndiaCalendarInputSchema.parse>['events']
    >([
      {
        id: crypto.randomUUID(),
        series: 'in-cpi-2024-combined',
        title: '',
        plannedOn: '',
        actualOn: null,
        page: 1,
        sourceExcerpt: '',
      },
    ]),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState('');
  const [next, setNext] = useState<string | null>(null),
    [attemptNext, setAttemptNext] = useState<string | null>(null),
    loadEpoch = useRef(0);
  const intent = useRef<{ fingerprint: string; id: string } | null>(null),
    live = useRef(true),
    fileEpoch = useRef(0);
  function fail(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      fileEpoch.current++;
      loadEpoch.current++;
      setNext(null);
      setAttemptNext(null);
      setRows([]);
      setAttempts([]);
      setSource('');
      setApi('');
      setConfirmed(false);
      onDenied();
    } else setError(cause instanceof Error ? cause.message : 'Request failed.');
  }
  async function load() {
    const epoch = ++loadEpoch.current;
    setLoading(true);
    try {
      const values = IndiaMacroQueuePageSchema.parse(
        await request('/ops/india-macro/queue'),
      );
      const captures = IndiaMacroAttemptPageSchema.parse(
        await request('/ops/india-macro/attempt-page'),
      );
      if (live.current && epoch === loadEpoch.current) {
        setRows(values.rows);
        setNext(values.nextCursor);
        setAttempts(captures.rows);
        setAttemptNext(captures.nextCursor);
      }
    } catch (cause) {
      if (epoch === loadEpoch.current) fail(cause);
    } finally {
      if (live.current && epoch === loadEpoch.current) setLoading(false);
    }
  }
  async function more(quarantine: boolean) {
    const cursor = quarantine ? attemptNext : next;
    if (!cursor) return;
    const epoch = ++loadEpoch.current;
    setLoading(true);
    setError('');
    try {
      const value = await request(
        `/ops/india-macro/${quarantine ? 'attempt-page' : 'queue'}?after=${encodeURIComponent(cursor)}`,
      );
      if (!live.current || epoch !== loadEpoch.current) return;
      if (quarantine) {
        const page = IndiaMacroAttemptPageSchema.parse(value);
        setAttempts((old) => [
          ...old,
          ...page.rows.filter(
            (row) => !old.some((existing) => existing.id === row.id),
          ),
        ]);
        setAttemptNext(page.nextCursor);
      } else {
        const page = IndiaMacroQueuePageSchema.parse(value);
        setRows((old) => [
          ...old,
          ...page.rows.filter(
            (row) => !old.some((existing) => existing.id === row.id),
          ),
        ]);
        setNext(page.nextCursor);
      }
    } catch (cause) {
      if (epoch === loadEpoch.current) fail(cause);
    } finally {
      if (live.current && epoch === loadEpoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      fileEpoch.current++;
      loadEpoch.current++;
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const fingerprint = JSON.stringify({ path, value });
    if (intent.current?.fingerprint !== fingerprint)
      intent.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await request(
        `/ops/india-macro/${path}`,
        { ...value, requestId: intent.current.id },
        'POST',
      );
      if (path !== 'review') {
        const receipt = IndiaMacroCaptureReceiptSchema.parse(result);
        if (receipt.status === 'quarantined')
          setError(
            `Source retained in quarantine: ${receipt.reason}. Correct the source and retain a new capture.`,
          );
      }
      await load();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="India macro onboarding"
      aria-busy={busy || loading}
    >
      <h2>India macro evidence</h2>
      <IndiaGdpArchiveOperations request={request} onDenied={onDenied} />
      <p>
        Retain a CPI2024 original PIB HTML release and the current MoSPI
        all-India combined API response. Current captures are reconciliation
        evidence, not historical vintages. Calendar transcription requires the
        original PDF and separate planned/actual dates. Independent named
        publication review is mandatory.
      </p>
      {loading && <p role="status">Loading India macro queue…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh India queue
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(
            kind,
            kind === 'import'
              ? {
                  releaseUrl: url,
                  releaseHtml: source,
                  apiBody: api,
                  rightsEvidence: rights,
                  rightsConfirmed: confirmed,
                }
              : kind === 'gdp'
                ? {
                    releaseUrl: url,
                    releaseHtml: source,
                    rightsEvidence: rights,
                    rightsConfirmed: confirmed,
                  }
                : {
                    sourceUrl: url,
                    pdfBase64: source,
                    editionLabel: label,
                    events,
                    rightsEvidence: rights,
                    rightsConfirmed: confirmed,
                  },
          );
        }}
      >
        <fieldset disabled={busy}>
          <legend>Retain source edition</legend>
          <label>
            Source type
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as typeof kind);
                fileEpoch.current++;
                setSource('');
                setConfirmed(false);
              }}
            >
              <option value="import">CPI release and current capture</option>
              <option value="gdp">Original quarterly real GDP release</option>
              <option value="calendar">Official release-calendar PDF</option>
            </select>
          </label>
          <label>
            Original source URL
            <input
              type="url"
              required
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Original source file
            <input
              key={kind}
              type="file"
              accept={kind !== 'calendar' ? '.html,.htm' : '.pdf'}
              onChange={(event) => {
                const ticket = ++fileEpoch.current;
                setError('');
                setSource('');
                setConfirmed(false);
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 5000000) {
                  setError('Choose a source file smaller than 5 MB.');
                  return;
                }
                if (kind !== 'calendar')
                  void file
                    .text()
                    .then((value) => {
                      if (live.current && ticket === fileEpoch.current)
                        setSource(value);
                    })
                    .catch((cause) => {
                      if (ticket === fileEpoch.current) fail(cause);
                    });
                else {
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (live.current && ticket === fileEpoch.current)
                      setSource(String(reader.result).split(',')[1] ?? '');
                  };
                  reader.onerror = () => {
                    if (live.current && ticket === fileEpoch.current)
                      setError('Could not read PDF.');
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
          {kind === 'import' ? (
            <label>
              MoSPI API JSON
              <textarea
                required
                value={api}
                onChange={(event) => {
                  setApi(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
          ) : kind === 'gdp' ? (
            <p>
              Retain original PIB quarterly real GDP HTML. Constant-price bases,
              fiscal quarters and reported YoY rates remain separate. No nominal
              GDP or annual estimate is substituted. The next-release day is a
              plan, not an actual publication.
            </p>
          ) : (
            <>
              <label>
                Official calendar edition label
                <input
                  required
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </label>
              {events.map((row, index) => (
                <fieldset key={row.id}>
                  <legend>Calendar event {index + 1}</legend>
                  {(
                    ['title', 'plannedOn', 'actualOn', 'sourceExcerpt'] as const
                  ).map((field) => (
                    <label key={field}>
                      {
                        {
                          title: 'Release title',
                          plannedOn: 'Planned release date',
                          actualOn:
                            'Actual release date (leave empty if unknown)',
                          sourceExcerpt: 'Exact source passage',
                        }[field]
                      }
                      <input
                        type={field.endsWith('On') ? 'date' : 'text'}
                        value={row[field] ?? ''}
                        onChange={(event) =>
                          setEvents((old) =>
                            old.map((value, i) =>
                              i === index
                                ? {
                                    ...value,
                                    [field]:
                                      field === 'actualOn'
                                        ? event.target.value || null
                                        : event.target.value,
                                  }
                                : value,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Series
                    <select
                      value={row.series}
                      onChange={(event) =>
                        setEvents((old) =>
                          old.map((value, i) =>
                            i === index
                              ? {
                                  ...value,
                                  series: event.target
                                    .value as typeof row.series,
                                }
                              : value,
                          ),
                        )
                      }
                    >
                      <option value="in-cpi-2024-combined">
                        Consumer prices
                      </option>
                      <option value="in-gdp-2022-23">GDP</option>
                      <option value="in-iip-2022-23">
                        Industrial production
                      </option>
                    </select>
                  </label>
                  <label>
                    PDF page
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={row.page}
                      onChange={(event) =>
                        setEvents((old) =>
                          old.map((value, i) =>
                            i === index
                              ? { ...value, page: Number(event.target.value) }
                              : value,
                          ),
                        )
                      }
                    />
                  </label>
                  {events.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEvents((old) => old.filter((_, i) => i !== index))
                      }
                    >
                      Remove event
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                disabled={events.length >= 100}
                onClick={() =>
                  setEvents((old) => [
                    ...old,
                    {
                      id: crypto.randomUUID(),
                      series: 'in-cpi-2024-combined',
                      title: '',
                      plannedOn: '',
                      actualOn: null,
                      page: 1,
                      sourceExcerpt: '',
                    },
                  ])
                }
              >
                Add calendar event
              </button>
              <p>
                Transcribe exact dates and source passages. A planned release is
                not an actual release.
              </p>
            </>
          )}
          <label>
            Source permission evidence
            <textarea
              required
              minLength={20}
              value={rights}
              onChange={(event) => {
                setRights(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I verified attribution, display, retention and offline usage rights.
          </label>
          <button disabled={!confirmed || !source}>
            Retain for independent review
          </button>
        </fieldset>
      </form>
      <label>
        Independent review reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {attempts.map((attempt) => (
        <article key={attempt.id}>
          <h3>Quarantined source</h3>
          <p>{attempt.reason}</p>
          <p>
            Retained {attempt.createdAt} · {attempt.hash}
          </p>
          <button
            onClick={() =>
              void request(`/ops/india-macro/attempts/${attempt.id}/evidence`)
                .then((value) => {
                  const blob = new Blob([JSON.stringify(value, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = `india-macro-quarantine-${attempt.id}.json`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                })
                .catch(fail)
            }
          >
            Download retained attempt
          </button>
        </article>
      ))}
      {attemptNext && (
        <button disabled={busy || loading} onClick={() => void more(true)}>
          Load older quarantined sources
        </button>
      )}
      {!loading && rows.length === 0 && (
        <p>No India macro editions retained.</p>
      )}
      {rows.map((row) => (
        <article key={row.id}>
          <h3>
            {'title' in row.payload
              ? row.payload.title
              : row.payload.editionLabel}
          </h3>
          <p>
            {row.state} · {row.payload.retrievedAt}
          </p>
          <a href={row.payload.sourceUrl} target="_blank" rel="noreferrer">
            Original source
          </a>
          <details>
            <summary>Retained parsed values</summary>
            <pre>{JSON.stringify(row.payload, null, 2)}</pre>
          </details>
          <button
            disabled={busy || reason.trim().length < 12}
            onClick={() =>
              void send('review', {
                editionId: row.id,
                decision: 'publish',
                reason,
              })
            }
          >
            Publish independently checked edition
          </button>
          <button
            disabled={busy || reason.trim().length < 12}
            onClick={() =>
              void send('review', {
                editionId: row.id,
                decision: 'withdraw',
                reason,
              })
            }
          >
            Withdraw edition
          </button>
        </article>
      ))}
      {next && (
        <button disabled={busy || loading} onClick={() => void more(false)}>
          Load older India editions
        </button>
      )}
    </section>
  );
}
