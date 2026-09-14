import { useEffect, useRef, useState } from 'react';
import {
  WorkerHealthOverviewSchema,
  WorkerControlReceiptSchema,
  WorkerControlHistorySchema,
  type WorkerHealthOverview,
  type WorkerControlReceipt,
  type WorkerControlInput,
  type WorkerId,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { Dialog } from './Dialog';
const names = { reports: 'Saved reports', reminders: 'Reading reminders' };
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not observed';
export function WorkerHealth({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [data, setData] = useState<WorkerHealthOverview | null>(null);
  const [busy, setBusy] = useState(true),
    [current, setCurrent] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<WorkerId | null>(null);
  const [history, setHistory] = useState<WorkerControlReceipt[]>([]),
    [more, setMore] = useState(false),
    [historyBusy, setHistoryBusy] = useState(false),
    [historyError, setHistoryError] = useState('');
  const [review, setReview] = useState<{
    worker: WorkerId;
    input: WorkerControlInput;
  } | null>(null);
  const [pending, setPending] = useState<{
    worker: WorkerId;
    input: WorkerControlInput;
  } | null>(null);
  const [receipt, setReceipt] = useState<WorkerControlReceipt | null>(null);
  const mounted = useRef(false),
    denied = useRef(false),
    generation = useRef(0),
    historyGeneration = useRef(0);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;
  function failure(cause: unknown, active = true, historical = false) {
    if (!mounted.current || denied.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      denied.current = true;
      generation.current++;
      historyGeneration.current++;
      setData(null);
      setReceipt(null);
      setReview(null);
      setPending(null);
      setHistory([]);
      setSelected(null);
      setError('');
      setHistoryError('');
      setNotice('');
      setCurrent(false);
      sessionExpired.current();
    } else if (active) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Worker health is unavailable. Retry.';
      if (historical) setHistoryError(message);
      else setError(message);
    }
  }
  async function load() {
    if (!mounted.current || denied.current) return;
    const ticket = ++generation.current;
    setBusy(true);
    setCurrent(false);
    setError('');
    try {
      const value = WorkerHealthOverviewSchema.parse(
        await json('/ops/workers'),
      );
      if (mounted.current && !denied.current && ticket === generation.current) {
        setData(value);
        setCurrent(true);
      }
    } catch (cause) {
      failure(cause, ticket === generation.current);
    } finally {
      if (mounted.current && !denied.current && ticket === generation.current)
        setBusy(false);
    }
  }
  async function loadHistory(worker: WorkerId, before?: number) {
    const ticket = ++historyGeneration.current;
    setSelected(worker);
    setHistoryBusy(true);
    setHistoryError('');
    if (before === undefined) {
      setHistory([]);
      setMore(false);
    }
    try {
      const value = WorkerControlHistorySchema.parse(
        await json(
          `/ops/workers/${worker}/history${before === undefined ? '' : `?before=${before}`}`,
        ),
      );
      if (
        mounted.current &&
        !denied.current &&
        ticket === historyGeneration.current
      ) {
        setHistory((previous) =>
          before === undefined
            ? value.receipts
            : [...previous, ...value.receipts],
        );
        setMore(value.moreAvailable);
      }
    } catch (cause) {
      failure(cause, ticket === historyGeneration.current, true);
    } finally {
      if (
        mounted.current &&
        !denied.current &&
        ticket === historyGeneration.current
      )
        setHistoryBusy(false);
    }
  }
  async function perform(action: {
    worker: WorkerId;
    input: WorkerControlInput;
  }) {
    if (denied.current) return;
    setBusy(true);
    setCurrent(false);
    setError('');
    setNotice('');
    setPending(action);
    setReview(null);
    try {
      const saved = WorkerControlReceiptSchema.parse(
        await json(
          `/ops/workers/${action.worker}/control`,
          action.input,
          'POST',
        ),
      );
      if (!mounted.current || denied.current) return;
      setReceipt(saved);
      setPending(null);
      await load();
      if (!denied.current) await loadHistory(action.worker);
    } catch (cause) {
      failure(cause);
    } finally {
      if (mounted.current && !denied.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current++;
      historyGeneration.current++;
    };
  }, []);
  return (
    <section className="account" aria-label="Worker health">
      <h2>Worker health</h2>
      <p>
        Aggregate server observations only. No report contents, reminder titles
        or account identities are shown. Checking this page does not run work.
      </p>
      <p>
        Pause stops new report claims and scheduled report creation, or new
        reminder batches. Already claimed reports may finish under their
        original leases.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Loading worker health…</p>}
      <button className="secondary" disabled={busy} onClick={() => void load()}>
        Reload worker health
      </button>
      {pending && (
        <div className="panel">
          <p>
            The control result is unconfirmed. Retry the same request to
            retrieve its saved outcome.
          </p>
          <button disabled={busy} onClick={() => void perform(pending)}>
            Retry same control
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setPending(null);
              setNotice(
                'Retry dismissed. Reload health before reviewing another control.',
              );
            }}
          >
            Dismiss control retry
          </button>
        </div>
      )}
      {receipt && (
        <section className="panel" aria-label="Saved worker control receipt">
          <h3>Saved control receipt</h3>
          <p>
            {names[receipt.worker]}: {receipt.paused ? 'pause' : 'resume'}{' '}
            recorded {date(receipt.recordedAt)}, control version{' '}
            {receipt.version}.
          </p>
          <p>
            This historical receipt does not establish the current worker mode.
            Reload health to check the present state.
          </p>
        </section>
      )}
      {data && (
        <>
          <p>
            Observed {date(data.observedAt)}. Counts describe this server
            observation.
          </p>
          {!current && (
            <p role="note">
              Current worker health is unavailable. These dated observations are
              historical; controls stay disabled until Reload succeeds.
            </p>
          )}
          {data.workers.map((worker) => (
            <article
              className="panel"
              key={worker.worker}
              aria-label={`${names[worker.worker]} health`}
            >
              <h3>{names[worker.worker]}</h3>
              {worker.worker === 'reports' && worker.dueSchedules === null && (
                <p>Report scheduling is not enabled on this server.</p>
              )}
              <p>
                Mode: {worker.paused ? 'Paused' : 'Running'} · control version{' '}
                {worker.version}
              </p>
              <p>
                Heartbeat:{' '}
                {worker.freshness === 'fresh'
                  ? 'Fresh observation'
                  : worker.freshness === 'stale'
                    ? 'Stale observation — check server processes'
                    : 'No heartbeat observed'}{' '}
                · {date(worker.heartbeatAt)}
              </p>
              <p>
                A fresh heartbeat means a process reached storage
                within30seconds; it does not confirm every process or successful
                work.
              </p>
              <dl>
                <dt>Queued</dt>
                <dd>
                  {worker.queued.count}
                  {worker.queued.moreAvailable ? '+' : ''}
                </dd>
                <dt>Due now</dt>
                <dd>
                  {worker.due.count}
                  {worker.due.moreAvailable ? '+' : ''}
                </dd>
                {worker.dueSchedules && (
                  <>
                    <dt>Due report schedules</dt>
                    <dd>
                      {worker.dueSchedules.count}
                      {worker.dueSchedules.moreAvailable ? '+' : ''}
                    </dd>
                  </>
                )}
                <dt>Active leases</dt>
                <dd>
                  {worker.activeLeases === null
                    ? 'Not applicable — atomic reminder batches'
                    : `${worker.activeLeases.count}${worker.activeLeases.moreAvailable ? '+' : ''}`}
                </dd>
                <dt>Expired leases</dt>
                <dd>
                  {worker.expiredLeases === null
                    ? 'Not applicable'
                    : `${worker.expiredLeases.count}${worker.expiredLeases.moreAvailable ? '+' : ''}`}
                </dd>
                <dt>Oldest outstanding age</dt>
                <dd>
                  {worker.oldestOutstandingAgeSeconds === null
                    ? 'No outstanding work'
                    : `${worker.oldestOutstandingAgeSeconds} seconds${worker.worker === 'reminders' ? ' since its due time (zero for future reminders)' : ' since request'}`}
                </dd>
                <dt>Last completed work</dt>
                <dd>{date(worker.lastSuccessAt)}</dd>
                <dt>Last failure</dt>
                <dd>
                  {worker.failureCategory ?? 'None recorded'} ·{' '}
                  {date(worker.lastFailureAt)}
                </dd>
              </dl>
              <button
                disabled={!current || busy || !!pending}
                onClick={() =>
                  setReview({
                    worker: worker.worker,
                    input: {
                      requestId: crypto.randomUUID(),
                      expectedVersion: worker.version,
                      paused: !worker.paused,
                      confirm: true,
                    },
                  })
                }
              >
                {worker.paused ? 'Review resume' : 'Review pause'}{' '}
                {names[worker.worker]}
              </button>
              <button
                className="secondary"
                onClick={() => void loadHistory(worker.worker)}
              >
                Control history for {names[worker.worker]}
              </button>
            </article>
          ))}
        </>
      )}
      {selected && (
        <section className="panel" aria-label="Worker control history">
          <h3>{names[selected]} control history</h3>
          <p>
            Latest1,000 immutable control receipts per worker are retained. An
            old expected version cannot apply a control after its receipt is
            removed.
          </p>
          {historyBusy && <p role="status">Loading control history…</p>}
          {historyError && <p role="alert">{historyError}</p>}
          {!historyBusy && !historyError && !history.length && (
            <p>No controls recorded.</p>
          )}
          <ol>
            {history.map((item) => (
              <li key={item.requestId}>
                {item.paused ? 'Paused' : 'Resumed'} · version {item.version} ·{' '}
                {date(item.recordedAt)}
              </li>
            ))}
          </ol>
          <button
            className="secondary"
            disabled={historyBusy}
            onClick={() => void loadHistory(selected)}
          >
            Reload control history
          </button>
          {more && (
            <button
              disabled={historyBusy}
              onClick={() =>
                void loadHistory(selected, history.at(-1)?.version)
              }
            >
              Older controls
            </button>
          )}
          <button
            className="secondary"
            onClick={() => {
              historyGeneration.current++;
              setSelected(null);
              setHistory([]);
            }}
          >
            Close history
          </button>
        </section>
      )}
      {review && (
        <Dialog
          title={`${review.input.paused ? 'Pause' : 'Resume'} ${names[review.worker]}?`}
          onClose={() => {
            setReview(null);
            setNotice('Control review cancelled. No worker mode changed.');
          }}
        >
          <p>
            {review.input.paused
              ? 'Stop new claims across connected server instances. Already admitted work may complete; no existing job is cancelled.'
              : 'Allow new claims using existing queues, leases and original outcomes. This does not force a retry or fetch any provider.'}
          </p>
          <p>
            Reviewed control version {review.input.expectedVersion}. A changed
            version requires Reload.
          </p>
          <button
            className="secondary"
            onClick={() => {
              setReview(null);
              setNotice('Control review cancelled. No worker mode changed.');
            }}
          >
            Cancel control
          </button>
          <button onClick={() => void perform(review)}>
            Confirm {review.input.paused ? 'pause' : 'resume'}
          </button>
        </Dialog>
      )}
    </section>
  );
}
