import { useEffect, useRef, useState } from 'react';
import {
  ConsolidationPublicSchema,
  ConsolidationReceiptSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
export function ConsolidationView({
  receipt: r,
}: {
  receipt: ReturnType<typeof ConsolidationReceiptSchema.parse>;
}) {
  return (
    <article aria-label={`Consolidation ${r.oldIsin} to ${r.newIsin}`}>
      <h3>Share consolidation</h3>
      <p>
        {r.oldIsin} → {r.newIsin}
      </p>
      <p>
        Record date {r.recordOn}. Old trading ended {r.lastOldTradeOn};
        suspended from {r.suspendedOn}; new trading resumed {r.resumedOn}.
      </p>
      <p>
        Face value ₹{r.oldFaceValue} → ₹{r.newFaceValue}. Nominal historical
        comparison factor {r.numerator}/{r.denominator}.
      </p>
      <p>
        Last old raw close ₹{r.oldClose}; expressed per new share ₹
        {r.oldCloseInNewShareUnits}. First new raw close ₹{r.newClose}.
      </p>
      <p>
        This comparison is not a daily return or an exchange adjusted quote.
        Trading was suspended; this transition is ineligible for daily-return
        calibration. Your holdings and fractional entitlements have not been
        changed.
      </p>
      <p>{r.coverageEvidence}</p>
      <details>
        <summary>Original notices and review</summary>
        <p>
          Reviewed {r.reviewedAt ?? 'Not yet published'} · {r.policy}
        </p>
        {r.documents.map((d) => (
          <section key={d.role}>
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.role} original notice
            </a>
            <p>
              Published {d.publishedOn}; page {d.page}. Source hash {d.hash}
            </p>
            <p>{d.transcription}</p>
          </section>
        ))}
        <p>Receipt source {r.sourceHash}</p>
      </details>
    </article>
  );
}
export function EquityConsolidations({ isin }: { isin: string }) {
  const [data, setData] = useState<ReturnType<
      typeof ConsolidationPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    epoch = useRef(0);
  async function load() {
    const token = ++epoch.current;
    setData(null);
    setError('');
    setBusy(true);
    try {
      const value = ConsolidationPublicSchema.parse(
        await json(`/equity-consolidations/${isin}`),
      );
      if (token === epoch.current) setData(value);
    } catch (cause) {
      if (token === epoch.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Consolidation evidence unavailable.',
        );
    } finally {
      if (token === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, [isin]);
  return (
    <section
      className="source-workflow"
      aria-label="Reviewed share consolidations"
      aria-busy={busy}
    >
      <h2>Security changes</h2>
      {busy && <p role="status">Loading security changes…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Reload consolidation evidence
      </button>
      {data?.bridges.length === 0 && (
        <p>No reviewed consolidation bridge available for this security.</p>
      )}
      {data?.bridges.map((r) => (
        <ConsolidationView key={r.id} receipt={r} />
      ))}
    </section>
  );
}
