import { useEffect, useState } from 'react';
import { RbiCalendarSchema } from '@fingent360/contracts';
import { json } from './net';
export function RbiCalendar() {
  const [state, setState] = useState<ReturnType<
      typeof RbiCalendarSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [edition, setEdition] = useState(''),
    [retry, setRetry] = useState(0),
    [all, setAll] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError('');
    setState(null);
    void json(
      `/research-calendar/rbi${edition ? `?edition=${edition}` : ''}`,
      undefined,
      'GET',
      abort.signal,
    )
      .then((v) => {
        if (!abort.signal.aborted) setState(RbiCalendarSchema.parse(v));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'RBI calendar unavailable.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [edition, retry]);
  const today = new Date().toISOString().slice(0, 10),
    meetings =
      state?.data?.meetings.filter((m) => all || m.endOn >= today) ?? [];
  return (
    <section aria-label="RBI policy calendar">
      <h2>India policy meetings</h2>
      <p>
        RBI MPC meeting days for 2026–27. No decision time, outcome or other RBI
        release schedule is inferred.
      </p>
      {busy && <p role="status">Loading RBI calendar…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry RBI calendar
          </button>
        </p>
      )}
      {!busy && !error && state && (
        <>
          {!state.data ? (
            <p>
              No permitted RBI schedule captured. Operations can record source
              permission and enable acquisition.
            </p>
          ) : (
            <>
              <label>
                RBI calendar capture
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
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => setAll(e.target.checked)}
                />
                Include earlier RBI meetings
              </label>
              <p>
                Original schedule date: {state.data.publishedOn}. Captured:{' '}
                {state.retrievedAt}. Original decision publication time is not
                supplied.
              </p>
              <a href={state.sourceUrl} target="_blank" rel="noreferrer">
                Original RBI meeting schedule
              </a>
              {!meetings.length ? (
                <p>
                  No upcoming meetings in this saved fiscal-year schedule. Check
                  for a newly permitted source edition.
                </p>
              ) : (
                <ol>
                  {meetings.map((m) => (
                    <li key={m.startOn}>
                      <h3>MPC meeting</h3>
                      <p>
                        <time dateTime={m.startOn}>{m.startOn}</time> to{' '}
                        <time dateTime={m.endOn}>{m.endOn}</time> · Day
                        precision · Scheduled
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p>
                Saved captures show what was available to this app then. Offline
                cannot know later changes until a new snapshot is installed.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
