import { CpiExpectations } from './CpiExpectations';
import { RbiCalendar } from './RbiCalendar';
import { GdpVintages } from './GdpVintages';
import { PolicyCalendar } from './PolicyCalendar';
import { ResearchAutoPublication } from './ResearchAutoPublication';
import { useEffect, useRef, useState } from 'react';
import {
  ResearchAutoStatusSchema,
  ReleaseCalendarSchema,
  CalendarSourceSchema,
  calendarSources,
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
  const [rightsEvidence, setRightsEvidence] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const loadGeneration = useRef(0);
  async function load() {
    const generation = ++loadGeneration.current;
    setBusy(true);
    setError('');
    try {
      const next = ResearchAutoStatusSchema.parse(
        await request('/ops/research-auto'),
      );
      if (generation === loadGeneration.current) setState(next);
    } catch (e) {
      if (generation === loadGeneration.current)
        setError(e instanceof Error ? e.message : 'Schedules unavailable.');
    } finally {
      if (generation === loadGeneration.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current++;
    };
  }, []);
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
            {
              sourceId,
              enabled,
              intervalMinutes,
              ...((sourceId === 'rbi-mpc-calendar' ||
                sourceId === 'commodity-benchmarks' ||
                sourceId === 'india-gdp') &&
              enabled
                ? { rightsEvidence: rightsEvidence[sourceId] ?? '' }
                : {}),
            },
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
          {s.sourceId === 'equity-filing-discovery' && (
            <p>
              Capture the official new-release RSS into Filing discovery.
              Discovered links require original-document access and exact
              identity mapping before financial publication; they are not
              verified accounts.
            </p>
          )}
          {s.sourceId === 'equity-filing-watch' && (
            <p>
              Watch only the fixed registered original filings selected in
              Original filing watch. Changed originals become drafts or
              quarantine; this does not discover new release URLs.
            </p>
          )}
          {s.sourceId === 'eia-daily-spot' && (
            <p>
              Enable the separate contributor-permission control in Daily oil
              source before scheduling. Captures remain drafts for independent
              review.
            </p>
          )}
          {s.sourceId === 'india-gdp' && (
            <label>
              PIB and MoSPI GDP source permission evidence
              <textarea
                value={rightsEvidence[s.sourceId] ?? ''}
                onChange={(event) =>
                  setRightsEvidence((previous) => ({
                    ...previous,
                    [s.sourceId]: event.target.value,
                  }))
                }
                maxLength={2000}
              />
              <span>
                Checks the verified current-day release index; missed-day
                releases require a separate original capture. New captures stay
                drafts until independent review.
              </span>
            </label>
          )}
          {s.sourceId === 'commodity-benchmarks' && (
            <label>
              Commodity dataset attribution and retention/display/offline
              evidence
              <textarea
                value={rightsEvidence[s.sourceId] ?? ''}
                onChange={(event) =>
                  setRightsEvidence((previous) => ({
                    ...previous,
                    [s.sourceId]: event.target.value,
                  }))
                }
                maxLength={2000}
              />
              <span>
                Automatic capture creates drafts or quarantine only; a different
                named reviewer publishes. Defaults disabled.
              </span>
            </label>
          )}
          {s.sourceId === 'rbi-mpc-calendar' && (
            <label>
              RBI permission evidence for caching, display, internal links and
              offline distribution
              <textarea
                value={rightsEvidence[s.sourceId] ?? ''}
                onChange={(e) =>
                  setRightsEvidence((previous) => ({
                    ...previous,
                    [s.sourceId]: e.target.value,
                  }))
                }
                maxLength={2000}
              />
              <span>
                Enter the actual permission reference before enabling or
                changing an enabled interval. Public access alone does not
                provide these rights. Pause stops future acquisition; saved
                captures remain.
              </span>
            </label>
          )}
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
  const [source, setSource] = useState<'bea-calendar' | 'bls-calendar'>(
    'bea-calendar',
  );
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
      `/research-calendar?source=${source}${edition ? `&edition=${encodeURIComponent(edition)}` : ''}`,
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
  }, [edition, retry, source]);
  return (
    <section aria-label="Release calendar">
      <h1>Coming releases</h1>
      <PolicyCalendar />
      <RbiCalendar />
      <GdpVintages />
      <CpiExpectations />
      <p>
        Official BEA and BLS scheduled times, shown in your time zone. A
        scheduled release is not confirmation that data was published. Saved
        editions are captures by this app, not original numerical data vintages.
      </p>
      <label>
        Calendar source
        <select
          value={source}
          onChange={(event) => {
            setSource(CalendarSourceSchema.parse(event.target.value));
            setEdition('');
          }}
        >
          <option value="bea-calendar">BEA — economic output and income</option>
          <option value="bls-calendar">BLS — jobs, inflation and labour</option>
        </select>
      </label>
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
            Official {calendarSources[state.sourceId].name} calendar
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
