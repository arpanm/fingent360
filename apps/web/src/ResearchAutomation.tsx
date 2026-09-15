import { ResearchAutoPublication } from './ResearchAutoPublication';
import { useEffect, useState } from 'react';
import {
  ResearchAutoStatusSchema,
  ReleaseCalendarSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function ResearchAutomation({
  request = json,
}: {
  request?: typeof json;
}) {
  const [state, setState] = useState<ReturnType<
    typeof ResearchAutoStatusSchema.parse
  > | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    setBusy(true);
    setError('');
    try {
      setState(
        ResearchAutoStatusSchema.parse(await request('/ops/research-auto')),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedules unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function save(
    sourceId: string,
    enabled: boolean,
    intervalMinutes: number,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setState(
        ResearchAutoStatusSchema.parse(
          await request(
            '/ops/research-auto',
            { sourceId, enabled, intervalMinutes },
            'PUT',
          ),
        ),
      );
      setNotice('Schedule saved. An already started capture may finish.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedule could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Automatic research">
      <h3>Keep research up to date</h3>
      <p>
        Enabled official sources are fetched automatically while the API runs.
        Raw evidence and new drafts are saved. Review and publish drafts to add
        them to Today and Stories. Pausing preserves saved research.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh research schedules
      </button>
      {busy && <p role="status">Updating research schedules…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state?.schedules.map((s) => (
        <article key={s.sourceId}>
          <h4>{s.sourceId}</h4>
          <p>
            {s.lastStatus} · Next check {new Date(s.nextAt).toLocaleString()}
          </p>
          <p>{s.message}</p>
          <label>
            Capture interval for {s.sourceId}
            <select
              disabled={busy}
              value={s.intervalMinutes}
              onChange={(e) =>
                void save(s.sourceId, s.enabled, Number(e.target.value))
              }
            >
              {[
                60,
                360,
                1440,
                10080,
                ...(![60, 360, 1440, 10080].includes(s.intervalMinutes)
                  ? [s.intervalMinutes]
                  : []),
              ].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() => void save(s.sourceId, !s.enabled, s.intervalMinutes)}
          >
            {s.enabled ? 'Pause' : 'Enable'} {s.sourceId}
          </button>
          {s.lastRunId && (
            <p>
              Capture receipt: <code>{s.lastRunId}</code>
            </p>
          )}
        </article>
      ))}
      <a href="#research-calendar">View release calendar</a>
      <ResearchAutoPublication request={request} />
    </section>
  );
}
export function ResearchCalendar() {
  const [state, setState] = useState<ReturnType<
      typeof ReleaseCalendarSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [edition, setEdition] = useState(''),
    [retry, setRetry] = useState(0);
  const [period, setPeriod] = useState('upcoming');
  const visible =
    state?.events.filter(
      (event) =>
        period === 'all' || event.scheduledAt >= new Date().toISOString(),
    ) ?? [];
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError('');
    void json(
      `/research-calendar${edition ? `?edition=${encodeURIComponent(edition)}` : ''}`,
      undefined,
      'GET',
      abort.signal,
    )
      .then((data) => {
        if (!abort.signal.aborted) setState(ReleaseCalendarSchema.parse(data));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Calendar unavailable.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [edition, retry]);
  return (
    <section aria-label="Release calendar">
      <h1>Coming releases</h1>
      <p>
        Official BEA scheduled times, shown in your time zone. A scheduled
        release is not confirmation that data was published. Saved editions are
        captures by this app, not original numerical data vintages.
      </p>
      {busy && <p role="status">Loading release calendar…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Retry calendar</button>
        </p>
      )}
      {!busy && !error && state && (
        <>
          <label>
            Calendar capture
            <select
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
            >
              <option value="">Latest saved capture</option>
              {state.editions.map((e) => (
                <option key={e.edition} value={e.edition}>
                  {new Date(e.retrievedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Release period
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="upcoming">Upcoming releases</option>
              <option value="all">All retained releases</option>
            </select>
          </label>
          <p>
            Retrieved:{' '}
            {state.retrievedAt
              ? new Date(state.retrievedAt).toLocaleString()
              : 'Not captured yet'}
          </p>
          <a href={state.sourceUrl} target="_blank" rel="noreferrer">
            Official BEA calendar
          </a>
          {state.events.length === 0 ? (
            <p>
              No saved calendar yet. Connected Operations can enable automatic
              research. Device mode requires a refreshed snapshot.
            </p>
          ) : visible.length === 0 ? (
            <p>
              No upcoming releases in this saved capture. Select all retained
              releases to inspect earlier schedules.
            </p>
          ) : (
            <ol>
              {visible.map((e) => (
                <li key={e.uid}>
                  <article>
                    <h2>{e.title}</h2>
                    <time dateTime={e.scheduledAt}>
                      {new Date(e.scheduledAt).toLocaleString()}
                    </time>
                    <p>
                      {e.cancelled ? 'Cancelled by source' : 'Scheduled'} ·
                      Source revision {e.sequence}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <a href="#today">Back to Today</a>
    </section>
  );
}
