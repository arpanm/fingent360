import { useEffect, useRef, useState } from 'react';
import { MaterialWorkerHealthSchema } from '@fingent360/contracts';
import { json } from './net';

export function MaterialWorkerHealth({ request }: { request: typeof json }) {
  const [health, setHealth] = useState<ReturnType<
    typeof MaterialWorkerHealthSchema.parse
  > | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load() {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setHealth(null);
    try {
      const result = MaterialWorkerHealthSchema.parse(
        await request('/ops/material-worker'),
      );
      if (ticket === generation.current) setHealth(result);
    } catch (failure) {
      if (ticket === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Worker observation unavailable.',
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  const time = (value: string | null) =>
    value ? new Date(value).toLocaleString() : 'Not observed';
  return (
    <section aria-label="Automatic material worker health">
      <h3>Stored material checks</h3>
      <p>
        Aggregate observations only. No provider refresh or external
        notification is performed. Due checks run in batches of at most ten
        accounts; failures retry after 15 minutes.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh material worker health
      </button>
      {busy && <p role="status">Loading material worker health…</p>}
      {error && <p role="alert">{error}</p>}
      {health && (
        <dl>
          <dt>Observed</dt>
          <dd>{time(health.observedAt)}</dd>
          <dt>Heartbeat</dt>
          <dd>{time(health.heartbeatAt)}</dd>
          <dt>Last completed account check</dt>
          <dd>{time(health.lastSuccessAt)}</dd>
          <dt>Last storage failure</dt>
          <dd>{time(health.lastFailureAt)}</dd>
          <dt>Due accounts</dt>
          <dd>{health.dueAccounts}</dd>
          <dt>Accounts waiting to retry</dt>
          <dd>{health.retryAccounts}</dd>
        </dl>
      )}
    </section>
  );
}
