import { DeploymentMonitoring } from './DeploymentMonitoring';
import { useEffect, useRef, useState } from 'react';
import {
  OperationalQualitySchema,
  type OperationalQuality as Overview,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function QualityOverview({
  onSessionExpired,
  onPublishing,
}: {
  onSessionExpired: () => void;
  onPublishing: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const live = useRef(false),
    generation = useRef(0);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  async function load() {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setData(null);
    try {
      const value = OperationalQualitySchema.parse(await json('/ops/quality'));
      if (live.current && ticket === generation.current) setData(value);
    } catch (cause) {
      if (!live.current) return;
      if (cause instanceof RequestError && cause.status === 401) {
        generation.current++;
        setData(null);
        expired.current();
      } else if (ticket === generation.current) {
        setError(
          'Quality overview unavailable. Retry to read the current state.',
        );
      }
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  return (
    <section aria-label="Data quality" className="panel">
      <h2>Data quality</h2>
      <DeploymentMonitoring onSessionExpired={onSessionExpired} />
      <p>
        Current stored reading-publication heads. Numerical datasets have their
        own source review/history. These checks describe completeness and
        retrieval age; they do not establish that a source is true or that
        markets are current.
      </p>
      <div className="page-actions unobscured-actions">
        <button disabled={busy} onClick={() => void load()}>
          {error ? 'Retry quality overview' : 'Refresh quality overview'}
        </button>
        <button onClick={onPublishing}>Open publishing review</button>
      </div>
      {busy && <p role="status">Reading current quality…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Observed {new Date(data.observedAt).toLocaleString()}.{' '}
            {data.inspected} heads inspected
            {data.moreAvailable
              ? ' (first 1,000 by ID; additional heads are not assessed)'
              : ''}
            .
          </p>
          {data.inspected === 0 && (
            <p role="status">No stored publications yet.</p>
          )}
          <dl>
            {(
              [
                ['Valid heads', data.valid],
                ['Invalid records', data.invalid],
                ['Missing head editions', data.missingHead],
                ['Published', data.published],
                ['Drafts', data.drafts],
                ['Withdrawn', data.withdrawn],
                [
                  'Published records missing evidence hash',
                  data.missingEvidence,
                ],
                [
                  'Published records missing review',
                  data.unreviewedPublication,
                ],
                ['Future retrieval timestamps', data.futureRetrieval],
                ['News retrieved over seven days ago', data.oldNewsRetrieval],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            The seven-day news retrieval budget is an operations triage rule.
            Annual observations and glossary terms are excluded; old news can
            remain valid historical evidence. Counts may overlap.
          </p>
          <h3>API request diagnostics</h3>
          <p>
            This API process only, since{' '}
            {new Date(data.requests.observedSince).toLocaleString()}. Counters
            reset on restart; they do not measure whole-service availability.
          </p>
          <dl>
            <dt>Completed requests</dt>
            <dd>{data.requests.completed}</dd>
            <dt>Disconnected requests</dt>
            <dd>{data.requests.disconnected}</dd>
            <dt>Completed server errors</dt>
            <dd>{data.requests.serverErrors}</dd>
            <dt>Completed under 100 ms</dt>
            <dd>{data.requests.under100ms}</dd>
            <dt>Completed 100–999 ms</dt>
            <dd>{data.requests.under1000ms}</dd>
            <dt>Completed at least 1 second</dt>
            <dd>{data.requests.slow}</dd>
          </dl>
          <h3>Latest ingestion runs</h3>
          {data.recentRuns.length === 0 ? (
            <p>No recorded runs.</p>
          ) : (
            <ol>
              {data.recentRuns.map((run, i) => (
                <li key={`${run.startedAt}-${i}`}>
                  {run.status} · started{' '}
                  {new Date(run.startedAt).toLocaleString()} ·{' '}
                  {run.finishedAt
                    ? `finished ${new Date(run.finishedAt).toLocaleString()}`
                    : 'no completion recorded'}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
