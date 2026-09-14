import { useEffect, useState } from 'react';
import {
  MediaAssetSchema,
  ResearchCatalogSchema,
  ResearchRunsSchema,
  DiscoveryRunSchema,
  type ResearchCatalog,
  type MediaAsset,
  OperatorSessionSchema,
  DiscoveryOperationsSchema,
  FeedItemSchema,
  MacroDashboardSchema,
  MacroRunSchema,
  SourceListSchema,
  SourceInputSchema,
  SourceRecordSchema,
  type FeedItem,
  type SourceInput,
  type SourceRecord,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { Dialog } from './Dialog';
import { shortDate } from './ui';
import { FeedbackInbox } from './FeedbackInbox';
import { SecurityOperations } from './Securities';
import { RetentionOperations } from './RetentionOperations';
import { WorkerHealth } from './WorkerHealth';
const blank: SourceInput = {
  name: '',
  category: '',
  sourceUrl: '',
  termsUrl: '',
  rightsStatus: 'unreviewed',
  constraints: '',
  reviewEvidence: '',
  reviewedAt: null,
  published: false,
};
export function Operations() {
  const [authenticated, setAuthenticated] = useState(false),
    [checking, setChecking] = useState(true),
    [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [tab, setTab] = useState('news');
  const [items, setItems] = useState<FeedItem[]>([]),
    [review, setReview] = useState<FeedItem | null>(null),
    [note, setNote] = useState('');
  const [latest, setLatest] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const load = async () => {
    const value = DiscoveryOperationsSchema.parse(
      await json('/ops/discovery/items'),
    );
    setItems(value.items);
    setLatest(
      value.latestRun
        ? `${value.latestRun.status}: ${value.latestRun.message}`
        : 'No discovery refresh yet.',
    );
  };
  useEffect(() => {
    let active = true;
    void json('/ops/session')
      .then((v) => {
        if (active)
          setAuthenticated(OperatorSessionSchema.parse(v).authenticated);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Operations unavailable.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (authenticated)
      void load().catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : 'Could not load publications.',
        ),
      );
  }, [authenticated]);
  const action = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      if (e instanceof RequestError && e.status === 401)
        setAuthenticated(false);
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="operations">
      <header className="ops-header">
        <a href="#today">← Investor app</a>
        <strong>Fingent360 / Operations</strong>
        {authenticated && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await json('/ops/session', undefined, 'DELETE');
                setAuthenticated(false);
                setItems([]);
                setNotice('Operations session ended.');
              })
            }
          >
            Sign out of operations
          </button>
        )}
      </header>
      <main>
        <p className="page-kicker">PUBLISHING & DATA OPERATIONS</p>
        <h1>
          {authenticated ? 'Keep the evidence clear.' : 'Operations sign-in'}
        </h1>
        {checking && <p role="status">Checking session…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!checking && !authenticated && (
          <form
            className="panel ops-login"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const session = OperatorSessionSchema.parse(
                  await json('/ops/session', { key }, 'POST'),
                );
                setKey('');
                setAuthenticated(session.authenticated);
              });
            }}
          >
            <p>
              For maintainers only. This credential opens a separate one-hour
              operations session.
            </p>
            <label>
              Operator key
              <input
                type="password"
                autoComplete="off"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <div className="page-actions">
              <button disabled={busy || !key}>Sign in to operations</button>
              <button
                type="button"
                className="secondary"
                disabled={busy || !key}
                onClick={() => {
                  setKey('');
                  setNotice(
                    'Entered credential cleared. The configured credential has not been revoked.',
                  );
                }}
              >
                Clear entered credential
              </button>
            </div>
          </form>
        )}
        {authenticated && (
          <>
            <div
              className="segmented-control"
              role="group"
              aria-label="Operations sections"
            >
              {[
                ['news', 'Publishing'],
                ['macro', 'Macro ingestion'],
                ['sources', 'Source registry'],
                ['feedback', 'Feedback inbox'],
                ['securities', 'Security identities'],
                ['retention', 'Expired data cleanup'],
                ['workers', 'Worker health'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value!)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'news' ? (
              <>
                <SourceRefresh
                  action={action}
                  busy={busy}
                  afterRefresh={load}
                  latest={latest}
                />
                <p className="muted">
                  Preparing a visual may use the server-configured OpenAI,
                  Gemini or Anthropic model to select source excerpts. Missing
                  configuration or an unavailable provider uses the source
                  template. Each source edition is prepared once; publication
                  still requires your review.
                </p>
                <div className="ops-items">
                  {items.map((item) => (
                    <article className="panel" key={item.id}>
                      <span className="eyebrow">
                        {item.kind} · {item.status} · v{item.version}
                      </span>
                      <h2>{item.title}</h2>
                      <p>{item.summary}</p>
                      <p>
                        {item.source.name} · {shortDate(item.publishedAt)}
                      </p>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setReview(item);
                          setNote('');
                        }}
                      >
                        Review {item.title}
                      </button>
                      {item.status === 'published' && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void action(async () =>
                              setMedia(
                                MediaAssetSchema.parse(
                                  await json(
                                    `/ops/media/${item.id}`,
                                    {},
                                    'POST',
                                  ),
                                ),
                              ),
                            )
                          }
                        >
                          Prepare visual summary
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </>
            ) : tab === 'macro' ? (
              <MacroOperations action={action} busy={busy} />
            ) : tab === 'securities' ? (
              <SecurityOperations />
            ) : tab === 'retention' ? (
              <RetentionOperations
                onSessionExpired={() => {
                  setAuthenticated(false);
                  setError(
                    'Operations session ended. Sign in again to reopen saved cleanup history.',
                  );
                }}
              />
            ) : tab === 'workers' ? (
              <WorkerHealth
                onSessionExpired={() => {
                  setAuthenticated(false);
                  setItems([]);
                  setReview(null);
                  setMedia(null);
                  setError(
                    'Operations session ended. Sign in again to reopen worker health.',
                  );
                }}
              />
            ) : tab === 'feedback' ? (
              <FeedbackInbox />
            ) : (
              <SourceEditor />
            )}
          </>
        )}
        {media && (
          <Dialog title="Review visual summary" onClose={() => setMedia(null)}>
            <img
              alt={media.title}
              style={{ width: '100%', height: 'auto' }}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(media.svg)}`}
            />
            <p>{media.label}</p>
            <p>
              Caption preparation: {media.generation.provider}
              {media.generation.model
                ? ` · ${media.generation.model}`
                : ''}.{' '}
              {media.generation.fallbackReason
                ? `Template fallback: ${media.generation.fallbackReason.replaceAll('_', ' ')}.`
                : ''}
            </p>
            <ol>
              {media.captions.map((c) => (
                <li key={c.startMs}>{c.text}</li>
              ))}
            </ol>
            <a href={media.sourceUrl} target="_blank" rel="noreferrer">
              Check source
            </a>
            <div className="page-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await json(
                      `/ops/media/${media.itemId}`,
                      { assetId: media.id, publish: true },
                      'PUT',
                    );
                    setMedia(null);
                    setNotice('Reviewed visual published.');
                  })
                }
              >
                Publish reviewed visual
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await json(
                      `/ops/media/${media.itemId}`,
                      { assetId: media.id, publish: false },
                      'PUT',
                    );
                    setMedia(null);
                    setNotice('Visual unpublished.');
                  })
                }
              >
                Unpublish visual
              </button>
            </div>
          </Dialog>
        )}
        {review && (
          <Dialog title="Review publication" onClose={() => setReview(null)}>
            <p className="eyebrow">
              {review.kind} · VERSION {review.version}
            </p>
            <h3>{review.title}</h3>
            <p>{review.body}</p>
            <p>{review.effectiveLabel}</p>
            <a href={review.source.url} target="_blank" rel="noreferrer">
              Inspect original source
            </a>
            <p>{review.source.rights}</p>
            <label>
              Review note
              <textarea
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="page-actions">
              <button
                disabled={busy || !note.trim()}
                onClick={() =>
                  void action(async () => {
                    FeedItemSchema.parse(
                      await json(
                        `/ops/discovery/items/${review.id}`,
                        {
                          expectedVersion: review.version,
                          status: 'published',
                          correctionNote: note,
                        },
                        'PUT',
                      ),
                    );
                    await load();
                    setReview(null);
                    setNotice('Reviewed edition published.');
                  })
                }
              >
                Publish reviewed edition
              </button>
              <button
                className="secondary"
                disabled={busy || !note.trim()}
                onClick={() =>
                  void action(async () => {
                    await json(
                      `/ops/discovery/items/${review.id}`,
                      {
                        expectedVersion: review.version,
                        status: 'withdrawn',
                        correctionNote: note,
                      },
                      'PUT',
                    );
                    await load();
                    setReview(null);
                    setNotice('Item withdrawn from discovery.');
                  })
                }
              >
                Withdraw item
              </button>
            </div>
          </Dialog>
        )}
      </main>
    </div>
  );
}
function MacroOperations({
  action,
  busy,
}: {
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [items, setItems] = useState<
      ReturnType<typeof MacroDashboardSchema.parse>['sources']
    >([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    void json('/macro')
      .then((v) => setItems(MacroDashboardSchema.parse(v).sources))
      .catch(() => setMessage('Macro sources could not be loaded.'));
  }, []);
  return (
    <section>
      <h2>Macro ingestion</h2>
      <p>
        Refresh the actual provider and retain accepted observation revisions
        and original evidence.
      </p>
      <p role="status">{message}</p>
      {items.map((s) => (
        <article className="panel" key={s.indicator}>
          <h3>{s.title}</h3>
          <p>Last success {shortDate(s.lastSuccessAt)}</p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = MacroRunSchema.parse(
                  await json(
                    '/ops/macro/refresh',
                    { indicator: s.indicator },
                    'POST',
                  ),
                );
                setMessage(`${s.title}: ${result.status}. ${result.message}`);
                setItems(
                  MacroDashboardSchema.parse(await json('/macro')).sources,
                );
              })
            }
          >
            Refresh {s.title}
          </button>
        </article>
      ))}
    </section>
  );
}
function SourceEditor() {
  const [sources, setSources] = useState<SourceRecord[]>([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<SourceRecord | null>(null),
    [history, setHistory] = useState<SourceRecord[] | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () =>
    setSources(SourceListSchema.parse(await json('/ops/sources')));
  useEffect(() => {
    void load().catch(() => setError('Registry unavailable.'));
  }, []);
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registry operation failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>Source registry</h2>
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            const data = SourceInputSchema.parse(form);
            const record = SourceRecordSchema.parse(
              await json(
                `/ops/sources${editing ? `/${editing.id}` : ''}`,
                editing ? { data, expectedRevision: editing.revision } : data,
                editing ? 'PUT' : 'POST',
              ),
            );
            setEditing(record);
            setForm(record.data);
            await load();
            setNotice(`Saved source revision ${record.revision}.`);
          });
        }}
      >
        <h3>{editing ? 'Edit source metadata' : 'Add source metadata'}</h3>
        {(
          [
            'name',
            'category',
            'sourceUrl',
            'termsUrl',
            'constraints',
            'reviewEvidence',
          ] as const
        ).map((field) => (
          <label key={field}>
            {
              {
                name: 'Source name',
                category: 'Source category',
                sourceUrl: 'Source URL',
                termsUrl: 'Terms URL',
                constraints: 'Usage constraints',
                reviewEvidence: 'Review evidence',
              }[field]
            }
            <textarea
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Rights status
          <select
            value={form.rightsStatus}
            onChange={(e) =>
              setForm({
                ...form,
                rightsStatus: e.target.value as SourceInput['rightsStatus'],
              })
            }
          >
            <option value="unreviewed">Unreviewed</option>
            <option value="restricted">Restricted</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label>
          Review time (UTC ISO)
          <input
            value={form.reviewedAt ?? ''}
            onChange={(e) =>
              setForm({ ...form, reviewedAt: e.target.value || null })
            }
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Publish approved metadata
        </label>
        <div className="page-actions">
          <button disabled={busy}>Save source metadata</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForm(blank);
              setEditing(null);
            }}
          >
            New source
          </button>
        </div>
      </form>
      <div>
        {sources.map((s) => (
          <article className="panel" key={s.id}>
            <h3>{s.data.name}</h3>
            <p>
              Revision {s.revision} · {s.data.rightsStatus} ·{' '}
              {s.data.published ? 'Published' : 'Private'}
            </p>
            <div className="page-actions">
              <button
                className="secondary"
                onClick={() => {
                  setEditing(s);
                  setForm(s.data);
                  document
                    .querySelector('form')
                    ?.scrollIntoView({ block: 'start' });
                }}
              >
                Edit {s.data.name}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void action(async () =>
                    setHistory(
                      SourceListSchema.parse(
                        await json(`/ops/sources/${s.id}/history`),
                      ),
                    ),
                  )
                }
              >
                History {s.data.name}
              </button>
            </div>
          </article>
        ))}
      </div>
      {history && (
        <Dialog
          title="Source revision history"
          onClose={() => setHistory(null)}
        >
          {history.map((s) => (
            <div key={s.revision}>
              <h3>
                Revision {s.revision}: {s.data.name}
              </h3>
              <p>{s.data.constraints}</p>
              <p>{s.data.reviewEvidence}</p>
            </div>
          ))}
        </Dialog>
      )}
    </section>
  );
}

function SourceRefresh({
  action,
  busy,
  afterRefresh,
  latest,
}: {
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  afterRefresh: () => Promise<void>;
  latest: string;
}) {
  const [catalog, setCatalog] = useState<ResearchCatalog | null>(null),
    [runs, setRuns] = useState<
      ReturnType<typeof ResearchRunsSchema.parse>['runs']
    >([]),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void Promise.all([json('/discovery/catalog'), json('/ops/discovery/runs')])
      .then(([c, r]) => {
        const next = ResearchCatalogSchema.parse(c);
        const history = ResearchRunsSchema.parse(r);
        if (active) {
          setCatalog(next);
          setRuns(history.runs);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Source status could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="panel" aria-label="Source refresh">
      <h2>Source ingestion and editorial review</h2>
      <p>
        Select fixed, approved adapters. New or changed items stay in draft;
        each source reports its own outcome. A failed source does not erase
        previous publications.
      </p>
      {error && <p role="alert">{error}</p>}
      {!catalog && !error && <p role="status">Loading source adapters…</p>}
      <fieldset disabled={busy}>
        <legend>Sources to check</legend>
        {catalog?.sources.map((source) => {
          const run = runs.find((r) => r.sourceId === source.id);
          return (
            <div key={source.id} className="research-source-status">
              <label className="consent">
                <input
                  type="checkbox"
                  disabled={source.access !== 'enabled'}
                  checked={selected.includes(source.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, source.id]
                        : old.filter((id) => id !== source.id),
                    )
                  }
                />
                {source.name}
              </label>
              <p>
                {source.accessNote} · {source.publishedCount} published
              </p>
              {run ? (
                <p>
                  {run.status} · {run.checked} checked · {run.inserted} new
                  drafts · {shortDate(run.finishedAt ?? run.startedAt)}
                  <br />
                  {run.message}
                </p>
              ) : (
                <p>No source run recorded.</p>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="page-actions">
        <button
          disabled={busy || !selected.length}
          onClick={() =>
            void action(async () => {
              setMessage(
                'Checking selected sources. This can take several minutes.',
              );
              try {
                const run = DiscoveryRunSchema.parse(
                  await json(
                    '/ops/discovery/refresh',
                    { sourceIds: selected },
                    'POST',
                    AbortSignal.timeout(300000),
                  ),
                );
                setMessage(`${run.status}: ${run.message}`);
              } finally {
                setRetry((n) => n + 1);
                await afterRefresh();
              }
            })
          }
        >
          {busy ? 'Checking sources…' : 'Refresh discovery sources'}
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          Reload source status
        </button>
      </div>
      <p role="status">{message || latest}</p>
      <p className="muted">
        If the connection times out, reload status before starting another run.
        Publication remains a separate per-item review below.
      </p>
    </section>
  );
}
