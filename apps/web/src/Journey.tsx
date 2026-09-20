import { ResearchLinks } from './ResearchLinks';
import { useEffect, useState } from 'react';
import {
  CatalogSchema,
  PreviewSchema,
  ReviewListSchema,
  ReviewSchema,
  SessionSchema,
  WorkspaceSchema,
  PortfolioInputSchema,
  type Catalog,
  type PortfolioInput,
  type Preview,
  type Review,
  type Workspace,
} from '@fingent360/contracts';

const tokenKey = 'fingent360.virtual-token.v1';
const template = 'instrumentId,quantity\nalpha-air,10\n';
const initial: PortfolioInput = { holdings: [], cash: '0.00', goals: [] };
const labels = {
  review: 'Review',
  no_review_trigger: 'No review trigger',
  unable_to_assess: 'Unable to assess',
};
function storedToken() {
  try {
    return localStorage.getItem(tokenKey) ?? '';
  } catch {
    return '';
  }
}
function inr(value: string) {
  return `INR ${value}`;
}
async function request(
  path: string,
  token: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<unknown> {
  const response = await fetch(`/api/v1/journey/${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : 'Request failed';
    throw new Error(message);
  }
  return payload;
}
export function Journey({ route }: { route: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [token, setToken] = useState(storedToken);
  const [saved, setSaved] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<PortfolioInput>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [csv, setCsv] = useState(template);
  const [importCash, setImportCash] = useState('1000.00');
  const [sourceTotal, setSourceTotal] = useState('2000.00');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [scenario, setScenario] = useState<
    'baseline' | 'stale' | 'conflicting'
  >('baseline');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dirty =
    saved !== null && JSON.stringify(draft) !== JSON.stringify(saved.portfolio);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    void request('catalog', '')
      .then((data) => {
        if (active) setCatalog(CatalogSchema.parse(data));
      })
      .catch(() => {
        if (active)
          setError('Could not load the scenario. Use Retry to reconnect.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void Promise.all([request('workspace', token), request('reviews', token)])
      .then(([data, history]) => {
        if (!active) return;
        const workspace = WorkspaceSchema.parse(data);
        setSaved(workspace);
        setDraft(workspace.portfolio);
        setReviews(ReviewListSchema.parse(history));
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error ? error.message : 'Workspace unavailable',
          );
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Operation failed. Retry when the API is available.',
      );
    } finally {
      setBusy(false);
    }
  }
  function accept(data: unknown) {
    const next = WorkspaceSchema.parse(data);
    setSaved(next);
    setDraft(next.portfolio);
    setMessage(`Saved revision ${next.revision}.`);
  }
  async function start() {
    const session = SessionSchema.parse(await request('workspaces', '', {}));
    let persistent = true;
    try {
      localStorage.setItem(tokenKey, session.token);
    } catch {
      persistent = false;
    }
    setToken(session.token);
    setMessage(
      persistent
        ? 'Virtual workspace opened. Use fictional holdings only.'
        : 'Workspace opened for this page only: browser storage is unavailable. Delete it before leaving or its access key will be lost.',
    );
  }
  async function save() {
    if (!saved) return;
    const result = PortfolioInputSchema.safeParse(draft);
    if (!result.success)
      throw new Error(result.error.issues.map((i) => i.message).join('; '));
    accept(
      await request('workspace', token, {
        portfolio: result.data,
        expectedRevision: saved.revision,
        idempotencyKey: crypto.randomUUID(),
      }),
    );
  }
  function updateGoal(
    index: number,
    patch: Partial<PortfolioInput['goals'][number]>,
  ) {
    setDraft({
      ...draft,
      goals: draft.goals.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    });
  }
  const company = catalog?.companies.find((c) => `company/${c.id}` === route);
  const source = catalog?.event.sources.find((s) => `source/${s.id}` === route);
  return (
    <div className="journey">
      <nav aria-label="Main navigation">
        {[
          ['brief', 'Market brief'],
          ['portfolio', 'Portfolio'],
          ['import', 'Import CSV'],
          ['goals', 'Goals'],
          ['reviews', 'Reviews'],
        ].map(([id, title]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={route === id ? 'page' : undefined}
          >
            {title}
          </a>
        ))}
      </nav>
      <p className="demo-banner">
        <strong>Synthetic learning workspace.</strong> Fictional companies and
        prices; no live market data or investment recommendations. Do not enter
        real financial or personal information.
      </p>
      {route === 'brief' && (
        <ResearchLinks
          topic="Investor basics"
          basis="This lab uses fictional companies and prices. Open separately published research to practise checking sources; it does not update or validate the fictional scenario."
        />
      )}
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                setCatalog(CatalogSchema.parse(await request('catalog', '')));
                if (token) {
                  accept(await request('workspace', token));
                  setReviews(
                    ReviewListSchema.parse(await request('reviews', token)),
                  );
                }
              })
            }
          >
            Retry / reload saved data
          </button>
          <p>Reload replaces unsaved edits with the last saved revision.</p>
        </div>
      )}
      <p aria-live="polite">{busy ? 'Saving or loading…' : message}</p>
      {!catalog && <p>Loading scenario…</p>}
      {catalog && route === 'brief' && (
        <>
          <p className="eyebrow">ONE SCENARIO · FOLLOW THE EVIDENCE</p>
          <h2>Your market learning brief</h2>
          <p>
            1 fictional development. Fixture date: {catalog.asOf.slice(0, 10)}.
            These prices are fixed exercise inputs, not fresh quotes.
          </p>
          <article className="card">
            <span className="pill">Scenario · Aviation</span>
            <h3>
              <a href="#event">{catalog.event.title}</a>
            </h3>
            <p>{catalog.event.summary}</p>
            <a href="#event">Explore the mechanism →</a>
          </article>
          <section className="features" aria-label="Learning journey">
            <article>
              <h3>Understand</h3>
              <p>Read the event and its supporting exercise notes.</p>
              <a href="#event">Open event</a>
            </article>
            <article>
              <h3>Connect</h3>
              <p>Enter virtual holdings or import the supplied CSV template.</p>
              <a href="#portfolio">Open portfolio</a>
            </article>
            <article>
              <h3>Reflect</h3>
              <p>
                Allocate capital to goals and review exposure without a trade
                recommendation.
              </p>
              <a href="#goals">Open goals</a>
            </article>
          </section>
        </>
      )}
      {catalog && route === 'event' && (
        <section>
          <a href="#brief">← Market brief</a>
          <h2>{catalog.event.title}</h2>
          <p>{catalog.event.summary}</p>
          <div className="card">
            <h3>How it could travel through the economy</h3>
            <p>{catalog.event.mechanism}</p>
            <p>
              Claim type: scenario. Horizon and price response: unknown. Fixture
              revision: {catalog.version}.
            </p>
          </div>
          <h3>Companies</h3>
          {catalog.companies.map((c) => (
            <p key={c.id}>
              <a href={`#company/${c.id}`}>{c.name}</a> · {c.sector}
            </p>
          ))}
          <h3>Supporting notes</h3>
          {catalog.event.sources.map((s) => (
            <p key={s.id}>
              <a href={`#source/${s.id}`}>{s.title}</a> · {s.locator}
            </p>
          ))}
          <a href="#portfolio">Connect to your virtual portfolio →</a>
        </section>
      )}
      {company && (
        <section>
          <a href="#event">← Event</a>
          <h2>{company.name}</h2>
          <p>
            {company.sector} · fictional company · {company.id}
          </p>
          <p className="big-number">{inr(company.price)}</p>
          <p>
            Fixed fixture price as of {catalog?.asOf.slice(0, 10)}. No live
            quote.
          </p>
          <p>{company.explanation}</p>
          <p>
            Revenue, earnings, valuation multiples and consensus: unavailable.
          </p>
          <a href="#portfolio">Add a virtual holding</a>
        </section>
      )}
      {source && (
        <section>
          <a href="#event">← Event</a>
          <h2>{source.title}</h2>
          <p>{source.locator} · fixture-v1 · synthetic source</p>
          <blockquote>{source.text}</blockquote>
          <p>
            Written for this exercise; no external source approval or real
            market claim.
          </p>
        </section>
      )}
      {['portfolio', 'import', 'goals', 'reviews'].includes(route) && (
        <>
          {!token && (
            <section className="card">
              <h2>Open a virtual workspace</h2>
              <p>
                Save fictional holdings, goals and review history on this local
                server. This browser stores the access key. Anyone with that key
                can access this workspace. This is not a real-account sign-in.
              </p>
              <button disabled={busy} onClick={() => void action(start)}>
                Open virtual workspace
              </button>
            </section>
          )}
          {token && !saved && (
            <p>
              Loading saved workspace. If it cannot be restored, use Retry or
              forget its local key below.
            </p>
          )}
          {saved && (
            <>
              <p className="muted">
                Saved revision {saved.revision}
                {dirty
                  ? ' · Unsaved edits — save before importing or reviewing.'
                  : ''}
              </p>
              {route === 'portfolio' && (
                <section>
                  <h2>Virtual portfolio</h2>
                  <p>
                    Only the two fictional companies are supported. Quantities
                    allow six decimal places; cash uses two.
                  </p>
                  <fieldset disabled={busy}>
                    <legend>Holdings</legend>
                    {catalog?.companies.map((c) => (
                      <label key={c.id}>
                        {c.name} quantity
                        <input
                          inputMode="decimal"
                          value={
                            draft.holdings.find((h) => h.instrumentId === c.id)
                              ?.quantity ?? ''
                          }
                          placeholder="No holding"
                          onChange={(e) => {
                            const others = draft.holdings.filter(
                              (h) => h.instrumentId !== c.id,
                            );
                            setDraft({
                              ...draft,
                              holdings: e.target.value
                                ? [
                                    ...others,
                                    {
                                      instrumentId: c.id,
                                      quantity: e.target.value,
                                    },
                                  ]
                                : others,
                            });
                          }}
                        />
                      </label>
                    ))}
                    <label>
                      Cash (INR)
                      <input
                        inputMode="decimal"
                        value={draft.cash}
                        onChange={(e) =>
                          setDraft({ ...draft, cash: e.target.value })
                        }
                      />
                    </label>
                    <button onClick={() => void action(save)}>
                      Save portfolio
                    </button>
                  </fieldset>
                  <div className="stats" aria-label="Saved valuation">
                    <div>
                      Total value<strong>{inr(saved.valuation.total)}</strong>
                    </div>
                    <div>
                      Oil-linked exposure
                      <strong>{inr(saved.valuation.affected)}</strong>
                    </div>
                    <div>
                      Portfolio exposure
                      <strong>
                        {saved.valuation.affectedPercent === null
                          ? 'Unavailable'
                          : `${saved.valuation.affectedPercent}%`}
                      </strong>
                    </div>
                  </div>
                  <p>
                    Saved values use fixed synthetic prices. Exposure is not
                    expected loss.
                  </p>
                  <a href="#goals">Allocate to goals →</a>
                </section>
              )}
              {route === 'import' && (
                <section>
                  <h2>Import a virtual portfolio</h2>
                  <p>
                    Use a simple UTF-8 CSV with instrumentId,quantity columns.
                    Accepted IDs: alpha-air, bharat-software. No quoted cells,
                    broker exports or XLSX in this version. Maximum 16 KB.
                    Import replaces holdings and cash while retaining goals.
                  </p>
                  <a
                    download="virtual-portfolio.csv"
                    href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
                  >
                    Download sample CSV
                  </a>
                  <fieldset disabled={busy || dirty}>
                    <legend>Preview before saving</legend>
                    <label htmlFor="journey-import-file">
                      CSV file
                      <input
                        id="journey-import-file"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void action(async () => {
                              if (
                                file.size > 16000 ||
                                !file.name.toLowerCase().endsWith('.csv')
                              )
                                throw new Error(
                                  'Choose a CSV file up to 16 KB.',
                                );
                              setCsv(await file.text());
                              setPreview(null);
                            });
                        }}
                      />
                    </label>
                    <div className="feedback-safe-field">
                      <label htmlFor="journey-import-csv-content">
                        CSV content
                      </label>
                      <textarea
                        id="journey-import-csv-content"
                        rows={5}
                        value={csv}
                        onChange={(e) => {
                          setCsv(e.target.value);
                          setPreview(null);
                        }}
                      />
                    </div>
                    <label htmlFor="journey-import-cash">
                      Import cash (INR)
                      <input
                        id="journey-import-cash"
                        value={importCash}
                        onChange={(e) => {
                          setImportCash(e.target.value);
                          setPreview(null);
                        }}
                      />
                    </label>
                    <label htmlFor="journey-import-source-total">
                      Declared total including cash (INR)
                      <input
                        id="journey-import-source-total"
                        value={sourceTotal}
                        onChange={(e) => {
                          setSourceTotal(e.target.value);
                          setPreview(null);
                        }}
                      />
                    </label>
                    <button
                      onClick={() =>
                        void action(async () => {
                          setPreview(
                            PreviewSchema.parse(
                              await request('previews', token, {
                                csv,
                                cash: importCash,
                                sourceTotal,
                              }),
                            ),
                          );
                        })
                      }
                    >
                      Preview import
                    </button>
                  </fieldset>
                  {preview && (
                    <div className="card">
                      <h3>Import preview</h3>
                      <p>
                        {preview.matched
                          ? 'Reconciled — ready to confirm'
                          : 'Needs correction — nothing imported'}
                      </p>
                      {preview.holdings.map((h) => (
                        <p key={h.instrumentId}>
                          {h.instrumentId}: {h.quantity} units
                        </p>
                      ))}
                      <p>
                        Calculated: {inr(preview.calculatedTotal)} · Declared:{' '}
                        {inr(preview.sourceTotal)}
                      </p>
                      {preview.issues.map((issue) => (
                        <p key={issue} className="error">
                          {issue}
                        </p>
                      ))}
                      <button
                        disabled={!preview.matched || busy || dirty}
                        onClick={() =>
                          void action(async () => {
                            accept(
                              await request('imports', token, {
                                previewId: preview.id,
                                expectedRevision: saved.revision,
                                idempotencyKey: crypto.randomUUID(),
                              }),
                            );
                            setPreview(null);
                          })
                        }
                      >
                        Confirm import
                      </button>
                    </div>
                  )}
                </section>
              )}
              {route === 'goals' && (
                <section>
                  <h2>Your goals</h2>
                  <p>
                    Each percentage allocates that share of the entire virtual
                    portfolio, including cash. Combined allocations cannot
                    exceed 100%. No inflation or return assumptions are applied.
                    New-goal defaults are education, INR 1000.00, 2030-01-01,
                    flexible priority and 0% allocation; edit them before saving
                    to confirm.
                  </p>
                  <fieldset disabled={busy}>
                    <legend>Goal allocation</legend>
                    {draft.goals.length === 0 && (
                      <p>
                        No goals yet. Add a goal to see its portfolio context.
                      </p>
                    )}
                    {draft.goals.map((g, i) => (
                      <div className="card" key={g.id}>
                        <h3>Goal {i + 1}</h3>
                        <label>
                          Goal {i + 1} name
                          <input
                            value={g.name}
                            onChange={(e) =>
                              updateGoal(i, { name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Goal {i + 1} type
                          <select
                            value={g.type}
                            onChange={(e) =>
                              updateGoal(i, {
                                type: e.target.value as typeof g.type,
                              })
                            }
                          >
                            {[
                              'education',
                              'purchase',
                              'retirement',
                              'other',
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Goal {i + 1} target (INR)
                          <input
                            value={g.target}
                            onChange={(e) =>
                              updateGoal(i, { target: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Goal {i + 1} target date
                          <input
                            type="date"
                            value={g.targetDate}
                            onChange={(e) =>
                              updateGoal(i, { targetDate: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Goal {i + 1} priority
                          <select
                            value={g.priority}
                            onChange={(e) =>
                              updateGoal(i, {
                                priority: e.target.value as typeof g.priority,
                              })
                            }
                          >
                            <option>essential</option>
                            <option>flexible</option>
                          </select>
                        </label>
                        <label>
                          Goal {i + 1} allocation (%)
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.allocationPercent}
                            onChange={(e) =>
                              updateGoal(i, {
                                allocationPercent: e.target.valueAsNumber,
                              })
                            }
                          />
                        </label>
                        <button
                          className="secondary"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              goals: draft.goals.filter(
                                (item) => item.id !== g.id,
                              ),
                            })
                          }
                        >
                          Remove goal {i + 1}
                        </button>
                      </div>
                    ))}
                    <button
                      className="secondary"
                      disabled={draft.goals.length >= 20}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          goals: [
                            ...draft.goals,
                            {
                              id: crypto.randomUUID(),
                              name: '',
                              type: 'education',
                              target: '1000.00',
                              targetDate: '2030-01-01',
                              priority: 'flexible',
                              allocationPercent: 0,
                            },
                          ],
                        })
                      }
                    >
                      Add goal
                    </button>{' '}
                    <button onClick={() => void action(save)}>
                      Save goals
                    </button>
                  </fieldset>
                  <h3>Saved funding</h3>
                  {saved.valuation.goals.map((g) => (
                    <p key={g.id}>
                      {
                        saved.portfolio.goals.find((goal) => goal.id === g.id)
                          ?.name
                      }
                      : {inr(g.funded)} funded ({g.fundedPercent}% of target);{' '}
                      {inr(g.affected)} oil-linked exposure.
                    </p>
                  ))}
                  <p>
                    Unallocated: {inr(saved.valuation.unallocated)}. Funded
                    ratio is not probability of success.
                  </p>
                  <a href="#reviews">Review the scenario →</a>
                </section>
              )}
              {route === 'reviews' && (
                <section>
                  <h2>Educational review</h2>
                  <p>
                    Reviews use saved inputs and preserve their original
                    revision. A changed portfolio requires a new review.
                  </p>
                  <fieldset className="journey-review-conditions">
                    <legend>Exercise input condition</legend>
                    {(
                      [
                        ['baseline', 'Baseline synthetic inputs'],
                        ['stale', 'Simulate stale price'],
                        ['conflicting', 'Simulate conflicting evidence'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="journey-review-scenario"
                          value={value}
                          checked={scenario === value}
                          onChange={() => setScenario(value as typeof scenario)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button
                    disabled={busy || dirty}
                    onClick={() =>
                      void action(async () => {
                        const review = ReviewSchema.parse(
                          await request('reviews', token, { scenario }),
                        );
                        setSelected(review);
                        setReviews(
                          ReviewListSchema.parse(
                            await request('reviews', token),
                          ),
                        );
                      })
                    }
                  >
                    Create review
                  </button>
                  {selected && (
                    <article className="card" aria-label="Selected review">
                      <h3>{labels[selected.status]}</h3>
                      {selected.reasons.map((r) => (
                        <p key={r}>{r}</p>
                      ))}
                      <p>
                        {selected.status === 'unable_to_assess'
                          ? 'Historical fixture exposure (assessment blocked)'
                          : 'Scenario exposure'}
                        : {inr(selected.valuation.affected)}.
                      </p>
                      <p>{selected.comparator}</p>
                      <p>
                        Portfolio revision {selected.revision} ·{' '}
                        {selected.policyVersion} · {selected.fixtureVersion} ·{' '}
                        {selected.issuedAt}
                      </p>
                      <details>
                        <summary>Reconstruct saved inputs</summary>
                        <pre>{JSON.stringify(selected.portfolio, null, 2)}</pre>
                      </details>
                      <a href="#event">
                        Read the mechanism and supporting notes
                      </a>
                    </article>
                  )}
                  <h3>Saved review history (latest 50)</h3>
                  {reviews.length === 0 && <p>No reviews yet.</p>}
                  {reviews.map((review) => (
                    <p key={review.id}>
                      <button
                        className="secondary"
                        onClick={() =>
                          void action(async () =>
                            setSelected(
                              ReviewSchema.parse(
                                await request(`reviews/${review.id}`, token),
                              ),
                            ),
                          )
                        }
                      >
                        {labels[review.status]} · revision {review.revision} ·{' '}
                        {review.issuedAt}
                      </button>
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
          {token && (
            <details className="workspace-controls">
              <summary>Workspace access and deletion</summary>
              <p>
                The key is stored in this browser. Forgetting it does not delete
                server records; deleting the workspace removes its previews,
                holdings, goals and reviews.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  try {
                    localStorage.removeItem(tokenKey);
                  } catch {
                    /* No stored key. */
                  }
                  setToken('');
                  setSaved(null);
                  setDraft(initial);
                  setReviews([]);
                  setSelected(null);
                  setPreview(null);
                  setError('');
                }}
              >
                Forget local key
              </button>{' '}
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await request('workspace', token, undefined, 'DELETE');
                    try {
                      localStorage.removeItem(tokenKey);
                    } catch {
                      /* Session still cleared. */
                    }
                    setToken('');
                    setSaved(null);
                    setDraft(initial);
                    setReviews([]);
                    setSelected(null);
                    setPreview(null);
                    setMessage('Virtual workspace deleted.');
                  })
                }
              >
                Delete virtual workspace and data
              </button>
            </details>
          )}
        </>
      )}
      {!['brief', 'event', 'portfolio', 'import', 'goals', 'reviews'].includes(
        route,
      ) &&
        !company &&
        !source &&
        catalog && (
          <p>
            Page not found. <a href="#brief">Return to the market brief.</a>
          </p>
        )}
    </div>
  );
}
