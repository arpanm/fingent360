import { useEffect, useState } from 'react';
import {
  HoldingsSnapshotSchema,
  HoldingsPreviewSchema,
  HoldingsHistorySchema,
  holdingsCsv,
  goalMinorToRupees,
  type HoldingsSnapshot,
  type HoldingsPreview,
} from '@fingent360/contracts';
async function api(path = '', body?: unknown): Promise<unknown> {
  const response = await fetch(`/api/v1/account/holdings${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const payload: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Holdings request failed.',
    );
  return payload;
}
export function Holdings() {
  const [saved, setSaved] = useState<HoldingsSnapshot | null>(null);
  const [csv, setCsv] = useState('isin,quantity,total_cost_paise');
  const [preview, setPreview] = useState<HoldingsPreview | null>(null);
  const [history, setHistory] = useState<HoldingsSnapshot[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    const result = HoldingsSnapshotSchema.parse(await api());
    setSaved(result);
    setCsv(holdingsCsv(result.holdings));
    setPreview(null);
  }
  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Holdings request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account" aria-labelledby="holdings-title">
      <h2 id="holdings-title">My entered holdings</h2>
      <p>
        <a href="#account">Sign in or create an account</a> to privately save
        holdings. These are user-entered, unverified Indian security identifiers
        and acquisition costs. An ISIN checksum does not verify that a security
        is an equity. No market prices, current valuations, returns or
        investment recommendations are supplied.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button disabled={busy} onClick={() => void action(load)}>
        Reload saved holdings
      </button>
      {saved && (
        <>
          <p>
            Saved revision {saved.version} · total acquisition cost INR{' '}
            {goalMinorToRupees(saved.totalCostMinor)} · recorded{' '}
            {saved.updatedAt ?? 'Never'}
          </p>
          <section aria-label="Saved holdings">
            {saved.holdings.length === 0 ? (
              <p>No holdings saved.</p>
            ) : (
              saved.holdings.map((row) => (
                <article className="card" key={row.isin}>
                  <h3>{row.isin}</h3>
                  <p>
                    Quantity {row.quantity} · total acquisition cost INR{' '}
                    {goalMinorToRupees(row.totalCostMinor)}
                  </p>
                </article>
              ))
            )}
          </section>
          <button
            disabled={busy}
            onClick={() => {
              const blob = new Blob([holdingsCsv(saved.holdings)], {
                type: 'text/csv;charset=utf-8',
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'fingent360-holdings.csv';
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download saved CSV
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () =>
                setHistory(
                  HoldingsHistorySchema.parse(await api('/history')).revisions,
                ),
              )
            }
          >
            View holdings history
          </button>
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void action(async () => {
            if (!saved) throw new Error('Sign in and reload holdings first.');
            setPreview(
              HoldingsPreviewSchema.parse(
                await api('/preview', {
                  csv,
                  expectedVersion: saved.version,
                  storageConsent: consent,
                }),
              ),
            );
          });
        }}
      >
        <fieldset disabled={busy || !saved}>
          <legend>Replace holdings with reviewed CSV</legend>
          <p>
            Add, change or remove rows below. Saving replaces the complete
            portfolio; a header-only CSV removes all current holdings. Past
            revisions remain until account deletion. This standard format is not
            a broker export parser or XLSX importer.
          </p>
          <p>
            Exact header: isin,quantity,total_cost_paise. Use one Indian ISIN
            per row, quantity with up to 6 decimal places, and whole INR paise
            for total cost (INR 100.00 = 10000 paise). Maximum 200 rows; combine
            duplicate ISINs yourself and reconcile with your records. Quoting,
            formulas and extra columns are rejected.
          </p>
          <label htmlFor="holdings-csv">Holdings CSV</label>
          <textarea
            id="holdings-csv"
            rows={10}
            required
            maxLength={50000}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
          />
          <label className="check-label">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setPreview(null);
              }}
            />
            I consent to storing my holdings, import previews and revisions
            until account deletion.
          </label>
          <button type="submit">Preview holdings</button>
        </fieldset>
      </form>
      {preview && (
        <section aria-label="Holdings preview">
          <h3>Review before replacing</h3>
          <p>
            {preview.holdings.length} rows · total acquisition cost INR{' '}
            {goalMinorToRupees(preview.totalCostMinor)} · replacing revision{' '}
            {preview.expectedVersion}. Preview expires {preview.expiresAt}.
            Parser {preview.parserVersion}.
          </p>
          {preview.holdings.map((row) => (
            <p key={row.isin}>
              {row.isin} · quantity {row.quantity} · total acquisition cost INR{' '}
              {goalMinorToRupees(row.totalCostMinor)}
            </p>
          ))}
          <p>
            Check every identifier, quantity and total against your own records.
            This is not an independently reconciled broker statement.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                HoldingsSnapshotSchema.parse(
                  await api('/confirm', {
                    previewId: preview.previewId,
                    expectedVersion: preview.expectedVersion,
                  }),
                );
                await load();
                setHistory([]);
                setConsent(false);
                setMessage('Holdings saved.');
              })
            }
          >
            Confirm replacement
          </button>
          <button disabled={busy} onClick={() => setPreview(null)}>
            Cancel preview
          </button>
        </section>
      )}
      {history.length > 0 && (
        <section aria-label="Holdings history">
          <h3>Saved revisions</h3>
          {history.map((revision) => (
            <details key={revision.version}>
              <summary>
                Revision {revision.version} · {revision.holdings.length} rows ·{' '}
                {revision.updatedAt}
              </summary>
              <p>
                Total acquisition cost INR{' '}
                {goalMinorToRupees(revision.totalCostMinor)}
              </p>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {holdingsCsv(revision.holdings)}
              </pre>
            </details>
          ))}
        </section>
      )}
    </section>
  );
}
