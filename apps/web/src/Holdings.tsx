import { AngelConnection } from './AngelConnection';
import { UpstoxConnection } from './UpstoxConnection';
import { KiteConnection } from './KiteConnection';
import { HoldingsChangeReview } from './HoldingsChangeReview';
import { MappedCsvImport } from './MappedCsvImport';
import { BrokerImportGuide } from './BrokerImportGuide';
import { SupplementalCostReceipt } from './SupplementalCostReceipt';
import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { parseWorkbook } from './workbook';
import { saveDownload } from './runtime';
import { AccountGate } from './AccountGate';
import { Assist } from './Assist';
import { useDraftGuard } from './useDraftGuard';
import { SmartHelp } from './SmartHelp';
import { money, shortDate } from './ui';
import {
  HoldingsTemplateSchema,
  workbookBase64,
  workbookBytes,
  HoldingsSnapshotSchema,
  HoldingsPreviewSchema,
  HoldingsHistorySchema,
  holdingsCsv,
  goalMinorToRupees,
  rupeesToGoalMinor,
  AccountHoldingSchema,
  validIndianIsin,
  parseHoldingsCsv,
  type Holding,
  type HoldingsSnapshot,
  type HoldingsPreview,
  type MappedHoldingsInput,
} from '@fingent360/contracts';
class SignInRequired extends Error {}
class PreviewConflict extends Error {}
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
  if (response.status === 409)
    throw new PreviewConflict(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Preview unavailable.',
    );
  if (!response.ok)
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Holdings request failed.',
    );
  return payload;
}
export function Holdings() {
  const rowEditor = useRef<HTMLFormElement>(null);
  const loadGeneration = useRef(0),
    authDenied = useRef(false);
  const [rowStep, setRowStep] = useState(0);
  // Commit step focus before typing can begin in the next input. A deferred
  // frame can otherwise redirect cost input back into quantity.
  useLayoutEffect(() => {
    rowEditor.current
      ?.querySelector<HTMLInputElement | HTMLButtonElement>('input,button')
      ?.focus({ preventScroll: true });
  }, [rowStep]);
  const [mode, setMode] = useState<'manual' | 'csv' | 'mapped'>('manual');
  const [mapped, setMapped] = useState<MappedHoldingsInput | null>(null);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [mappingReading, setMappingReading] = useState(false);
  const beforeMapping = useRef<{
    mode: 'manual' | 'csv';
    csv: string;
    workbook: string | null;
    draft: Holding[];
  } | null>(null);
  const [draft, setDraft] = useState<Holding[]>([]);
  const [row, setRow] = useState({ isin: '', quantity: '', cost: '' });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [saved, setSaved] = useState<HoldingsSnapshot | null>(null);
  const [workbook, setWorkbook] = useState<string | null>(null);
  const [csv, setCsv] = useState('isin,quantity,total_cost_paise');
  const [removalConsent, setRemovalConsent] = useState(false);
  const [currentReady, setCurrentReady] = useState(false);
  const [preview, setPreview] = useState<HoldingsPreview | null>(null);
  const [history, setHistory] = useState<HoldingsSnapshot[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function failure(e: unknown) {
    if (e instanceof SignInRequired) {
      authDenied.current = true;
      loadGeneration.current++;
      setCurrentReady(false);
      setSignedOut(true);
      setSaved(null);
      setDraft([]);
      setHistory([]);
      setPreview(null);
      setCsv('isin,quantity,total_cost_paise');
      setRow({ isin: '', quantity: '', cost: '' });
      setConsent(false);
      setWorkbook(null);
      setMapped(null);
      setMappingDirty(false);
      beforeMapping.current = null;
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
    (mappingDirty ||
      rowDirty() ||
      (mode !== 'manual' ? csv : holdingsCsv(draft)) !==
        holdingsCsv(saved.holdings));
  useDraftGuard(
    draftDirty(),
    'Leave this page and discard your unsaved holdings draft?',
  );
  async function load(
    active: () => boolean = () => true,
    preserveDraft = false,
  ) {
    if (authDenied.current) return;
    const ticket = ++loadGeneration.current;
    setCurrentReady(false);
    let result: HoldingsSnapshot;
    try {
      result = HoldingsSnapshotSchema.parse(await api());
    } catch (error) {
      if (
        active() &&
        (error instanceof SignInRequired || ticket === loadGeneration.current)
      )
        throw error;
      return;
    }

    // StrictMode may finish its discarded effect after the active load.
    // A stale initial response must never reset an editable draft.
    if (!active() || authDenied.current || ticket !== loadGeneration.current)
      return;
    setCurrentReady(true);
    if (preserveDraft) {
      setSaved(result);
      setPreview(null);
      setRemovalConsent(false);
      setMessage(
        'Current baseline loaded. Your proposed draft is preserved; create and review a fresh preview before saving.',
      );
      return;
    }
    setWorkbook(null);
    setMapped(null);
    setMappingDirty(false);
    beforeMapping.current = null;
    if (mode === 'mapped') setMode('csv');
    setSaved(result);
    setDraft(result.holdings);
    setRow({ isin: '', quantity: '', cost: '' });
    setEditingRow(null);
    setRowStep(0);
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
      if (e instanceof PreviewConflict) setCurrentReady(false);
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
            <SupplementalCostReceipt imported={saved.import} />
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
                        <th scope="row">
                          {holding.isin}
                          <br />
                          <a href={`#securities/${holding.isin}`}>
                            Look up identity
                          </a>
                        </th>
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
            onClick={() =>
              void action(async () => {
                const blob = new Blob([holdingsCsv(saved.holdings)], {
                  type: 'text/csv;charset=utf-8',
                });
                setMessage(await saveDownload(blob, 'fingent360-holdings.csv'));
              })
            }
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
      <p>
        <a href="#connections">Research connections to my records</a> ·{' '}
        <a href="#allocations">Connect holdings to goals</a>. After changing
        holdings, review any saved allocations against your new quantities.
      </p>
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
            disabled={busy || !saved || mode === 'mapped'}
            aria-pressed={mode === 'manual'}
            onClick={() => {
              if (mode === 'manual') return;
              try {
                setDraft(parseHoldingsCsv(csv));
                setWorkbook(null);
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
            disabled={busy || !saved || mode === 'mapped'}
            aria-pressed={mode === 'csv'}
            onClick={() => {
              if (mode === 'csv') return;
              if (!discardRow()) return;
              setRow({ isin: '', quantity: '', cost: '' });
              setEditingRow(null);
              setCsv(holdingsCsv(draft));
              setRowStep(0);
              setMode('csv');
              setPreview(null);
            }}
          >
            Import CSV or XLSX
          </button>
          <button
            disabled={busy || !saved || !currentReady}
            aria-pressed={mode === 'mapped'}
            onClick={() => {
              if (mode === 'mapped' || !discardRow()) return;
              beforeMapping.current = { mode, csv, workbook, draft };
              setRow({ isin: '', quantity: '', cost: '' });
              setEditingRow(null);
              setMode('mapped');
              setPreview(null);
              setMapped(null);
              setMappingDirty(false);
            }}
          >
            Map CSV columns
          </button>
        </div>
        <KiteConnection
          expectedVersion={saved?.version ?? 0}
          disabled={busy || !saved || !currentReady}
          onPreview={(value) => {
            setPreview(value);
            setRemovalConsent(false);
            setConsent(true);
            setMessage('Broker capture ready. Review and confirm the changes.');
          }}
        />
        <UpstoxConnection
          expectedVersion={saved?.version ?? 0}
          disabled={busy || !saved || !currentReady}
          onPreview={(value) => {
            setPreview(value);
            setRemovalConsent(false);
            setConsent(true);
            setMessage('Upstox capture ready. Review and confirm the changes.');
          }}
        />
        <AngelConnection
          expectedVersion={saved?.version ?? 0}
          disabled={busy || !saved || !currentReady}
          onPreview={(value) => {
            setPreview(value);
            setRemovalConsent(false);
            setConsent(true);
            setMessage(
              'Angel One capture ready. Review and confirm the changes.',
            );
          }}
        />
        <BrokerImportGuide
          disabled={busy || !saved || !currentReady}
          onMap={() => {
            if (mode === 'mapped' || !discardRow()) return;
            beforeMapping.current = { mode, csv, workbook, draft };
            setRow({ isin: '', quantity: '', cost: '' });
            setEditingRow(null);
            setMode('mapped');
            setPreview(null);
            setMapped(null);
            setMappingDirty(false);
          }}
        />
        {mode === 'manual' && (
          <>
            <SmartHelp scope="holdings" />
            <form
              ref={rowEditor}
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  if (rowStep === 0) {
                    if (!validIndianIsin(row.isin.trim().toUpperCase()))
                      throw new Error(
                        'Enter a valid Indian ISIN from your statement.',
                      );
                    setRowStep(1);
                    return;
                  }
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
                  if (rowStep === 1) {
                    setRowStep(2);
                    return;
                  }
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
                  setRowStep(0);
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
              <fieldset disabled={busy || !saved || !currentReady}>
                <legend>
                  {editingRow === null ? 'Add a holding' : 'Edit holding'}
                </legend>
                <p className="badge">
                  Step {rowStep + 1} of 3 ·{' '}
                  {
                    [
                      'Identify the security',
                      'Enter your record',
                      'Review this holding',
                    ][rowStep]
                  }
                </p>
                <div className="form-grid">
                  {rowStep === 0 && (
                    <label className="field">
                      Security ISIN
                      <input
                        required
                        maxLength={12}
                        placeholder="12-character ISIN from your statement"
                        value={row.isin}
                        onChange={(e) =>
                          setRow({ ...row, isin: e.target.value })
                        }
                      />
                    </label>
                  )}
                  {rowStep === 1 && (
                    <>
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
                          onChange={(e) =>
                            setRow({ ...row, cost: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                {rowStep === 0 && (
                  <Assist
                    kind="holding"
                    onApply={(suggestion) => {
                      if (suggestion.kind !== 'holding' || !discardRow())
                        return;
                      setRow({
                        isin: suggestion.values.isin,
                        quantity: suggestion.values.quantity,
                        cost: goalMinorToRupees(
                          suggestion.values.totalCostMinor,
                        ),
                      });
                      const index = draft.findIndex(
                        (item) => item.isin === suggestion.values.isin,
                      );
                      setEditingRow(index < 0 ? null : index);
                      setRowStep(1);
                      setPreview(null);
                    }}
                  />
                )}
                {rowStep === 2 && (
                  <section aria-label="Holding row review">
                    <h3>{row.isin}</h3>
                    <p>
                      {row.quantity} units · total purchase cost INR {row.cost}
                    </p>
                    <p>
                      This is your entered record, not a current market
                      valuation. Add it to the draft, then review the complete
                      portfolio before saving.
                    </p>
                  </section>
                )}
                <p className="muted">
                  Use total cost for the whole holding, not the cost per share.
                  Up to two decimal places for rupees and six for quantity.
                </p>
                <div className="page-actions">
                  <button type="submit">
                    {rowStep < 2
                      ? ['Next: holding amounts', 'Review this holding'][
                          rowStep
                        ]
                      : editingRow === null
                        ? 'Add to draft'
                        : 'Update draft holding'}
                  </button>
                  {rowStep > 0 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setRowStep(rowStep - 1)}
                    >
                      Back a step
                    </button>
                  )}
                  {(editingRow !== null ||
                    row.isin ||
                    row.quantity ||
                    row.cost) && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        if (!discardRow()) return;
                        setEditingRow(null);
                        setRowStep(0);
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
                                setRowStep(0);
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
              Upload standard CSV or XLSX
              <input
                disabled={busy || !saved}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (
                    draftDirty() &&
                    !window.confirm(
                      'Replace your unsaved draft with this import file?',
                    )
                  ) {
                    event.target.value = '';
                    return;
                  }
                  void action(async () => {
                    if (file.name.toLowerCase().endsWith('.xlsx')) {
                      if (file.size > 65536)
                        throw Error('Choose an XLSX no larger than 64 KiB.');
                      const bytes = new Uint8Array(await file.arrayBuffer());
                      const parsed = await parseWorkbook(bytes);
                      setCsv(holdingsCsv(parsed.holdings));
                      setWorkbook(workbookBase64(bytes));
                      setPreview(null);
                      setMessage(
                        'Workbook reconciled. Inspect the normalized rows, then preview and confirm. Editing these rows switches to CSV and discards workbook provenance.',
                      );
                      return;
                    }
                    if (file.size > 50000)
                      throw new Error('Choose a CSV smaller than 50 KB.');
                    const text = await file.text();
                    setCsv(text);
                    setWorkbook(null);
                    setPreview(null);
                    setMessage(
                      'CSV loaded into your draft. Review before saving.',
                    );
                  });
                }}
              />
            </label>
            <section aria-label="Standard workbook templates">
              <h3>Start with our XLSX template</h3>
              <p>
                Use the Holdings and Reconciliation sheets. Enter a declared row
                count and acquisition-cost total in whole paise. Keep long
                numbers as text. Maximum 200 holdings and 64 KiB. Broker
                exports, formulas, hidden sheets and external links are
                unsupported.
              </p>
              {(['template', 'sample'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy || !saved}
                  onClick={() =>
                    void action(async () => {
                      const file = HoldingsTemplateSchema.parse(
                        await api(`/${kind}`),
                      );
                      setMessage(
                        await saveDownload(
                          new Blob([workbookBytes(file.base64) as BlobPart], {
                            type: file.mime,
                          }),
                          file.filename,
                        ),
                      );
                    })
                  }
                >
                  {kind === 'template'
                    ? 'Download blank XLSX template'
                    : 'Download synthetic XLSX sample'}
                </button>
              ))}
              {workbook && (
                <p role="status">
                  XLSX validated locally; declared totals match. Nothing saved
                  yet.
                </p>
              )}
            </section>
            <details>
              <summary>CSV format and units</summary>
              <p>
                Use exactly isin,quantity,total_cost_paise as the header. Each
                row contains an Indian ISIN, quantity, and total cost in whole
                paise (INR 100.00 = 10000 paise). Maximum 200 rows. Quoted
                fields, formulas, duplicate ISINs and extra columns are
                rejected. Use our standard XLSX template for workbooks;
                arbitrary broker formats remain unsupported.
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
                setWorkbook(null);
                setPreview(null);
              }}
            />
          </>
        )}
        {mode === 'mapped' && (
          <>
            <MappedCsvImport
              disabled={busy || !saved || !currentReady}
              onDirty={setMappingDirty}
              onReading={setMappingReading}
              onInvalidate={() => {
                setMapped(null);
                setPreview(null);
              }}
              onPrepared={(input, holdings) => {
                if (authDenied.current) return;
                setMapped(input);
                setCsv(holdingsCsv(holdings));
                setWorkbook(null);
                setPreview(null);
                setConsent(false);
                setError('');
              }}
              onCancel={() => {
                const prior = beforeMapping.current;
                if (
                  mappingDirty &&
                  !window.confirm(
                    'Discard this mapping and restore your previous holdings draft?',
                  )
                )
                  return;
                setMode(prior?.mode ?? 'manual');
                if (prior) {
                  setCsv(prior.csv);
                  setWorkbook(prior.workbook);
                  setDraft(prior.draft);
                }
                beforeMapping.current = null;
                setMapped(null);
                setMappingDirty(false);
                setPreview(null);
              }}
            />
            {mapped && (
              <>
                <label htmlFor="mapped-normalized">
                  Normalized mapped holdings
                </label>
                <textarea
                  id="mapped-normalized"
                  data-feedback-private
                  readOnly
                  rows={6}
                  value={csv}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Edit as standard CSV and discard the source mapping and reconciliation metadata?',
                      )
                    )
                      return;
                    setMode('csv');
                    setMapped(null);
                    setMappingDirty(false);
                    beforeMapping.current = null;
                    setPreview(null);
                  }}
                >
                  Edit normalized rows as standard CSV
                </button>
              </>
            )}
          </>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              if (!saved) throw new Error('Sign in and reload holdings first.');
              if (mode === 'mapped' && !mapped)
                throw Error(
                  'Prepare and reconcile your mapping before previewing.',
                );
              if (mode === 'manual' && (row.isin || row.quantity || row.cost))
                throw new Error(
                  'Add the holding to your draft or cancel its edit before reviewing.',
                );
              setRemovalConsent(false);
              const result = HoldingsPreviewSchema.parse(
                await api('/preview', {
                  ...(mode === 'mapped' && mapped
                    ? mapped
                    : mode === 'csv' && workbook
                      ? { format: 'xlsx', workbookBase64: workbook }
                      : { csv: mode === 'manual' ? holdingsCsv(draft) : csv }),
                  expectedVersion: saved.version,
                  storageConsent: consent,
                }),
              );
              if (!authDenied.current) setPreview(result);
            });
          }}
        >
          <fieldset
            disabled={
              busy ||
              mappingReading ||
              !saved ||
              !currentReady ||
              (mode === 'mapped' && !mapped)
            }
          >
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
      {!currentReady && saved && (
        <aside className="panel">
          <p role="status">
            Shown records are historical until Reload holdings succeeds. New
            previews are disabled.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await load(() => true, true);
              })
            }
          >
            Refresh baseline and keep draft
          </button>
        </aside>
      )}
      {preview && (
        <section aria-label="Holdings preview" className="panel">
          <SupplementalCostReceipt imported={preview.import} />
          {preview.import?.parserVersion === 'user-mapped-holdings-csv-v1' && (
            <p>
              User-mapped CSV totals reconciled:{' '}
              {preview.import.declaredRowCount} source rows,
              {preview.import.consolidatedRowCount} holdings;{' '}
              {preview.import.declaredTotalMinor} paise. Mapping selected by
              you; raw source columns and files are not stored.
            </p>
          )}
          {preview.import?.parserVersion === 'standard-holdings-xlsx-v1' && (
            <p>
              Workbook totals reconciled: {preview.import.declaredRowCount}{' '}
              rows; {preview.import.declaredTotalMinor} paise. Raw workbook
              bytes are not stored.
            </p>
          )}
          <h3>Review before replacing</h3>
          <HoldingsChangeReview
            preview={preview}
            acknowledged={removalConsent}
            onAcknowledge={setRemovalConsent}
          />
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
            disabled={
              busy ||
              !currentReady ||
              !preview.reconciliation ||
              (preview.reconciliation.changes.some(
                (c) => c.status === 'removed',
              ) &&
                !removalConsent)
            }
            onClick={() =>
              void action(async () => {
                const receipt = HoldingsSnapshotSchema.parse(
                  await api('/confirm', {
                    ...(removalConsent ? { acknowledgeRemovals: true } : {}),
                    previewId: preview.previewId,
                    expectedVersion: preview.expectedVersion,
                  }),
                );
                if (authDenied.current) return;
                setPreview(null);
                setCurrentReady(false);
                setConsent(false);
                setRemovalConsent(false);
                setHistory([]);
                setMessage(
                  `Holdings saved as revision ${receipt.version}. Reload is needed to confirm current records.`,
                );
                await load();
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
              <SupplementalCostReceipt imported={revision.import} />
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
