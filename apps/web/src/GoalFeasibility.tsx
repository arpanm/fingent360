import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  GoalFeasibilitiesSchema,
  GoalFeasibilitySchema,
  GoalFeasibilityInputSchema,
  calculateGoalFeasibility,
  rupeesToGoalMinor,
  goalMinorToRupees,
  type SavedGoal,
  type GoalFeasibility as Assessment,
  type GoalFeasibilityInput,
} from '@fingent360/contracts';
import { useDraftGuard } from './useDraftGuard';

const amount = (value: string | null) =>
  value === null ? 'Unknown' : `INR ${goalMinorToRupees(value)}`;
function Summary({ value }: { value: Assessment['result'] }) {
  return (
    <dl>
      <dt>Assessment</dt>
      <dd>
        {value.status === 'unknown'
          ? 'Unknown: complete the missing assumptions'
          : value.status === 'shortfall'
            ? 'Shortfall under entered assumptions'
            : 'Within entered limits; not a guarantee'}
      </dd>
      <dt>Unchanged contribution-only total</dt>
      <dd>{amount(value.baselineProjectedMinor)}</dd>
      <dt>Downside total</dt>
      <dd>{amount(value.stressedProjectedMinor)}</dd>
      <dt>Downside target gap</dt>
      <dd>{amount(value.stressedGapMinor)}</dd>
      <dt>Monthly amount above your ceiling</dt>
      <dd>{amount(value.overBudgetMonthlyMinor)}</dd>
      <dt>Protected savings above entered savings</dt>
      <dd>{amount(value.reserveDeficitMinor)}</dd>
    </dl>
  );
}
class AssessmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export function GoalFeasibility({
  goals,
  onDenied,
}: {
  goals: SavedGoal[];
  onDenied: () => void;
}) {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false),
    [goalId, setGoalId] = useState('');
  const [budget, setBudget] = useState(''),
    [months, setMonths] = useState('');
  const [reserve, setReserve] = useState(''),
    [consent, setConsent] = useState(false);
  const [review, setReview] = useState<{
    goal: SavedGoal;
    input: GoalFeasibilityInput;
  } | null>(null);
  const [pending, setPending] = useState<{
    id: string;
    input: GoalFeasibilityInput;
  } | null>(null);
  const live = useRef(false),
    denied = useRef(false),
    generation = useRef(0);
  const epoch = useRef(0),
    operation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null),
    start = useRef<HTMLButtonElement>(null);
  useDraftGuard(
    open && !!(goalId || budget || months || reserve),
    'Discard your unsaved downside assessment?',
  );
  useLayoutEffect(() => {
    if (open) heading.current?.focus();
  }, [open, review]);

  async function request(path = '', method = 'GET', body?: unknown) {
    const session = epoch.current;
    const response = await fetch('/api/v1/account/goal-feasibility' + path, {
      method,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
    if (response.status === 401) {
      if (live.current && session === epoch.current) {
        denied.current = true;
        generation.current++;
        operation.current++;
        setRows([]);
        setReview(null);
        setPending(null);
        setOpen(false);
        onDenied();
      }
      throw new AssessmentError('Sign in again.', 401);
    }
    const data: unknown = await response.json().catch(() => {
      throw new AssessmentError(
        'Assessment response unreadable. Retry the same request.',
        response.status,
      );
    });
    if (!response.ok)
      throw new AssessmentError(
        typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'Assessment unavailable. Retry.',
        response.status,
      );
    return data;
  }
  async function load() {
    const ticket = ++generation.current;
    setReady(false);
    setLoading(true);
    setError('');
    try {
      const data = GoalFeasibilitiesSchema.parse(await request());
      if (live.current && !denied.current && ticket === generation.current) {
        setRows(data.assessments);
        setReady(true);
      }
    } catch (failure) {
      if (live.current && !denied.current && ticket === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Unable to load assessments.',
        );
    } finally {
      if (live.current && ticket === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    epoch.current++;
    void load();
    return () => {
      live.current = false;
      epoch.current++;
      generation.current++;
      operation.current++;
    };
  }, []);

  function cancel() {
    if (
      (budget || months || reserve) &&
      !window.confirm('Discard entered downside assumptions?')
    )
      return;
    operation.current++;
    setOpen(false);
    setReview(null);
    setPending(null);
    setConsent(false);
    start.current?.focus();
  }
  async function save() {
    if (!review || !consent || busy) return;
    const intent = pending ?? { id: crypto.randomUUID(), input: review.input };
    const ticket = ++operation.current;
    setPending(intent);
    setBusy(true);
    setError('');
    generation.current++;
    setLoading(false);
    try {
      const saved = GoalFeasibilitySchema.parse(
        await request('/' + intent.id, 'PUT', intent.input),
      );
      if (!live.current || denied.current || ticket !== operation.current)
        return;
      setRows((old) => [saved, ...old.filter((row) => row.id !== saved.id)]);
      setMessage(
        'Assessment saved. This is a dated receipt, not a current-goal guarantee.',
      );
      setOpen(false);
      setReview(null);
      setPending(null);
      setConsent(false);
      // A confirmed write does not claim that an earlier failed list was complete.
      start.current?.focus();
    } catch (failure) {
      if (live.current && !denied.current && ticket === operation.current) {
        if (
          failure instanceof AssessmentError &&
          [400, 404, 409, 410].includes(failure.status)
        )
          setPending(null);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Save unavailable. Retry.',
        );
      }
    } finally {
      if (live.current && ticket === operation.current) setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      !window.confirm(
        'Remove this saved assessment? A minimal deleted request marker remains until account deletion.',
      )
    )
      return;
    const ticket = ++operation.current;
    setBusy(true);
    generation.current++;
    try {
      await request('/' + id, 'DELETE');
      if (live.current && !denied.current && ticket === operation.current) {
        setRows((old) => old.filter((row) => row.id !== id));
        setMessage('Assessment removed.');
      }
    } catch (failure) {
      if (live.current && !denied.current && ticket === operation.current)
        setError(
          failure instanceof Error ? failure.message : 'Deletion unavailable.',
        );
    } finally {
      if (live.current && ticket === operation.current) setBusy(false);
    }
  }
  return (
    <section
      aria-label="Goal downside capacity"
      className="panel"
      data-feedback-private
    >
      <h2>Downside capacity</h2>
      <p>
        Check a goal against an affordable monthly ceiling, interrupted
        contributions and protected savings. These are your assumptions, not a
        risk score or advice. No market returns, inflation, probabilities or
        asset-sale values are estimated.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="page-actions">
        <button
          ref={start}
          disabled={open || busy || goals.length === 0}
          onClick={() => {
            setGoalId('');
            setBudget('');
            setMonths('');
            setReserve('');
            setReview(null);
            setConsent(false);
            setMessage('');
            setOpen(true);
          }}
        >
          Assess downside capacity
        </button>
        <button disabled={busy || open} onClick={() => void load()}>
          Reload assessments
        </button>
      </div>
      {!goals.length && <p>Save a goal first.</p>}
      {loading && !error && !rows.length && (
        <p role="status">Loading saved assessments…</p>
      )}
      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            try {
              const goal = goals.find((item) => item.id === goalId);
              if (!goal) throw Error('Choose a saved goal.');
              if (months.trim() && !/^(0|[1-9][0-9]*)$/.test(months.trim()))
                throw Error('Enter whole months or leave unknown.');
              const input = GoalFeasibilityInputSchema.parse({
                goalId,
                expectedVersion: goal.version,
                affordableMonthlyMinor: budget.trim()
                  ? rupeesToGoalMinor(budget.trim())
                  : null,
                interruptionMonths: months.trim() ? Number(months) : null,
                protectedSavingsMinor: reserve.trim()
                  ? rupeesToGoalMinor(reserve.trim())
                  : null,
                storageConsent: true,
              });
              calculateGoalFeasibility(goal, input);
              setReview({ goal, input });
              setConsent(false);
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : 'Check your assumptions.',
              );
            }
          }}
        >
          <h3 tabIndex={-1} ref={heading}>
            {review ? 'Review downside assessment' : 'Enter your assumptions'}
          </h3>
          {!review ? (
            <fieldset disabled={busy || !!pending}>
              <label htmlFor="capacity-goal">Saved goal</label>
              <select
                id="capacity-goal"
                value={goalId}
                onChange={(event) => setGoalId(event.target.value)}
              >
                <option value="">Choose a goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} · revision {goal.version}
                  </option>
                ))}
              </select>
              <p>
                Leave an input blank when unknown. Enter 0 explicitly for no
                interruption or no protected reserve.
              </p>
              <label htmlFor="capacity-budget">
                Affordable monthly ceiling (INR)
              </label>
              <input
                id="capacity-budget"
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
              <label htmlFor="capacity-months">
                Months without contributions
              </label>
              <input
                id="capacity-months"
                inputMode="numeric"
                value={months}
                onChange={(event) => setMonths(event.target.value)}
              />
              <label htmlFor="capacity-reserve">
                Protected part of entered savings (INR)
              </label>
              <input
                id="capacity-reserve"
                inputMode="decimal"
                value={reserve}
                onChange={(event) => setReserve(event.target.value)}
              />
              <button>Review downside assumptions</button>
            </fieldset>
          ) : (
            <>
              <p>
                {review.goal.name} · captured goal revision{' '}
                {review.goal.version}. No goal or allocation will change.
              </p>
              <Summary
                value={calculateGoalFeasibility(review.goal, review.input)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy || !!pending}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                Store these assumptions and this dated assessment in my account
              </label>
              <div className="page-actions">
                <button
                  type="button"
                  disabled={!consent || busy}
                  onClick={() => void save()}
                >
                  {pending ? 'Retry same assessment' : 'Save assessment'}
                </button>
                <button
                  type="button"
                  disabled={busy || !!pending}
                  onClick={() => setReview(null)}
                >
                  Back to assumptions
                </button>
              </div>
              <p>
                If the saved goal changed, use Reload goals above, then Back to
                assumptions and review again.
              </p>
            </>
          )}
          <button type="button" disabled={busy} onClick={cancel}>
            {pending ? 'Discard pending draft' : 'Cancel assessment'}
          </button>
        </form>
      )}
      <p>
        Up to 100 retained assessments. Remove an old receipt to make room;
        downloaded copies cannot be recalled.
      </p>
      {rows.map((row) => (
        <article className="panel" key={row.id}>
          <h3>{row.goal.name} · downside assessment</h3>
          <p>
            Saved {row.createdAt} · goal revision {row.goal.version} ·{' '}
            {row.policy}. Historical inputs; reload goals and create a new
            assessment after changes.
          </p>
          <details>
            <summary>View saved assumptions and result</summary>
            <p>
              Monthly ceiling {amount(row.input.affordableMonthlyMinor)};
              interruption {row.input.interruptionMonths ?? 'unknown'} months;
              protected savings {amount(row.input.protectedSavingsMinor)}.
            </p>
            <Summary value={row.result} />
          </details>
          <button disabled={busy || open} onClick={() => void remove(row.id)}>
            Remove assessment
          </button>
        </article>
      ))}
      {ready && !rows.length && <p>No saved downside assessments.</p>}
    </section>
  );
}
