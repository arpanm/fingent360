import { useEffect, useRef, useState } from 'react';
import {
  DeploymentMonitoringSchema,
  AcknowledgeMonitoringSchema,
  RetireMonitoringProcessesReceiptSchema,
  type DeploymentMonitoring as Overview,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function DeploymentMonitoring({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRetire, setConfirmRetire] = useState(false);
  const live = useRef(false);
  const generation = useRef(0);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  async function load(id?: string, retire = false) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setData(null);
    try {
      if (retire) {
        RetireMonitoringProcessesReceiptSchema.parse(
          await json(
            '/ops/monitoring/retire-missing',
            { confirm: true },
            'POST',
          ),
        );
        setConfirmRetire(false);
      }
      if (id)
        AcknowledgeMonitoringSchema.parse(
          await json('/ops/monitoring/acknowledge', { id }, 'POST'),
        );
      const result = DeploymentMonitoringSchema.parse(
        await json('/ops/monitoring'),
      );
      if (live.current && generation.current === ticket) setData(result);
    } catch (cause) {
      if (!live.current) return;
      if (cause instanceof RequestError && cause.status === 401) {
        generation.current++;
        setData(null);
        expired.current();
      } else if (generation.current === ticket)
        setError(
          cause instanceof RequestError && cause.status === 403
            ? 'Only an operations administrator can change monitoring records. Refresh to continue reading.'
            : 'Deployment monitoring unavailable. Retry to read persisted observations.',
        );
    } finally {
      if (live.current && generation.current === ticket) setBusy(false);
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
    <section aria-label="Deployment monitoring">
      <h3>Deployment monitoring</h3>
      <p>
        Persisted observations from participating API processes sharing this
        database. A whole deployment outage needs an independent uptime monitor.
        Missing samples never establish availability.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        {error
          ? 'Retry deployment monitoring'
          : 'Refresh deployment monitoring'}
      </button>
      {busy && <p role="status">Reading monitoring observations…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Observed {new Date(data.observedAt).toLocaleString()}. Last
            persisted heartbeat:{' '}
            {data.lastHeartbeat
              ? new Date(data.lastHeartbeat).toLocaleString()
              : 'none'}
            .
          </p>
          {data.samples === 0 && (
            <p role="status">
              No recent monitoring samples. Availability is unknown.
            </p>
          )}
          <dl>
            <dt>Participating processes</dt>
            <dd>{data.processes}</dd>
            <dt>Missing heartbeats over three minutes</dt>
            <dd>{data.staleProcesses}</dd>
            <dt>Completed requests in the last 15 minutes</dt>
            <dd>{data.completed}</dd>
            <dt>Server errors</dt>
            <dd>{data.serverErrors}</dd>
            <dt>Requests taking at least one second</dt>
            <dd>{data.slow}</dd>
            <dt>Disconnected requests</dt>
            <dd>{data.disconnected}</dd>
          </dl>
          <p>
            Minute samples are grouped by persistence time; outages can delay a
            batch. An incident opens at 20 or more completed requests with at
            least 5% server errors, or a missing heartbeat. Acknowledgment
            records attention and does not resolve the condition.
          </p>
          {data.staleProcesses > 0 && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={confirmRetire}
                  onChange={(event) => setConfirmRetire(event.target.checked)}
                />
                I confirm all missing processes have been decommissioned
              </label>
              <button
                disabled={busy || !confirmRetire}
                onClick={() => void load(undefined, true)}
              >
                Retire decommissioned processes
              </button>
              <p>
                Use this after intentional replacement or shutdown. A process
                that returns will register again. Do not retire an unexplained
                outage.
              </p>
            </div>
          )}
          {data.incidents.length === 0 ? (
            <p>No retained incidents.</p>
          ) : (
            <ul>
              {data.incidents.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.kind === 'server-errors'
                      ? 'Elevated server errors'
                      : 'Missing API heartbeat'}
                  </strong>{' '}
                  · {item.resolvedAt ? 'Resolved' : 'Active'} · opened{' '}
                  {new Date(item.openedAt).toLocaleString()}
                  {item.acknowledgedAt ? (
                    <p>
                      Acknowledged{' '}
                      {new Date(item.acknowledgedAt).toLocaleString()}
                    </p>
                  ) : (
                    <button disabled={busy} onClick={() => void load(item.id)}>
                      Acknowledge{' '}
                      {item.kind === 'server-errors'
                        ? 'server errors'
                        : 'missing heartbeat'}
                    </button>
                  )}
                  {item.resolvedAt && (
                    <p>
                      Recovered {new Date(item.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.moreIncidents && (
            <p>
              Showing the latest 100 incidents, with active incidents first.
            </p>
          )}
        </>
      )}
    </section>
  );
}
