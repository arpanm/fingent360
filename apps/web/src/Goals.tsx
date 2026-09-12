import { useEffect, useState } from 'react';
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
  const result: unknown = await response.json();
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
  const [goals, setGoals] = useState<SavedGoal[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<SavedGoal | null>(null);
  const [history, setHistory] = useState<SavedGoal[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () =>
    setGoals(SavedGoalsSchema.parse(await api()).goals);
  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Goal request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account" aria-labelledby="goals-title">
      <h2 id="goals-title">My saved goals</h2>
      <p>
        Private plans you enter, stored with your signed-in account.{' '}
        <a href="#account">Sign in or create an account</a>.
      </p>
      <p>
        Contribution-only illustration: saved amount + monthly contribution ×
        months. No investment growth, inflation, taxes, fees or withdrawals are
        assumed. Targets are nominal INR; this is not an investment
        recommendation or a promised outcome.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button disabled={busy} onClick={() => void action(reload)}>
        Reload goals
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void action(async () => {
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
            SavedGoalSchema.parse(
              await api(
                editing ? `/${editing.id}` : '',
                editing
                  ? { expectedVersion: editing.version, goal: input }
                  : input,
                editing ? 'PUT' : 'POST',
              ),
            );
            await reload();
            setForm(empty);
            setEditing(null);
            setConsent(false);
            setHistory([]);
            setMessage('Goal saved.');
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>
            {editing ? `Edit goal · revision ${editing.version}` : 'Add a goal'}
          </legend>
          <label>
            Goal name
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Goal type
            <select
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
          </label>
          <p>
            You can create several goals of the same type. Each is independent.
          </p>
          <label>
            Target amount (INR)
            <input
              required
              inputMode="decimal"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </label>
          <label>
            Already saved (INR)
            <input
              required
              inputMode="decimal"
              value={form.saved}
              onChange={(e) => setForm({ ...form, saved: e.target.value })}
            />
          </label>
          <label>
            Monthly contribution (INR)
            <input
              required
              inputMode="decimal"
              value={form.monthly}
              onChange={(e) => setForm({ ...form, monthly: e.target.value })}
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
              onChange={(e) => setForm({ ...form, months: e.target.value })}
            />
          </label>
          <p>
            Editable starting values: INR 0 saved, INR 0 monthly and 120 months.
            Assumption version: no-growth-nominal-v1. Editing saves a new
            revision; time alone does not reduce the entered horizon.
          </p>
          <label className="check-label">
            <input
              required
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I agree to store this goal and its revisions until account deletion.
          </label>
          <button type="submit">
            {editing ? 'Save goal changes' : 'Add saved goal'}
          </button>
          {editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditing(null);
                setForm(empty);
                setConsent(false);
              }}
            >
              Cancel edit
            </button>
          )}
        </fieldset>
      </form>
      <section aria-label="Saved goals">
        {goals.length === 0 && <p>No saved goals loaded.</p>}
        {goals.map((goal) => (
          <article
            className="card"
            key={goal.id}
            aria-label={`Goal ${goal.name}`}
          >
            <h3>{goal.name}</h3>
            <p>
              {goal.type} · revision {goal.version} · {goal.horizonMonths}{' '}
              months
            </p>
            <p>
              Target INR {goalMinorToRupees(goal.targetMinor)} · saved INR{' '}
              {goalMinorToRupees(goal.savedMinor)} · monthly INR{' '}
              {goalMinorToRupees(goal.monthlyMinor)}
            </p>
            <p>
              Contribution-only total INR{' '}
              {goalMinorToRupees(goal.projectedMinor)} · remaining gap INR{' '}
              {goalMinorToRupees(goal.gapMinor)}
            </p>
            <p>
              Entered by you; updated {goal.updatedAt}. Assumption{' '}
              {goal.assumptions}. Money is not allocated from any portfolio; do
              not count the same savings twice.
            </p>
            <button
              disabled={busy}
              onClick={() => {
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
                    await reload();
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
