import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  GoalComparisonsSchema,
  GoalComparisonSchema,
  GoalAdoptionSchema,
  GoalComparisonInputSchema,
  compareGoal,
  goalMinorToRupees,
  rupeesToGoalMinor,
  type GoalComparison,
  type GoalAdoption,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { useDraftGuard } from './useDraftGuard';
import { money } from './ui';
type State = ReturnType<typeof GoalComparisonsSchema.parse>;
class Guest extends Error {}
async function request(path = '', body?: unknown) {
  const r = await fetch(`/api/v1/account/goal-comparisons${path}`, {
    method: body ? 'PUT' : 'GET',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (r.status === 401) throw new Guest();
  const value: unknown = await r.json().catch(() => {
    throw Error('Comparison service returned an unreadable response. Retry.');
  });
  if (!r.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Comparison request failed.',
    );
  return value;
}
export function GoalScenarios() {
  const [data, setData] = useState<State | null>(null),
    [guest, setGuest] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [fresh, setFresh] = useState(false),
    [notice, setNotice] = useState(''),
    [editing, setEditing] = useState(false),
    [goalId, setGoalId] = useState(''),
    [alternatives, setAlternatives] = useState([{ monthly: '', months: '' }]),
    [consent, setConsent] = useState(false),
    [review, setReview] = useState<GoalComparison | null>(null),
    [selected, setSelected] = useState<GoalComparison | null>(null),
    [adoption, setAdoption] = useState<{
      comparison: GoalComparison;
      index: number;
      requestId: string;
    } | null>(null),
    [receipt, setReceipt] = useState<GoalAdoption | null>(null);
  const section = useRef<HTMLElement>(null),
    creationId = useRef(crypto.randomUUID());
  const dirty =
    editing &&
    (!!goalId || alternatives.some((a) => !!a.monthly || !!a.months));
  useDraftGuard(dirty, 'Discard unsaved comparison changes?');
  useLayoutEffect(() => {
    if (editing || adoption)
      section.current?.querySelector<HTMLElement>('[data-step-title]')?.focus();
  }, [editing, review, adoption]);
  function failure(e: unknown) {
    if (e instanceof Guest) {
      setGuest(true);
      setData(null);
      setSelected(null);
      setEditing(false);
      setAdoption(null);
      setReceipt(null);
    } else setError(e instanceof Error ? e.message : 'Request failed.');
  }
  async function load() {
    setBusy(true);
    setFresh(false);
    setError('');
    try {
      setData(GoalComparisonsSchema.parse(await request()));
      setGuest(false);
      setFresh(true);
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
        if (active) {
          setData(GoalComparisonsSchema.parse(v));
          setFresh(true);
        }
      })
      .catch((e) => {
        if (active) failure(e);
      });
    return () => {
      active = false;
    };
  }, []);
  function cancel() {
    if (dirty && !confirm('Discard unsaved comparison changes?')) return;
    setEditing(false);
    setReview(null);
  }
  const chosen = data?.goals.find((g) => g.id === goalId);
  function table(comparison: GoalComparison) {
    return (
      <div className="metric-grid">
        <article className="metric-card">
          <h3>Unchanged plan</h3>
          <p>
            {money(comparison.baseline.monthlyMinor)} monthly ·{' '}
            {comparison.baseline.horizonMonths} months
          </p>
          <p>
            Projected contributions: {money(comparison.baseline.projectedMinor)}
          </p>
          <p>Remaining gap: {money(comparison.baseline.gapMinor)}</p>
        </article>
        {comparison.alternatives.map((a, index) => (
          <article className="metric-card" key={index}>
            <h3>Alternative {index + 1}</h3>
            <p>
              {money(a.monthlyMinor)} monthly · {a.horizonMonths} months
            </p>
            <p>Projected contributions: {money(a.projectedMinor)}</p>
            <p>Remaining gap: {money(a.gapMinor)}</p>
            <p>
              Projected difference:{' '}
              {a.projectedDifferenceMinor.startsWith('-') ? '-' : ''}
              {money(a.projectedDifferenceMinor.replace('-', ''))}
            </p>
          </article>
        ))}
      </div>
    );
  }
  if (guest)
    return (
      <AccountGate next="comparisons" title="Compare your contribution plans" />
    );
  return (
    <section className="account" aria-label="Goal comparisons" ref={section}>
      <header className="page-header">
        <p className="page-kicker">MY MONEY</p>
        <h1>Compare contribution plans</h1>
        <p>
          Explore your own monthly contributions and time horizons. No
          investment returns or inflation adjustment are assumed.
        </p>
        <a href="#my-goals">Back to saved goals</a>
      </header>
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!editing && !adoption && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Retry comparisons
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p role="status">Loading saved goals…</p>}
      {data && (
        <>
          <p>
            Saved comparisons are historical receipts.{' '}
            {fresh
              ? 'Current goal editions loaded.'
              : 'Current goal state is unavailable; reload before adopting.'}
          </p>
          {!editing && !adoption && (
            <div className="page-actions">
              <button
                disabled={
                  busy ||
                  !fresh ||
                  !data.goals.length ||
                  data.comparisons.length >= 100
                }
                onClick={() => {
                  setEditing(true);
                  setGoalId('');
                  setAlternatives([{ monthly: '', months: '' }]);
                  setConsent(false);
                  setReview(null);
                  creationId.current = crypto.randomUUID();
                  setNotice('');
                }}
              >
                New comparison
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void load()}
              >
                Reload comparisons
              </button>
            </div>
          )}
          {!data.goals.length && (
            <p>
              Save a goal first. <a href="#my-goals">Create a goal</a>
            </p>
          )}
          {editing && (
            <section className="panel" aria-label="Comparison editor">
              <h2 tabIndex={-1} data-step-title>
                {review
                  ? 'Review unchanged plan and alternatives'
                  : 'Choose your alternatives'}
              </h2>
              {review ? (
                <>
                  {table(review)}
                  <p>Saving this comparison does not change your goal.</p>
                  <button
                    disabled={busy || !consent}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const input = GoalComparisonInputSchema.parse({
                          goalId: review.baseline.id,
                          expectedGoalVersion: review.baseline.version,
                          alternatives: review.alternatives.map((a) => ({
                            monthlyMinor: a.monthlyMinor,
                            horizonMonths: a.horizonMonths,
                          })),
                          storageConsent: consent,
                        });
                        const saved = GoalComparisonSchema.parse(
                          await request(`/${creationId.current}`, input),
                        );
                        setFresh(false);
                        setData((old) =>
                          old
                            ? {
                                ...old,
                                comparisons: [
                                  ...old.comparisons.filter(
                                    (c) => c.id !== saved.id,
                                  ),
                                  saved,
                                ],
                              }
                            : old,
                        );
                        setSelected(saved);
                        setEditing(false);
                        setReview(null);
                        setNotice(
                          'Comparison saved. Your goal was not changed.',
                        );
                        await load();
                      } catch (e) {
                        failure(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save comparison
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Back to alternatives
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    try {
                      if (!chosen) throw Error('Choose an owned goal.');
                      const input = GoalComparisonInputSchema.parse({
                        goalId,
                        expectedGoalVersion: chosen.version,
                        alternatives: alternatives.map((a) => ({
                          monthlyMinor: rupeesToGoalMinor(a.monthly),
                          horizonMonths: Number(a.months),
                        })),
                        storageConsent: consent,
                      });
                      setReview(
                        compareGoal(
                          creationId.current,
                          chosen,
                          input,
                          new Date().toISOString(),
                        ),
                      );
                    } catch (e) {
                      failure(e);
                    }
                  }}
                >
                  <div className="field">
                    <label htmlFor="comparison-goal">Saved goal</label>
                    <select
                      id="comparison-goal"
                      required
                      value={goalId}
                      onChange={(e) => setGoalId(e.target.value)}
                    >
                      <option value="">Choose a saved goal</option>
                      {data.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {chosen && (
                    <p>
                      Baseline edition {chosen.version}: saved{' '}
                      {money(chosen.savedMinor)}, target{' '}
                      {money(chosen.targetMinor)}. Unchanged contribution{' '}
                      {money(chosen.monthlyMinor)} for {chosen.horizonMonths}{' '}
                      months.
                    </p>
                  )}
                  {alternatives.map((a, index) => (
                    <fieldset key={index}>
                      <legend>Alternative {index + 1}</legend>
                      <label className="field">
                        Monthly contribution in rupees {index + 1}
                        <input
                          required
                          inputMode="decimal"
                          value={a.monthly}
                          onChange={(e) =>
                            setAlternatives(
                              alternatives.map((v, i) =>
                                i === index
                                  ? { ...v, monthly: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        Months {index + 1}
                        <input
                          required
                          type="number"
                          min="1"
                          max="1200"
                          value={a.months}
                          onChange={(e) =>
                            setAlternatives(
                              alternatives.map((v, i) =>
                                i === index
                                  ? { ...v, months: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                      {alternatives.length > 1 && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setAlternatives(
                              alternatives.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remove alternative {index + 1}
                        </button>
                      )}
                    </fieldset>
                  ))}
                  {alternatives.length < 3 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setAlternatives([
                          ...alternatives,
                          { monthly: '', months: '' },
                        ])
                      }
                    >
                      Add alternative
                    </button>
                  )}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I agree to store this comparison and its adoption history.
                  </label>
                  <button type="submit">Review comparison</button>
                </form>
              )}
              <button className="secondary" disabled={busy} onClick={cancel}>
                Cancel comparison
              </button>
            </section>
          )}
          <section className="panel" aria-label="Saved comparisons">
            <h2>Saved comparisons</h2>
            <p>{data.comparisons.length} of 100 saved comparisons.</p>
            {data.comparisons.length >= 100 && (
              <p role="status">
                Your comparison storage is full. You can still open existing
                comparisons. <a href="#privacy">Export your records</a>.
              </p>
            )}
            {!data.comparisons.length ? (
              <p>No comparisons saved yet.</p>
            ) : (
              data.comparisons.map((c) => (
                <button
                  className="secondary"
                  key={c.id}
                  disabled={editing || !!adoption}
                  onClick={() => setSelected(c)}
                >
                  {c.baseline.name} · baseline {c.baseline.version} ·{' '}
                  {new Date(c.savedAt).toLocaleString()}
                </button>
              ))
            )}
          </section>
          {selected && !editing && (
            <section className="panel" aria-label="Saved comparison detail">
              <h2>{selected.baseline.name} — saved comparison</h2>
              <p>
                Captured {new Date(selected.savedAt).toLocaleString()} ·
                baseline edition {selected.baseline.version}. Saved{' '}
                {money(selected.baseline.savedMinor)}; target{' '}
                {money(selected.baseline.targetMinor)}.
              </p>
              {table(selected)}
              {!data.goals.some(
                (g) =>
                  g.id === selected.baseline.id &&
                  g.version === selected.baseline.version,
              ) && (
                <p role="alert">
                  This goal changed or was removed. The comparison remains
                  historical. Create a new comparison from the current goal to
                  adopt a different plan.
                </p>
              )}
              {selected.alternatives.map((_, index) => (
                <button
                  key={index}
                  disabled={
                    busy ||
                    !fresh ||
                    editing ||
                    !!adoption ||
                    !data.goals.some(
                      (g) =>
                        g.id === selected.baseline.id &&
                        g.version === selected.baseline.version,
                    )
                  }
                  onClick={() => {
                    setAdoption({
                      comparison: selected,
                      index,
                      requestId: crypto.randomUUID(),
                    });
                    setConsent(false);
                  }}
                >
                  Review adoption {index + 1}
                </button>
              ))}
            </section>
          )}
          {adoption && (
            <section className="panel" aria-label="Adoption review">
              <h2 tabIndex={-1} data-step-title>
                Review the change to your goal
              </h2>
              <p>
                Change monthly contribution to{' '}
                {goalMinorToRupees(
                  adoption.comparison.alternatives[adoption.index]!
                    .monthlyMinor,
                )}{' '}
                rupees and horizon to{' '}
                {
                  adoption.comparison.alternatives[adoption.index]!
                    .horizonMonths
                }{' '}
                months. Other goal fields stay as recorded. Existing allocation
                plans will need review.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I confirm this change to my saved goal.
              </label>
              <button
                disabled={busy || !consent}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const saved = GoalAdoptionSchema.parse(
                      await request(`/${adoption.comparison.id}/adopt`, {
                        requestId: adoption.requestId,
                        alternativeIndex: adoption.index,
                        storageConsent: true,
                      }),
                    );
                    setReceipt(saved);
                    setData((old) =>
                      old
                        ? {
                            ...old,
                            adoptions: [
                              ...old.adoptions.filter(
                                (a) => a.requestId !== saved.requestId,
                              ),
                              saved,
                            ],
                          }
                        : old,
                    );
                    setAdoption(null);
                    setFresh(false);
                    setNotice(
                      'Adoption recorded. The receipt below is historical; reloading current goal state.',
                    );
                    await load();
                  } catch (e) {
                    failure(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Adopt alternative
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setAdoption(null)}
              >
                Cancel adoption
              </button>
            </section>
          )}
          {receipt && (
            <section className="panel" aria-label="Adoption receipt">
              <h2>Historical adoption receipt</h2>
              <p>
                Recorded goal edition {receipt.goal.version} at{' '}
                {new Date(receipt.adoptedAt).toLocaleString()}. This receipt
                does not assert the current goal edition.
              </p>
              <p>
                {money(receipt.goal.monthlyMinor)} monthly ·{' '}
                {receipt.goal.horizonMonths} months
              </p>
            </section>
          )}
          <section className="panel" aria-label="Adoption history">
            <h2>Adoption history</h2>
            {data.adoptions.map((a) => (
              <p key={a.requestId}>
                {a.goal.name} · goal edition {a.goal.version} · alternative{' '}
                {a.alternativeIndex + 1} ·{' '}
                {new Date(a.adoptedAt).toLocaleString()}
              </p>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
