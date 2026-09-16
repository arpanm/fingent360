import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import { AdjustmentQueueSchema, NSE_ACTIONS_URL } from '@fingent360/contracts';
import { json, RequestError } from './net';
import { AdjustmentWindowView } from './EquityAdjustments';
export function EquityAdjustmentOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [isin, setIsin] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [csv, setCsv] = useState(''),
    [coverage, setCoverage] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reviewConfirmed, setReviewConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [rows, setRows] = useState<ReturnType<typeof AdjustmentQueueSchema.parse>>(
      [],
    );
  const pending = useRef<{ key: string; id: string } | null>(null),
    live = useRef(true),
    fileEpoch = useRef(0);
  function fail(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      fileEpoch.current++;
      setRows([]);
      setCsv('');
      setConfirmed(false);
      onDenied();
    } else setError(cause instanceof Error ? cause.message : 'Request failed.');
  }
  async function load() {
    setLoading(true);
    try {
      const result = AdjustmentQueueSchema.parse(
        await request('/ops/equity-adjustments'),
      );
      if (live.current) setRows(result);
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      fileEpoch.current++;
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const key = JSON.stringify({ path, value });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      await request(
        `/ops/equity-adjustments/${path}`,
        { ...value, requestId: pending.current.id },
        'POST',
      );
      await load();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Price adjustment review"
      aria-busy={busy || loading}
    >
      <h2>Complete-window price normalization</h2>
      <p>
        Use a company-filtered original NSE corporate-action CSV covering both
        dates. Check every page, all relevant company identifiers and the
        corresponding admitted traded closes. A missing export is never proof of
        no actions. Unsupported purposes, identity changes, ambiguous closes and
        same-day combinations block calculation.
      </p>
      {loading && <p role="status">Loading adjustment queue…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh adjustment queue
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send('prepare', {
            isin,
            windowStart: start,
            windowEnd: end,
            sourceUrl: NSE_ACTIONS_URL,
            sourceCsv: csv,
            coverageEvidence: coverage,
            completeWindowConfirmed: confirmed,
            rightsEvidence: rights,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Retain coverage and calculate factors</legend>
          <label>
            Company ISIN
            <input
              required
              value={isin}
              onChange={(event) => {
                setIsin(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            First trading date
            <input
              required
              type="date"
              value={start}
              onChange={(event) => {
                setStart(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Last trading date
            <input
              required
              type="date"
              value={end}
              onChange={(event) => {
                setEnd(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Original company action CSV
            <input
              type="file"
              accept=".csv"
              onChange={(event) => {
                const ticket = ++fileEpoch.current;
                setError('');
                setCsv('');
                setConfirmed(false);
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 2000000) {
                  setError('CSV exceeds 2 MB.');
                  return;
                }
                void file
                  .text()
                  .then((value) => {
                    if (live.current && ticket === fileEpoch.current)
                      setCsv(value);
                  })
                  .catch((cause) => {
                    if (ticket === fileEpoch.current) fail(cause);
                  });
              }}
            />
          </label>
          <label>
            How was the full action and traded-price window checked?
            <textarea
              required
              minLength={30}
              value={coverage}
              onChange={(event) => {
                setCoverage(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Source usage permission evidence
            <textarea
              required
              minLength={20}
              value={rights}
              onChange={(event) => {
                setRights(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I checked complete company/date coverage, all source pages, every
            traded close and source-specific display/retention/offline
            permission.
          </label>
          <button disabled={!confirmed || !csv}>
            Prepare normalization receipt
          </button>
        </fieldset>
      </form>
      <label>
        Independent review evidence
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setReviewConfirmed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(event) => setReviewConfirmed(event.target.checked)}
        />
        I independently verified complete-window source coverage and exact
        factors.
      </label>
      {!loading && rows.length === 0 && <p>No adjustment windows retained.</p>}
      {rows.map((row) => (
        <section key={row.receipt.id}>
          <p>Status: {row.state}</p>
          <AdjustmentWindowView window={row.receipt} />
          <button
            disabled={busy || !reviewConfirmed || reason.trim().length < 20}
            onClick={() =>
              void send('review', {
                id: row.receipt.id,
                decision: 'publish',
                reason,
                completeWindowConfirmed: reviewConfirmed,
              })
            }
          >
            Publish reviewed normalization
          </button>
          <button
            disabled={busy || reason.trim().length < 20}
            onClick={() =>
              void send('review', {
                id: row.receipt.id,
                decision: 'withdraw',
                reason,
                completeWindowConfirmed: reviewConfirmed,
              })
            }
          >
            Withdraw normalization
          </button>
        </section>
      ))}
    </section>
  );
}
