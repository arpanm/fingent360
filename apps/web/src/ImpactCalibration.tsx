import { AdjustmentWindowView } from './EquityAdjustments';
import { useEffect, useRef, useState } from 'react';
import {
  ImpactCalibrationListSchema,
  ImpactCalibrationReceiptSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function ImpactCalibration({ isins }: { isins: string[] }) {
  const pending = useRef<string | null>(null);
  const [isin, setIsin] = useState(''),
    [list, setList] = useState<
      ReturnType<typeof ImpactCalibrationListSchema.parse>
    >({ receipts: [] }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false);
  async function load() {
    setError('');
    try {
      setList(
        ImpactCalibrationListSchema.parse(
          await json('/account/impact-calibrations'),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Calibration history unavailable.',
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    setError('');
    try {
      pending.current ??= crypto.randomUUID();
      ImpactCalibrationReceiptSchema.parse(
        await json(
          '/account/impact-calibrations/' + pending.current,
          { isin, storageConsent: true },
          'PUT',
        ),
      );
      pending.current = null;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calibration unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Historical sensitivity diagnostics" className="panel">
      <h2>Historical sensitivity diagnostics</h2>
      <p>
        Compare company daily price returns with INR/USD reference-rate changes.
        This is descriptive evidence, not a causal model or a portfolio
        forecast. The receipt records missing data and adjustment requirements.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Calibration holding
        <select
          aria-label="Calibration holding"
          disabled={busy}
          value={isin}
          onChange={(e) => {
            setIsin(e.target.value);
            setConsent(false);
            pending.current = null;
          }}
        >
          <option value="">Choose saved holding</option>
          {isins.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Save this private source-bound diagnostic receipt.
      </label>
      <button disabled={busy || !isin || !consent} onClick={() => void save()}>
        {busy ? 'Saving diagnostic…' : 'Calculate and save diagnostic'}
      </button>
      <button disabled={busy} onClick={() => void load()}>
        Refresh calibration history
      </button>
      {!list.receipts.length && <p>No saved calibrations.</p>}
      {list.receipts.map((receipt) => (
        <article key={receipt.id}>
          <h3>
            {receipt.input.isin} · {receipt.result.status}
          </h3>
          <p>
            {receipt.result.pairs} paired returns ·{' '}
            {receipt.result.firstOn ?? 'No common history'} to{' '}
            {receipt.result.lastOn ?? 'unavailable'}
          </p>
          {receipt.result.fit && (
            <p>
              Descriptive slope {receipt.result.fit.slope.toFixed(4)};
              conditional normal interval{' '}
              {receipt.result.fit.conditionalNormalInterval
                .map((v) => v.toFixed(4))
                .join(' to ')}
              . This interval is not qualified causal confidence.
            </p>
          )}
          {receipt.adjustmentCoverage && (
            <AdjustmentWindowView window={receipt.adjustmentCoverage} />
          )}
          <ul>
            {receipt.result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <details>
            <summary>Retained source editions</summary>
            <p>
              ECB edition {receipt.factor.edition?.edition ?? 'unavailable'} ·{' '}
              {receipt.factor.edition?.sourceHash ?? 'no admitted source'}
            </p>
            <p>
              {receipt.equity?.records.length ?? 0} retained company records ·
              captured {receipt.createdAt}
            </p>
          </details>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void json(
                '/account/impact-calibrations/' + receipt.id,
                undefined,
                'DELETE',
              )
                .then(load)
                .catch((e) =>
                  setError(e instanceof Error ? e.message : 'Delete failed.'),
                )
                .finally(() => setBusy(false));
            }}
          >
            Delete calibration {receipt.id.slice(0, 8)}
          </button>
        </article>
      ))}
    </section>
  );
}
