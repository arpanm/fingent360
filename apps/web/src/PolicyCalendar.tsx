import { useEffect, useState } from 'react';
import { PolicyCalendarSchema } from '@fingent360/contracts';
import { json } from './net';

export function PolicyCalendar() {
  const [state, setState] = useState<ReturnType<
    typeof PolicyCalendarSchema.parse
  > | null>(null);
  const [edition, setEdition] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0),
    [period, setPeriod] = useState('upcoming');
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError('');
    setState(null);
    void json(
      `/research-calendar/policy${edition ? `?edition=${encodeURIComponent(edition)}` : ''}`,
      undefined,
      'GET',
      abort.signal,
    )
      .then((data) => {
        if (!abort.signal.aborted) setState(PolicyCalendarSchema.parse(data));
      })
      .catch((reason) => {
        if (!abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Policy calendar unavailable.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [edition, retry]);
  const today = new Date().toISOString().slice(0, 10);
  const visible =
    state?.meetings.filter(
      (meeting) => period === 'all' || meeting.endOn >= today,
    ) ?? [];
  return (
    <section aria-label="FOMC policy calendar">
      <h2>US policy meetings</h2>
      <p>
        Official FOMC meeting days. Exact announcement times are not supplied by
        this calendar. A statement link means the source linked a statement when
        captured; it does not verify the decision or its numerical values.
      </p>
      {busy && <p role="status">Loading policy calendar…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry policy calendar
          </button>
        </p>
      )}
      {!busy && !error && state && (
        <>
          <label>
            Policy calendar capture
            <select
              value={edition}
              onChange={(event) => setEdition(event.target.value)}
            >
              <option value="">Latest saved capture</option>
              {state.editions.map((capture) => (
                <option key={capture.edition} value={capture.edition}>
                  {new Date(capture.retrievedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Policy meeting period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="upcoming">Upcoming meetings</option>
              <option value="all">All retained meetings</option>
            </select>
          </label>
          <p>
            Known to this app:{' '}
            {state.retrievedAt
              ? new Date(state.retrievedAt).toLocaleString()
              : 'Not captured yet'}
            . Historical captures are not original publication timestamps.
          </p>
          <a href={state.sourceUrl} target="_blank" rel="noreferrer">
            Official Federal Reserve Board calendar
          </a>
          {!state.meetings.length ? (
            <p>
              No saved policy calendar. Enable FOMC calendar in Operations
              automatic research, then refresh the device snapshot for offline
              reading.
            </p>
          ) : !visible.length ? (
            <p>
              No upcoming meetings in this capture. Choose all retained meetings
              or refresh the capture through Operations.
            </p>
          ) : (
            <ol>
              {visible.map((meeting) => (
                <li key={meeting.id}>
                  <article>
                    <h3>
                      {meeting.kind === 'notation-vote'
                        ? 'FOMC notation vote'
                        : 'FOMC meeting'}
                    </h3>
                    <p>
                      <time dateTime={meeting.startOn}>{meeting.startOn}</time>
                      {meeting.endOn !== meeting.startOn && (
                        <>
                          {' '}
                          to{' '}
                          <time dateTime={meeting.endOn}>{meeting.endOn}</time>
                        </>
                      )}{' '}
                      · Day precision
                    </p>
                    <p>
                      {meeting.status === 'statement-linked'
                        ? 'Statement linked in this capture'
                        : 'Scheduled; no statement link retained'}
                      {meeting.projectionsScheduled
                        ? ' · Projections scheduled'
                        : ''}
                    </p>
                    {meeting.statementUrl && (
                      <a
                        href={meeting.statementUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read original policy statement
                      </a>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
