import { useEffect, useState } from 'react';
import { AccountGate } from './AccountGate';
import { money, shortDate } from './ui';
import {
  HoldingsSnapshotSchema,
  HoldingsPreviewSchema,
  HoldingsHistorySchema,
  holdingsCsv,
  goalMinorToRupees,
  rupeesToGoalMinor,
  AccountHoldingSchema,
  parseHoldingsCsv,
  type Holding,
  type HoldingsSnapshot,
  type HoldingsPreview,
} from '@fingent360/contracts';
class SignInRequired extends Error {}
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
  if (response.status === 401)
    throw new SignInRequired('Please sign in again.');
  const payload: unknown = await response.json().catch(() => {
    throw new Error(
      'Holdings service returned an unreadable response. Please retry.',
    );
  });
  if (!response.ok)
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Holdings request failed.',
    );
  return payload;
}
export function Holdings() {
  const [mode, setMode] = useState<'manual' | 'csv'>('manual');
  const [draft, setDraft] = useState<Holding[]>([]);
  const [row, setRow] = useState({ isin: '', quantity: '', cost: '' });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [saved, setSaved] = useState<HoldingsSnapshot | null>(null);
  const [csv, setCsv] = useState('isin,quantity,total_cost_paise');
  const [preview, setPreview] = useState<HoldingsPreview | null>(null);
  const [history, setHistory] = useState<HoldingsSnapshot[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function failure(e: unknown) {
    if (e instanceof SignInRequired) {
      setSignedOut(true);
      setSaved(null);
      setDraft([]);
      setHistory([]);
      setPreview(null);
      setCsv('isin,quantity,total_cost_paise');
      setRow({ isin: '', quantity: '', cost: '' });
      setConsent(false);
      setError('');
    } else
      setError(e instanceof Error ? e.message : 'Holdings request failed.');
  }
  const rowDirty = () => {
    const original =
      editingRow === null
        ? { isin: '', quantity: '', cost: '' }
        : draft[editingRow]
          ? {
              isin: draft[editingRow]!.isin,
              quantity: draft[editingRow]!.quantity,
              cost: goalMinorToRupees(draft[editingRow]!.totalCostMinor),
            }
          : { isin: '', quantity: '', cost: '' };
    return JSON.stringify(row) !== JSON.stringify(original);
  };
  const discardRow = () =>
    !rowDirty() ||
    window.confirm('Discard the unsaved holding you are editing?');
  const draftDirty = () =>
    !!saved &&
    (rowDirty() ||
      (mode === 'csv' ? csv : holdingsCsv(draft)) !==
        holdingsCsv(saved.holdings));
  async function load(active: () => boolean = () => true) {
    const result = HoldingsSnapshotSchema.parse(await api());
    // StrictMode may finish its discarded effect after the active load.
    // A stale initial response must never reset an editable draft.
    if (!active()) return;
    setSaved(result);
    setDraft(result.holdings);
    setRow({ isin: '', quantity: '', cost: '' });
    setEditingRow(null);
    setCsv(holdingsCsv(result.holdings));
    setPreview(null);
  }
  useEffect(() => {
    let active = true;
    void load(() => active).catch((error) => {
      if (active) failure(error);
    });
    return () => {
      active = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  if (signedOut)
    return (
      <section>
        <div className="page-header">
          <h1>My holdings</h1>
        </div>
        <AccountGate
          next="holdings"
          title="Keep a private record of your holdings"
        />
      </section>
    );
  return (
    <section className="account" aria-label="My entered holdings">
      <header className="page-header">
        <div>
          <p className="page-kicker">YOUR PORTFOLIO</p>
          <h1 id="holdings-title">A clear record of what you own</h1>
          <p className="page-description">
            Keep your quantities and purchase costs in one private place. Add
            entries in rupees, review your changes, then save.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              if (
                !draftDirty() ||
                window.confirm(
                  'Discard your unsaved holdings draft and reload the saved record?',
                )
              )
                void action(load);
            }}
          >
            Reload saved holdings
          </button>
        </div>
      </header>
      {error && <p role="alert">{error} </p>}
      {message && <p role="status">{message}</p>}
      {!saved && !error && <p role="status">Loading your holdings…</p>}
      {saved && (
        <>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Saved holdings</span>
              <strong>{saved.holdings.length}</strong>
              <small>Unique identifiers</small>
            </article>
            <article className="metric-card">
              <span>Total purchase cost</span>
              <strong>{money(saved.totalCostMinor)}</strong>
              <small>What you entered, not market value</small>
            </article>
            <article className="metric-card">
              <span>Last saved</span>
              <strong>
                {saved.updatedAt ? shortDate(saved.updatedAt) : 'Not yet'}
              </strong>
              <small>Saved revision {saved.version}</small>
            </article>
          </div>
          <section aria-label="Saved holdings" className="panel">
            <div className="section-heading">
              <h3>Your saved record</h3>
              <span className="badge">Entered by you</span>
            </div>
            {saved.holdings.length === 0 ? (
              <div className="empty-state">
                <h3>No holdings saved.</h3>
                <p>
                  Add your first holding below. Have your statement handy for
                  its ISIN, quantity and total purchase cost.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Security ISIN</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">Purchase cost (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved.holdings.map((holding) => (
                      <tr key={holding.isin}>
                        <th scope="row">{holding.isin}</th>
                        <td>{holding.quantity}</td>
                        <td>{goalMinorToRupees(holding.totalCostMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      <section className="panel" aria-label="Edit holdings">
        <div className="section-heading">
          <h3>Update your holdings</h3>
          <span className="badge">1. Enter · 2. Review · 3. Save</span>
        </div>
        <p>
          Changes here stay in your draft until you review and confirm them.
          Saving replaces your saved record with the complete list below.
        </p>
        <div
          className="segmented-control"
          role="group"
          aria-label="Entry method"
        >
          <button
            disabled={busy || !saved}
            aria-pressed={mode === 'manual'}
            onClick={() => {
              if (mode === 'manual') return;
              try {
                setDraft(parseHoldingsCsv(csv));
                setMode('manual');
                setPreview(null);
              } catch {
                setError(
                  'Correct the CSV before switching to manual entry, or reload your saved holdings.',
                );
              }
            }}
          >
            Enter manually
          </button>
          <button
            disabled={busy || !saved}
            aria-pressed={mode === 'csv'}
            onClick={() => {
              if (mode === 'csv') return;
              if (!discardRow()) return;
              setRow({ isin: '', quantity: '', cost: '' });
              setEditingRow(null);
              setCsv(holdingsCsv(draft));
              setMode('csv');
              setPreview(null);
            }}
          >
            Import CSV
          </button>
        </div>
        {mode === 'manual' && (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  const parsed = AccountHoldingSchema.parse({
                    isin: row.isin.trim().toUpperCase(),
                    quantity: row.quantity.trim(),
                    totalCostMinor: rupeesToGoalMinor(row.cost.trim()),
                  });
                  if (
                    draft.some(
                      (v, index) =>
                        v.isin === parsed.isin && index !== editingRow,
                    )
                  )
                    throw new Error(
                      'This ISIN is already listed. Edit that row to combine your quantities and costs.',
                    );
                  if (editingRow === null && draft.length >= 200)
                    throw new Error('You can save up to 200 holdings.');
                  const next =
                    editingRow === null
                      ? [...draft, parsed]
                      : draft.map((v, index) =>
                          index === editingRow ? parsed : v,
                        );
                  setDraft(next);
                  setCsv(holdingsCsv(next));
                  setPreview(null);
                  setRow({ isin: '', quantity: '', cost: '' });
                  setEditingRow(null);
                  setError('');
                  setMessage('Draft updated. Review and confirm to save.');
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Check the holding details.',
                  );
                }
              }}
            >
              <fieldset disabled={busy || !saved}>
                <legend>
                  {editingRow === null ? 'Add a holding' : 'Edit holding'}
                </legend>
                <div className="form-grid">
                  <label className="field">
                    Security ISIN
                    <input
                      required
                      maxLength={12}
                      placeholder="12-character ISIN from your statement"
                      value={row.isin}
                      onChange={(e) => setRow({ ...row, isin: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Quantity
                    <input
                      required
                      inputMode="decimal"
                      placeholder="e.g. 10"
                      value={row.quantity}
                      onChange={(e) =>
                        setRow({ ...row, quantity: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Total purchase cost (INR)
                    <input
                      required
                      inputMode="decimal"
                      placeholder="e.g. 12500.50"
                      value={row.cost}
                      onChange={(e) => setRow({ ...row, cost: e.target.value })}
                    />
                  </label>
                </div>
                <p className="muted">
                  Use total cost for the whole holding, not the cost per share.
                  Up to two decimal places for rupees and six for quantity.
                </p>
                <div className="page-actions">
                  <button type="submit">
                    {editingRow === null
                      ? 'Add to draft'
                      : 'Update draft holding'}
                  </button>
                  {editingRow !== null && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        if (!discardRow()) return;
                        setEditingRow(null);
                        setRow({ isin: '', quantity: '', cost: '' });
                      }}
                    >
                      Cancel holding edit
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
            <section aria-label="Draft holdings">
              <h4>Your draft · {draft.length} holdings</h4>
              {draft.length === 0 ? (
                <p className="muted">
                  No entries in this draft. Confirming an empty draft will
                  remove all saved holdings.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">ISIN</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Cost (INR)</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((holding, index) => (
                        <tr key={holding.isin}>
                          <th scope="row">{holding.isin}</th>
                          <td>{holding.quantity}</td>
                          <td>{goalMinorToRupees(holding.totalCostMinor)}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              aria-label={`Edit ${holding.isin}`}
                              onClick={() => {
                                if (!discardRow()) return;
                                setEditingRow(index);
                                setRow({
                                  isin: holding.isin,
                                  quantity: holding.quantity,
                                  cost: goalMinorToRupees(
                                    holding.totalCostMinor,
                                  ),
                                });
                                setPreview(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              aria-label={`Remove ${holding.isin} from draft`}
                              onClick={() => {
                                if (!discardRow()) return;
                                const next = draft.filter(
                                  (_, i) => i !== index,
                                );
                                setDraft(next);
                                setCsv(holdingsCsv(next));
                                setPreview(null);
                                setEditingRow(null);
                                setRow({ isin: '', quantity: '', cost: '' });
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
        {mode === 'csv' && (
          <>
            <label className="field">
              Upload standard CSV
              <input
                disabled={busy || !saved}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (
                    draftDirty() &&
                    !window.confirm(
                      'Replace your unsaved draft with this CSV file?',
                    )
                  ) {
                    event.target.value = '';
                    return;
                  }
                  void action(async () => {
                    if (file.size > 50000)
                      throw new Error('Choose a CSV smaller than 50 KB.');
                    const text = await file.text();
                    setCsv(text);
                    setPreview(null);
                    setMessage(
                      'CSV loaded into your draft. Review before saving.',
                    );
                  });
                }}
              />
            </label>
            <details>
              <summary>CSV format and units</summary>
              <p>
                Use exactly isin,quantity,total_cost_paise as the header. Each
                row contains an Indian ISIN, quantity, and total cost in whole
                paise (INR 100.00 = 10000 paise). Maximum 200 rows. Quoted
                fields, formulas, duplicate ISINs and extra columns are
                rejected. This standard CSV is not a broker or XLSX importer.
              </p>
            </details>
            <label htmlFor="holdings-csv">Holdings CSV</label>
            <textarea
              id="holdings-csv"
              disabled={busy || !saved}
              rows={8}
              maxLength={50000}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
            />
          </>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              if (!saved) throw new Error('Sign in and reload holdings first.');
              if (mode === 'manual' && (row.isin || row.quantity || row.cost))
                throw new Error(
                  'Add the holding to your draft or cancel its edit before reviewing.',
                );
              setPreview(
                HoldingsPreviewSchema.parse(
                  await api('/preview', {
                    csv: mode === 'manual' ? holdingsCsv(draft) : csv,
                    expectedVersion: saved.version,
                    storageConsent: consent,
                  }),
                ),
              );
            });
          }}
        >
          <fieldset disabled={busy || !saved}>
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
      </section>
      {preview && (
        <section aria-label="Holdings preview" className="panel">
          <h3>Review before replacing</h3>
          <p>
            {preview.holdings.length} rows · total acquisition cost INR{' '}
            {goalMinorToRupees(preview.totalCostMinor)} · replacing revision{' '}
            {preview.expectedVersion}. Check this full list before saving. Your
            review is available for 30 minutes.
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
      <aside className="panel">
        <h3>Know what these numbers mean</h3>
        <p>
          These are your entered quantities and purchase costs, not current
          market values. ISIN check digits catch typing mistakes but do not
          independently verify the security or its classification. Check your
          statement before saving. Earlier versions stay in your private history
          until account deletion.
        </p>
      </aside>
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
