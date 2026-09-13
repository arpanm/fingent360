import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AllocationStateSchema,
  AllocationHistorySchema,
  makeAllocation,
  type AllocationState,
  type AllocationRowInput,
  type AllocationSnapshot,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { useDraftGuard } from './useDraftGuard';
import { money } from './ui';
import './goal-allocations.css';
class SignedOut extends Error {}
async function request(path = '', body?: unknown): Promise<unknown> {
  const response = await fetch(`/api/v1/account/allocations${path}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    method: body ? 'PUT' : 'GET',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 401) throw new SignedOut();
  const value: unknown = await response.json().catch(() => {
    throw Error(
      'Allocation service returned an unreadable response. Please retry.',
    );
  });
  if (!response.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Could not load or save allocations.',
    );
  return value;
}
export function GoalAllocations() {
  const [data, setData] = useState<AllocationState | null>(null),
    [guest, setGuest] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [review, setReview] = useState<AllocationSnapshot | null>(null),
    [rows, setRows] = useState<AllocationRowInput[]>([]),
    [goal, setGoal] = useState(''),
    [isin, setIsin] = useState(''),
    [quantity, setQuantity] = useState(''),
    [consent, setConsent] = useState(false),
    [notice, setNotice] = useState(''),
    [history, setHistory] = useState<AllocationSnapshot[] | null>(null);
  const baseline = useRef('[]'),
    editor = useRef<HTMLDivElement>(null);
  const dirty =
    editing &&
    (JSON.stringify(rows) !== baseline.current ||
      !!goal ||
      !!isin ||
      !!quantity);
  useDraftGuard(dirty, 'Leave and discard unsaved allocation changes?');
  useLayoutEffect(() => {
    if (editing)
      editor.current
        ?.querySelector<HTMLElement>('select,input,button')
        ?.focus();
  }, [editing, review]);
  function failure(e: unknown) {
    if (e instanceof SignedOut) {
      setGuest(true);
      setData(null);
      setRows([]);
      setHistory(null);
      setEditing(false);
      setReview(null);
    } else
      setError(e instanceof Error ? e.message : 'Allocation request failed.');
  }
  async function load() {
    setBusy(true);
    setError('');
    try {
      setData(AllocationStateSchema.parse(await request()));
      setGuest(false);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void request()
      .then((v) => {
        if (active) setData(AllocationStateSchema.parse(v));
      })
      .catch((e) => {
        if (active) failure(e);
      });
    return () => {
      active = false;
    };
  }, []);
  function open() {
    if (!data) return;
    const next = data.snapshot.rows.map((r) => ({
      goalId: r.goalId,
      goalVersion:
        data.goals.find((g) => g.id === r.goalId)?.version ?? r.goalVersion,
      isin: r.isin,
      quantity: r.quantity,
    }));
    setRows(next);
    baseline.current = JSON.stringify(next);
    setEditing(true);
    setReview(null);
    setConsent(false);
    setError('');
    setNotice('');
  }
  function cancel() {
    if (dirty && !confirm('Discard unsaved allocation changes?')) return;
    setEditing(false);
    setReview(null);
    setGoal('');
    setIsin('');
    setQuantity('');
    setError('');
  }
  if (guest)
    return (
      <AccountGate
        next="allocations"
        title="Connect your holdings to goals"
        description="Sign in to earmark recorded holdings for your saved goals."
      />
    );
  return (
    <section className="allocation-page" aria-label="Goal allocations">
      <header className="page-header">
        <p className="page-kicker">MY MONEY</p>
        <h1>Give your holdings a purpose</h1>
        <p className="page-description">
          Earmark recorded quantities for your goals. This records your
          intention; it does not move investments or value them at today’s
          prices.
        </p>
        <p>
          <a href="#my-goals">Saved goals</a> ·{' '}
          <a href="#holdings">My holdings</a>
        </p>
      </header>
      {error && (
        <p role="alert">
          {error}{' '}
          {!editing && (
            <button onClick={() => void load()} disabled={busy}>
              Retry allocations
            </button>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p role="status">Loading your goals and holdings…</p>}
      {data && (
        <>
          <section className="panel" aria-label="Saved allocation plan">
            <div className="section-heading">
              <h2>Your allocation plan</h2>
              <span className="badge">Revision {data.snapshot.version}</span>
            </div>
            {data.requiresReview && (
              <div role="alert">
                <strong>Review required</strong>
                <p>
                  Your goals or holdings changed. Recorded costs below belong to
                  the saved edition.
                </p>
                {data.review.map((r) => (
                  <p key={r.goalId + r.isin}>
                    {
                      data.snapshot.rows.find((v) => v.goalId === r.goalId)
                        ?.goalName
                    }{' '}
                    · {r.isin}: {r.reasons.join(' ')}
                  </p>
                ))}
              </div>
            )}
            {!data.snapshot.rows.length ? (
              <p>No holdings allocated yet.</p>
            ) : (
              <div className="allocation-rows">
                {data.snapshot.rows.map((r) => (
                  <article className="card" key={r.goalId + r.isin}>
                    <h3>{r.goalName}</h3>
                    <p>
                      {r.quantity} units · {r.isin}
                    </p>
                    <p>
                      Attributed recorded cost: {money(r.recordedCostMinor)}
                    </p>
                    <a href={`#securities/${r.isin}`}>Look up identity</a>
                  </article>
                ))}
              </div>
            )}
            <p className="muted">
              Recorded cost uses proportional acquisition cost rounded down to
              whole paise. It is not market value and is not added to your
              goal’s saved balance.
            </p>
            {!editing && (
              <button onClick={open} disabled={busy}>
                Edit allocations
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setHistory(
                    AllocationHistorySchema.parse(await request('/history'))
                      .revisions,
                  );
                } catch (e) {
                  failure(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              View allocation history
            </button>
          </section>
          {editing && (
            <div ref={editor} className="panel" aria-label="Allocation editor">
              <h2>
                {review
                  ? 'Review your allocation plan'
                  : 'Choose how much to earmark'}
              </h2>
              {!review ? (
                <>
                  <p>
                    Available:{' '}
                    {data.holdings.holdings
                      .map((h) => `${h.quantity} units of ${h.isin}`)
                      .join('; ') ||
                      'No recorded holdings. Add holdings first.'}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError('');
                      const selected = data.goals.find((g) => g.id === goal);
                      if (!selected) return;
                      const next = [
                        ...rows,
                        {
                          goalId: goal,
                          goalVersion: selected.version,
                          isin,
                          quantity,
                        },
                      ];
                      try {
                        makeAllocation(
                          {
                            expectedVersion: data.snapshot.version,
                            expectedHoldingsVersion: data.holdings.version,
                            rows: next,
                            storageConsent: true,
                          },
                          data.holdings,
                          data.goals,
                          new Date().toISOString(),
                        );
                        if (
                          rows.some((r) => r.goalId === goal && r.isin === isin)
                        )
                          throw Error(
                            'Remove the existing goal/holding row before replacing its quantity.',
                          );
                        setRows(next);
                        setGoal('');
                        setIsin('');
                        setQuantity('');
                      } catch (err) {
                        failure(err);
                      }
                    }}
                  >
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="allocation-goal">Goal</label>
                        <select
                          id="allocation-goal"
                          required
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                        >
                          <option value="">Choose a saved goal</option>
                          {data.goals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="allocation-holding">Holding</label>
                        <select
                          id="allocation-holding"
                          required
                          value={isin}
                          onChange={(e) => setIsin(e.target.value)}
                        >
                          <option value="">Choose a recorded holding</option>
                          {data.holdings.holdings.map((h) => (
                            <option key={h.isin} value={h.isin}>
                              {h.isin} · {h.quantity} units
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="field">
                        Quantity to allocate
                        <input
                          required
                          inputMode="decimal"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="secondary"
                      disabled={busy || rows.length >= 200}
                    >
                      Add allocation
                    </button>
                  </form>
                  <ul>
                    {rows.map((r, i) => (
                      <li key={r.goalId + r.isin}>
                        {data.goals.find((g) => g.id === r.goalId)?.name ??
                          data.snapshot.rows.find((v) => v.goalId === r.goalId)
                            ?.goalName ??
                          'Removed goal'}{' '}
                        · {r.isin} · {r.quantity} units{' '}
                        <button
                          className="secondary"
                          onClick={() =>
                            setRows(rows.filter((_, index) => index !== i))
                          }
                        >
                          Remove allocation {i + 1}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      try {
                        if (goal || isin || quantity)
                          throw Error(
                            'Add the entered row or clear its fields before reviewing.',
                          );
                        setReview(
                          makeAllocation(
                            {
                              expectedVersion: data.snapshot.version,
                              expectedHoldingsVersion: data.holdings.version,
                              rows,
                              storageConsent: true,
                            },
                            data.holdings,
                            data.goals,
                            new Date().toISOString(),
                          ),
                        );
                      } catch (e) {
                        failure(e);
                      }
                    }}
                  >
                    Review allocations
                  </button>
                </>
              ) : (
                <>
                  <section aria-label="Allocation review">
                    {review.rows.length ? (
                      review.rows.map((r) => (
                        <p key={r.goalId + r.isin}>
                          {r.goalName}: {r.quantity} units of {r.isin} ·
                          recorded cost {money(r.recordedCostMinor)}
                        </p>
                      ))
                    ) : (
                      <p>
                        This saves an empty plan and releases all earmarked
                        quantities.
                      </p>
                    )}
                    <p>
                      No investment return, transfer or market valuation is
                      implied.
                    </p>
                  </section>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I agree to store this allocation plan and its revisions.
                  </label>
                  <button
                    disabled={busy || !consent}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const saved = AllocationStateSchema.parse(
                          await request('', {
                            expectedVersion: data.snapshot.version,
                            expectedHoldingsVersion: data.holdings.version,
                            rows,
                            storageConsent: true,
                          }),
                        );
                        setData(saved);
                        setEditing(false);
                        setReview(null);
                        setNotice('Allocation plan saved.');
                        setHistory(null);
                      } catch (e) {
                        failure(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save allocation plan
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setReview(null);
                      setConsent(false);
                    }}
                  >
                    Back to allocations
                  </button>
                </>
              )}
              <button className="secondary" disabled={busy} onClick={cancel}>
                Cancel allocations
              </button>
              <p className="muted">
                If saving reports changed records, cancel and reload, then
                review against the current quantities. Failed saves preserve
                your draft.
              </p>
            </div>
          )}
          {!editing && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Reload allocations
            </button>
          )}
          <section
            className="panel"
            aria-label="Separate goal contribution context"
          >
            <h2>Your contribution plans stay separate</h2>
            {data.goals.map((g) => (
              <p key={g.id}>
                {g.name}: saved {money(g.savedMinor)}, monthly{' '}
                {money(g.monthlyMinor)} for {g.horizonMonths} months; no-growth
                projected balance {money(g.projectedMinor)}, gap{' '}
                {money(g.gapMinor)}.
              </p>
            ))}
          </section>
          {history && (
            <section className="panel" aria-label="Allocation history">
              <h2>Saved revisions</h2>
              {history.length ? (
                history.map((s) => (
                  <details key={s.version}>
                    <summary>
                      Allocation revision {s.version} ·{' '}
                      {s.savedAt && new Date(s.savedAt).toLocaleString()}
                    </summary>
                    <p>Holdings revision {s.holdingsVersion}</p>
                    {s.rows.map((r) => (
                      <p key={r.goalId + r.isin}>
                        {r.goalName} · {r.quantity} units · {r.isin} · recorded
                        cost {money(r.recordedCostMinor)}
                      </p>
                    ))}
                    {!s.rows.length && <p>Empty allocation plan.</p>}
                  </details>
                ))
              ) : (
                <p>No saved revisions yet.</p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
