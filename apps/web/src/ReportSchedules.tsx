import { completeScheduleExport } from './schedule-export';
import { saveDownload } from './runtime';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ReportSchedulesSchema,
  ScheduleConfigSchema,
  ScheduleReceiptSchema,
  type ReportSchedule,
  type ScheduleConfig,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { useDraftGuard } from './useDraftGuard';
class ScheduleRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const cadence = (config: ScheduleConfig) =>
  config.frequency === 'weekly'
    ? `Weekly on ${weekdays[config.weekday]}`
    : 'Daily';
const path = '/api/v1/account/report-schedules';
const blank = () => ({
  label: '',
  frequency: 'weekly' as const,
  time: '09:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekday: 1,
  policy: 'saved-record-review-v1' as const,
});
export function ReportSchedules() {
  const [data, setData] = useState<ReturnType<
      typeof ReportSchedulesSchema.parse
    > | null>(null),
    [gate, setGate] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<ScheduleConfig | null>(null),
    [editing, setEditing] = useState<ReportSchedule | null>(null),
    [review, setReview] = useState(false),
    [consent, setConsent] = useState(false),
    [editConflict, setEditConflict] = useState(false),
    [receipt, setReceipt] = useState<ReturnType<
      typeof ScheduleReceiptSchema.parse
    > | null>(null);
  const generation = useRef(0),
    pending = useRef<{ id: string; body: unknown } | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const baseline = useRef('');
  const dirty = !!form && JSON.stringify(form) !== baseline.current;
  const staleEdit =
    !!form &&
    !!editing &&
    (editConflict ||
      (ready &&
        data?.schedules.find((s) => s.id === editing.id)?.version !==
          editing.version));
  useDraftGuard(dirty, 'Discard this schedule draft?');
  useLayoutEffect(() => {
    if (form) formHeading.current?.focus();
  }, [review, !!form]);
  async function call(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      generation.current++;
      setData(null);
      setReceipt(null);
      setForm(null);
      setGate(true);
      setReady(false);
      throw new Error('Sign in again.');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not read the response. Retry.');
    }
    if (!response.ok)
      throw new ScheduleRequestError(
        response.status,
        body && typeof body === 'object' && 'message' in body
          ? String(body.message)
          : 'Request failed. Retry.',
      );
    return body;
  }
  async function load() {
    const run = ++generation.current;
    setReady(false);
    try {
      const value = ReportSchedulesSchema.parse(await call(path));
      if (run !== generation.current) return;
      setData(value);
      setReady(true);
      setGate(false);
      setError('');
    } catch (e) {
      if (run === generation.current)
        setError(e instanceof Error ? e.message : 'Could not load schedules.');
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);
  function start(old: ReportSchedule | null) {
    setEditConflict(false);
    setEditing(old);
    const initial = old?.config ?? blank();
    baseline.current = JSON.stringify(initial);
    setForm(initial);
    setReview(false);
    setConsent(false);
    pending.current = null;
    setError('');
  }
  async function mutate(
    old: ReportSchedule | null,
    action: 'save' | 'pause' | 'resume' | 'delete',
  ) {
    if (busy) return;
    setBusy(true);
    setReady(false);
    setError('');
    const operation = ++generation.current;
    try {
      const request = pending.current ?? {
        id: old?.id ?? crypto.randomUUID(),
        body: {
          requestId: crypto.randomUUID(),
          expectedVersion: old?.version ?? 0,
          action,
          ...(action === 'save' ? { config: form } : {}),
          consent: true,
        },
      };
      pending.current = request;
      const saved = ScheduleReceiptSchema.parse(
        await call(`${path}/${request.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        }),
      );
      if (operation !== generation.current) return;
      setReceipt(saved);
      setReady(false);
      setForm(null);
      setReview(false);
      pending.current = null;
      await load();
      heading.current?.focus();
    } catch (e) {
      if (
        e instanceof ScheduleRequestError &&
        e.status >= 400 &&
        e.status < 500
      ) {
        pending.current = null;
        if (e.status === 409 && old) {
          setEditConflict(true);
          setError(
            `${e.message} This draft still uses its original edition. Discard it and reload before reviewing a new edit.`,
          );
        } else
          setError(
            `${e.message} Reload current schedules before another change.`,
          );
      } else
        setError(
          e instanceof Error
            ? e.message
            : 'Could not save. Retry the same operation.',
        );
    } finally {
      setBusy(false);
    }
  }
  if (gate)
    return (
      <AccountGate
        next="report-schedules"
        title="Sign in to schedule saved-record reports"
      />
    );
  return (
    <section className="account" aria-label="Report schedules">
      <header className="page-header">
        <p className="page-kicker">Saved record reports</p>
        <h1 tabIndex={-1} ref={heading}>
          Report schedules
        </h1>
        <p>
          Choose when to capture your goals, holdings and allocations. Plain
          record reviews only: no research notes, prices, email or push.
        </p>
        <a href="#reports">Back to reports</a>
      </header>
      <p>
        Daily or weekly in your chosen timezone. After a missed run, only the
        latest due occurrence is captured with the actual capture time. A
        repeated clock time runs once; a missing time moves forward.
      </p>
      {data?.mode === 'device' && (
        <p role="note">
          On this device, schedules run only when you open schedules or reports.
          Nothing runs while the app is closed.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {data?.consent && (
        <p>
          Scheduled saved-record review purpose:{' '}
          <strong>{data.consent.status.replaceAll('-', ' ')}</strong>.{' '}
          <a href="#privacy">
            Review, renew or revoke in Privacy → Purpose consent
          </a>
          . A revoked or expired purpose blocks future captures; existing
          reports and pause/delete remain available.
        </p>
      )}
      {pending.current && (
        <div className="panel">
          <p>
            The previous change is unconfirmed. Retry its exact request, or
            dismiss it and reload before another action.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void mutate(editing, 'save')}
          >
            Retry the same change
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              pending.current = null;
              setForm(null);
              setReview(false);
              setReady(false);
              setError(
                'Unconfirmed retry dismissed. Reload schedules to reconcile current state.',
              );
            }}
          >
            Dismiss retry and reconcile
          </button>
        </div>
      )}
      <button type="button" disabled={busy} onClick={() => void load()}>
        Reload schedules
      </button>
      {!ready && (
        <p role="status">
          Current schedule state is unavailable until reload succeeds.
        </p>
      )}
      {receipt && (
        <p role="status">
          Saved change receipt: {receipt.schedule.config.label}, edition{' '}
          {receipt.schedule.version}.{' '}
          {ready
            ? 'Current schedules loaded below.'
            : 'This is historical; reload to confirm current state.'}
        </p>
      )}
      {staleEdit && (
        <div className="panel" role="alert">
          <p>
            This edit is based on an older schedule edition. Your draft is
            preserved for reference and cannot overwrite the newer
            configuration.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setForm(null);
              setEditing(null);
              setEditConflict(false);
              setReview(false);
              setConsent(false);
              pending.current = null;
              void load();
            }}
          >
            Discard stale draft and reload
          </button>
        </div>
      )}
      {!form && (
        <button
          type="button"
          disabled={!ready || busy || !!pending.current}
          onClick={() => start(null)}
        >
          New schedule
        </button>
      )}
      {form && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (staleEdit || !ready) {
              setError(
                'Reload current schedules and reconcile any stale edit before confirming.',
              );
              return;
            }
            const parsed = ScheduleConfigSchema.safeParse(form);
            if (!parsed.success) {
              setError('Check the label, time and Time zone.');
              return;
            }
            if (!review) {
              if (pending.current) {
                setError(
                  'Retry the same change or cancel this draft before making another change.',
                );
                return;
              }
              setReview(true);
              return;
            }
            if (pending.current) {
              setError(
                'Use Retry the same change to confirm the original operation.',
              );
              return;
            }
            if (consent) void mutate(editing, 'save');
          }}
        >
          <h2 ref={formHeading} tabIndex={-1}>
            {editing ? 'Edit schedule' : 'Create schedule'} ·{' '}
            {review ? 'Review' : 'Configure'}
          </h2>
          {!review ? (
            <div className="form-grid">
              <label htmlFor="schedule-label">Schedule label</label>
              <input
                id="schedule-label"
                value={form.label}
                required
                maxLength={80}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              <label htmlFor="schedule-frequency">Frequency</label>
              <select
                id="schedule-frequency"
                value={form.frequency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frequency: e.target.value as 'daily' | 'weekly',
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <label htmlFor="schedule-time">Local time</label>
              <input
                id="schedule-time"
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <label htmlFor="schedule-zone">Time zone</label>
              <input
                id="schedule-zone"
                list="schedule-zones"
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
              <datalist id="schedule-zones">
                {Intl.supportedValuesOf('timeZone').map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
              <p>
                Your device time zone is suggested. Search a city such as
                Kolkata or London; the stored zone follows local clock changes.
              </p>
              {form.frequency === 'weekly' && (
                <>
                  <label htmlFor="schedule-day">Day of week</label>
                  <select
                    id="schedule-day"
                    value={form.weekday}
                    onChange={(e) =>
                      setForm({ ...form, weekday: Number(e.target.value) })
                    }
                  >
                    {weekdays.map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          ) : (
            <>
              <p>
                {form.label}: {cadence(form)} at {form.time} ({form.timezone}).
                Only future occurrences are scheduled after save.
              </p>
              <p>
                Each report stores your actual saved goals, holdings and
                allocations at capture time. It excludes research notes.
                Existing reports remain if you pause or delete this schedule.
                Confirming the first active schedule records the scheduled
                saved-record review purpose with no expiry. You can choose an
                expiry or revoke it in Privacy → Purpose consent. An expired or
                revoked purpose must be renewed there before enabling this
                schedule again.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I opt in to these recurring private snapshots.
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Back to configuration
              </button>
            </>
          )}
          <button
            disabled={busy || !ready || staleEdit || (review && !consent)}
          >
            {review ? 'Confirm schedule' : 'Review schedule'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm('Discard this schedule draft?')) {
                setForm(null);
                pending.current = null;
                heading.current?.focus();
              }
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {!data?.schedules.length && ready && (
        <p className="empty-state">
          No schedules yet. Create one when you want recurring record reviews.
        </p>
      )}
      {data?.schedules.map((schedule) => (
        <article className="panel" key={schedule.id}>
          <h2>{schedule.config.label}</h2>
          <p>
            {schedule.status} · edition {schedule.version} ·{' '}
            {cadence(schedule.config)} {schedule.config.time}{' '}
            {schedule.config.timezone}
          </p>
          <p>
            Next:{' '}
            {schedule.nextDueAt
              ? `${new Date(schedule.nextDueAt).toLocaleString(undefined, { timeZone: schedule.config.timezone })} (${schedule.config.timezone})`
              : 'Not scheduled'}
          </p>
          <p>{schedule.message}</p>
          {schedule.status !== 'deleted' && (
            <div className="page-actions">
              <button
                disabled={!ready || busy || !!form || !!pending.current}
                onClick={() => start(schedule)}
              >
                Edit
              </button>
              <button
                disabled={!ready || busy || !!form || !!pending.current}
                onClick={() => {
                  if (
                    window.confirm(
                      `${schedule.status === 'active' ? 'Pause' : 'Resume'} this schedule? Existing reports remain.`,
                    )
                  )
                    void mutate(
                      schedule,
                      schedule.status === 'active' ? 'pause' : 'resume',
                    );
                }}
              >
                {schedule.status === 'active' ? 'Pause' : 'Resume'}
              </button>
              <button
                disabled={!ready || busy || !!form || !!pending.current}
                onClick={() => {
                  if (
                    window.confirm(
                      'Delete this schedule? Existing reports remain; future captures stop.',
                    )
                  )
                    void mutate(schedule, 'delete');
                }}
              >
                Delete schedule
              </button>
            </div>
          )}
        </article>
      ))}
      <h2>Occurrence history</h2>
      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => {
          setBusy(true);
          void (async () => {
            try {
              const ticket = generation.current;
              const complete = await completeScheduleExport(
                await call(`${path}/export`),
                (suffix) => call(`/api/v1/account${suffix}`),
                () => generation.current === ticket,
              );
              await saveDownload(
                new Blob([JSON.stringify(complete, null, 2)], {
                  type: 'application/json',
                }),
                'fingent360-schedules.json',
                'Schedule history downloaded.',
              );
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'Export failed. No partial file downloaded.',
              );
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Download complete schedule history
      </button>
      <p>
        Showing up to 100 recent outcomes. Full immutable history is retained;
        report capacity can skip a capture without disabling your schedule.
      </p>
      {data?.occurrences.map((o) => (
        <article key={o.id} className="panel">
          <p>
            Schedule {o.scheduleId} · edition {o.scheduleVersion}
          </p>
          <p>
            {o.status} · due {new Date(o.dueAt).toLocaleString()} · handled{' '}
            {new Date(o.capturedAt).toLocaleString()} (
            {Intl.DateTimeFormat().resolvedOptions().timeZone})
          </p>
          <p>
            {o.message} Earlier missed occurrences: {o.skipped}.
          </p>
          {o.reportId && (
            <a href={`#reports?selected=${o.reportId}`}>Open report</a>
          )}
        </article>
      ))}
    </section>
  );
}
