import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AccountGate } from './AccountGate';
import { Assist } from './Assist';
import { useDraftGuard } from './useDraftGuard';
import { SmartHelp } from './SmartHelp';
import { money } from './ui';
import {
  AccountActionSchema,
  SavedGoalsSchema,
  SavedGoalSchema,
  SavedGoalInputSchema,
  SavedGoalHistorySchema,
  goalMinorToRupees,
  rupeesToGoalMinor,
  type SavedGoal,
  type SavedGoalInput,
} from '@fingent360/contracts';
class SignInRequired extends Error {}
async function api(
  path = '',
  body?: unknown,
  method = 'GET',
): Promise<unknown> {
  const response = await fetch(`/api/v1/account/goals${path}`, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (response.status === 401)
    throw new SignInRequired('Please sign in again.');
  const result: unknown = await response.json().catch(() => {
    throw new Error(
      'Goal service returned an unreadable response. Please retry.',
    );
  });
  if (!response.ok)
    throw new Error(
      typeof result === 'object' && result && 'message' in result
        ? String(result.message)
        : 'Goal request failed.',
    );
  return result;
}
const empty = {
  name: '',
  type: 'education' as SavedGoalInput['type'],
  target: '',
  saved: '0.00',
  monthly: '0.00',
  months: '120',
};
export function Goals() {
  const goalTypeId = useId();
  const editor = useRef<HTMLDivElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const focusEditor = useRef(false);
  const focusReturn = useRef(false);
  const baseline = useRef(empty);
  const [step, setStep] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState<SavedGoal[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<SavedGoal | null>(null);
  const [history, setHistory] = useState<SavedGoal[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  function failure(e: unknown) {
    if (e instanceof SignInRequired) {
      setSignedOut(true);
      setGoals([]);
      setHistory([]);
      setLoaded(false);
      setShowEditor(false);
      setForm(empty);
      setEditing(null);
      setConsent(false);
      setError('');
    } else setError(e instanceof Error ? e.message : 'Goal request failed.');
  }
  useDraftGuard(
    showEditor && JSON.stringify(form) !== JSON.stringify(baseline.current),
    'Leave this page and discard your unsaved goal changes?',
  );
  const reload = async (active: () => boolean = () => true) => {
    const result = SavedGoalsSchema.parse(await api());
    if (!active()) return;
    setGoals(result.goals);
    setLoaded(true);
  };
  const openEditor = () => {
    setStep(0);
    focusEditor.current = true;
    setShowEditor(true);
  };
  // Place focus before paint; a delayed animation-frame focus can interrupt
  // typing into another field on a fast interaction or a slow device.
  useLayoutEffect(() => {
    if (showEditor && focusEditor.current) {
      editor.current?.scrollIntoView({ block: 'start' });
      editor.current?.querySelector('input')?.focus({ preventScroll: true });
      focusEditor.current = false;
      focusReturn.current = false;
    } else if (!showEditor && !busy && focusReturn.current) {
      createButton.current?.focus({ preventScroll: true });
      focusReturn.current = false;
    }
  });
  // Step focus is part of the DOM commit, before another field can receive
  // input. Never queue it behind user typing in an animation callback.
  useLayoutEffect(() => {
    if (showEditor) {
      const target = editor.current?.querySelector<
        HTMLInputElement | HTMLButtonElement
      >('input,button');
      target?.focus({ preventScroll: true });
    }
  }, [step, showEditor]);
  const canDiscard = () =>
    !showEditor ||
    JSON.stringify(form) === JSON.stringify(baseline.current) ||
    window.confirm('Discard your unsaved goal changes?');
  const closeEditor = () => {
    baseline.current = empty;
    setShowEditor(false);
    setEditing(null);
    setForm(empty);
    setConsent(false);
    focusReturn.current = true;
  };
  useEffect(() => {
    let active = true;
    void reload(() => active).catch((error: unknown) => {
      if (active) failure(error);
    });
    return () => {
      active = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  if (signedOut)
    return (
      <section>
        <div className="page-header">
          <h1>My goals</h1>
        </div>
        <AccountGate
          next="my-goals"
          title="Save the goals that matter to you"
        />
      </section>
    );
  return (
    <section className="account" aria-label="My saved goals">
      <header className="page-header">
        <div>
          <p className="page-kicker">YOUR PLANS</p>
          <h1 id="goals-title">Make room for what matters</h1>
          <p>
            <a href="#allocations">Connect holdings to goals</a>. Goal changes
            may require reviewing an existing allocation plan.
          </p>
          <p className="page-description">
            Give each goal a name, a target and a monthly contribution. Keep
            your plans together and see what your own savings could cover.
          </p>
        </div>
        <div className="page-actions">
          <button
            ref={createButton}
            disabled={busy || !loaded}
            onClick={() => {
              if (!canDiscard()) return;
              baseline.current = empty;
              closeEditor();
              openEditor();
            }}
          >
            Create a goal
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              if (canDiscard())
                void action(async () => {
                  await reload();
                  closeEditor();
                });
            }}
          >
            Reload goals
          </button>
        </div>
      </header>
      {error && <p role="alert">{error} </p>}
      {message && <p role="status">{message}</p>}
      <div className="section-heading">
        <p>
          <strong>{loaded ? goals.length : '—'}</strong> active goals
        </p>
        <p className="muted">
          Plans based on your savings and contributions. No assumed investment
          returns.
        </p>
      </div>
      {!loaded && !error && <p role="status">Loading your goals…</p>}
      {loaded && goals.length === 0 && !showEditor && (
        <div className="empty-state">
          <h3>What would you like to save for?</h3>
          <p>
            Education, a home or a financial cushion: create a separate plan for
            each. You can have more than one goal of the same kind.
          </p>
          <button onClick={openEditor}>Add your first goal</button>
        </div>
      )}
      {showEditor && (
        <div ref={editor} className="panel goal-editor">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                if (step < 3) {
                  if (step === 1) {
                    if (BigInt(rupeesToGoalMinor(form.target)) <= 0n)
                      throw new Error('Enter a target greater than zero.');
                    rupeesToGoalMinor(form.saved);
                  }
                  if (step === 2) rupeesToGoalMinor(form.monthly);
                  setStep(step + 1);
                  return;
                }
                const input = SavedGoalInputSchema.parse({
                  name: form.name,
                  type: form.type,
                  targetMinor: rupeesToGoalMinor(form.target),
                  savedMinor: rupeesToGoalMinor(form.saved),
                  monthlyMinor: rupeesToGoalMinor(form.monthly),
                  horizonMonths: Number(form.months),
                  currency: 'INR',
                  scale: 2,
                  assumptions: 'no-growth-nominal-v1',
                  storageConsent: consent,
                });
                const savedGoal = SavedGoalSchema.parse(
                  await api(
                    editing ? `/${editing.id}` : '',
                    editing
                      ? { expectedVersion: editing.version, goal: input }
                      : input,
                    editing ? 'PUT' : 'POST',
                  ),
                );
                // The write response is authoritative: a subsequent read failure
                // must not leave a successful create available for resubmission.
                setGoals((current) => [
                  ...current.filter((goal) => goal.id !== savedGoal.id),
                  savedGoal,
                ]);
                setForm(empty);
                setEditing(null);
                setConsent(false);
                setHistory([]);
                setMessage('Goal saved.');
                setShowEditor(false);
                focusReturn.current = true;
              });
            }}
          >
            <fieldset disabled={busy || !loaded}>
              <legend>
                {editing ? `Edit ${editing.name}` : 'Build your goal'}
              </legend>
              <p className="muted">
                Start with what you know. You can change these amounts and your
                timeline later.
              </p>
              <p className="badge">
                Step {step + 1} of 4 ·{' '}
                {
                  ['Your goal', 'Your amounts', 'Your plan', 'Review and save'][
                    step
                  ]
                }
              </p>
              <div className="form-grid">
                {step === 0 && (
                  <>
                    <label>
                      Goal name
                      <input
                        required
                        maxLength={100}
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </label>
                    <div className="field">
                      <label htmlFor={goalTypeId}>Goal type</label>
                      <select
                        id={goalTypeId}
                        value={form.type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            type: e.target.value as SavedGoalInput['type'],
                          })
                        }
                      >
                        {[
                          'education',
                          'retirement',
                          'purchase',
                          'emergency',
                          'other',
                        ].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label>
                      Target amount (INR)
                      <input
                        required
                        inputMode="decimal"
                        value={form.target}
                        onChange={(e) =>
                          setForm({ ...form, target: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Already saved (INR)
                      <input
                        required
                        inputMode="decimal"
                        value={form.saved}
                        onChange={(e) =>
                          setForm({ ...form, saved: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label>
                      Monthly contribution (INR)
                      <input
                        required
                        inputMode="decimal"
                        value={form.monthly}
                        onChange={(e) =>
                          setForm({ ...form, monthly: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Months from this plan
                      <input
                        required
                        type="number"
                        min="1"
                        max="1200"
                        value={form.months}
                        onChange={(e) =>
                          setForm({ ...form, months: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {step === 2 && (
                <Assist
                  kind="goal"
                  onApply={(suggestion) => {
                    if (suggestion.kind === 'goal') {
                      setForm({
                        ...form,
                        monthly: goalMinorToRupees(
                          suggestion.values.monthlyMinor,
                        ),
                        months: String(suggestion.values.horizonMonths),
                      });
                      setMessage(
                        'Previous contribution and timeline applied. Review them for this goal.',
                      );
                    }
                  }}
                />
              )}
              {step === 3 && (
                <section aria-label="Goal review">
                  <h3>{form.name}</h3>
                  <p>
                    {form.type} · target INR {form.target} · already saved INR{' '}
                    {form.saved}
                  </p>
                  <p>
                    INR {form.monthly} monthly for {form.months} months
                  </p>
                  <p>
                    Contribution-only total INR{' '}
                    {goalMinorToRupees(
                      (
                        BigInt(rupeesToGoalMinor(form.saved)) +
                        BigInt(rupeesToGoalMinor(form.monthly)) *
                          BigInt(form.months)
                      ).toString(),
                    )}
                    . These amounts are not verified account balances or
                    promised returns.
                  </p>
                </section>
              )}
              <p className="muted">
                Starts with ₹0 saved, ₹0 monthly and 120 months. Change these to
                match your plan. This calculation includes only your entered
                savings and contributions, with no investment returns, inflation
                or costs.
              </p>
              {step === 3 && (
                <label className="check-label">
                  <input
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I agree to store this goal and its revisions until account
                  deletion.
                </label>
              )}
              <button type="submit">
                {step < 3
                  ? ['Next: amounts', 'Next: contributions', 'Review goal'][
                      step
                    ]
                  : editing
                    ? 'Save goal changes'
                    : 'Add saved goal'}
              </button>
              {step > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setStep(step - 1)}
                >
                  Back a step
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (canDiscard()) closeEditor();
                }}
              >
                {editing ? 'Cancel edit' : 'Cancel goal'}
              </button>
            </fieldset>
          </form>
          {step === 0 && (
            <SmartHelp
              scope="goals"
              onApplyName={(name) => setForm({ ...form, name })}
            />
          )}
        </div>
      )}
      <section aria-label="Saved goals" className="goal-grid">
        {goals.map((goal) => (
          <article
            className="card"
            key={goal.id}
            aria-label={`Goal ${goal.name}`}
          >
            <div className="section-heading">
              <h3>{goal.name}</h3>
              <span className="badge">{goal.type}</span>
            </div>
            <p className="muted">
              {goal.horizonMonths} months · {money(goal.monthlyMinor)} monthly ·
              revision {goal.version}
            </p>
            <p>
              <strong>{money(goal.savedMinor)}</strong> saved of{' '}
              {money(goal.targetMinor)}
            </p>
            <progress
              aria-label={`Saved progress for ${goal.name}`}
              max={100}
              value={Number(
                (BigInt(goal.savedMinor) * 100n) / BigInt(goal.targetMinor) >
                  100n
                  ? 100n
                  : (BigInt(goal.savedMinor) * 100n) / BigInt(goal.targetMinor),
              )}
            />
            <dl className="goal-figures">
              <div>
                <dt>Contribution-only total</dt>
                <dd>{money(goal.projectedMinor)}</dd>
              </div>
              <div>
                <dt>Remaining gap</dt>
                <dd>{money(goal.gapMinor)}</dd>
              </div>
            </dl>
            <p className="muted">
              {BigInt(goal.gapMinor) > 0n
                ? 'Your planned contributions leave a gap. You can edit the target, timeline or contribution to explore a different plan.'
                : 'Your entered savings and planned contributions cover this target before inflation and costs.'}
            </p>
            <button
              disabled={busy}
              onClick={() => {
                if (!canDiscard()) return;
                baseline.current = {
                  name: goal.name,
                  type: goal.type,
                  target: goalMinorToRupees(goal.targetMinor),
                  saved: goalMinorToRupees(goal.savedMinor),
                  monthly: goalMinorToRupees(goal.monthlyMinor),
                  months: String(goal.horizonMonths),
                };
                openEditor();
                setEditing(goal);
                setForm({
                  name: goal.name,
                  type: goal.type,
                  target: goalMinorToRupees(goal.targetMinor),
                  saved: goalMinorToRupees(goal.savedMinor),
                  monthly: goalMinorToRupees(goal.monthlyMinor),
                  months: String(goal.horizonMonths),
                });
                setConsent(false);
              }}
            >
              Edit goal
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void action(async () =>
                  setHistory(
                    SavedGoalHistorySchema.parse(
                      await api(`/${goal.id}/history`),
                    ).revisions,
                  ),
                )
              }
            >
              View revisions
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${goal.name} from active goals? Its revisions remain until account deletion.`,
                  )
                )
                  void action(async () => {
                    AccountActionSchema.parse(
                      await api(
                        `/${goal.id}`,
                        { expectedVersion: goal.version },
                        'DELETE',
                      ),
                    );
                    setGoals((current) =>
                      current.filter((item) => item.id !== goal.id),
                    );
                    setHistory([]);
                    if (editing?.id === goal.id) {
                      setEditing(null);
                      setForm(empty);
                      setConsent(false);
                    }
                    setMessage('Goal removed.');
                  });
              }}
            >
              Remove goal
            </button>
          </article>
        ))}
      </section>
      <aside className="panel">
        <h3>What this plan means</h3>
        <p>
          We add the amount already saved to your monthly contribution
          multiplied by the months you enter. There is no assumed investment
          growth, inflation, tax, fee or withdrawal. Progress reflects your
          entered savings, not a live account balance. Keep each goal’s savings
          separate so you do not count the same money twice.
        </p>
        <p className="muted">
          Your amounts stay fixed until you edit them. This is a planning
          illustration, not an investment recommendation or promised outcome.
        </p>
      </aside>
      {history.length > 0 && (
        <section aria-label="Goal revisions">
          <h3>Goal revisions</h3>
          {history.map((goal) => (
            <p key={goal.version}>
              {goal.name} · revision {goal.version} · target INR{' '}
              {goalMinorToRupees(goal.targetMinor)} · saved INR{' '}
              {goalMinorToRupees(goal.savedMinor)} · monthly INR{' '}
              {goalMinorToRupees(goal.monthlyMinor)} · {goal.horizonMonths}{' '}
              months · {goal.assumptions} · saved {goal.updatedAt}
            </p>
          ))}
        </section>
      )}
    </section>
  );
}
