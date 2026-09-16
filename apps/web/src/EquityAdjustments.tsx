import { useEffect, useRef, useState } from 'react';
import {
  AdjustmentPublicSchema,
  AdjustmentWindowSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
export function AdjustmentWindowView({
  window,
}: {
  window: ReturnType<typeof AdjustmentWindowSchema.parse>;
}) {
  return (
    <article>
      <h3>
        {window.windowStart} to {window.windowEnd}
      </h3>
      <p>
        Independently reviewed source-window normalization · reviewed{' '}
        {window.reviewedAt ?? 'Not yet published'}
      </p>
      <p>
        Raw exchange closes remain unchanged. This versioned research
        normalization is not an exchange adjusted series or reinvested total
        return.
      </p>
      <p>{window.coverageEvidence}</p>
      <a href={window.sourceUrl} target="_blank" rel="noreferrer">
        Exchange corporate-action source
      </a>
      <details>
        <summary>Adjustment factors and source coverage</summary>
        {window.factors.length === 0 ? (
          <p>
            Complete-window review records no in-window actions requiring a
            factor.
          </p>
        ) : (
          window.factors.map((factor) => (
            <p key={factor.exOn}>
              {factor.exOn}: {factor.purpose} · historical factor{' '}
              {factor.numerator}/{factor.denominator}
              {factor.referenceOn
                ? ` · reference close ${factor.referenceClose} on ${factor.referenceOn}`
                : ''}
            </p>
          ))
        )}
        <p>
          Retained export hash {window.sourceHash} ·{' '}
          {window.retainedBindings.length} bound source editions
        </p>
      </details>
      <details>
        <summary>Compare raw and normalized closes</summary>
        {window.prices.map((point) => (
          <p key={point.date}>
            {point.date}: raw ₹{point.rawClose} → normalized ₹
            {point.normalizedClose}
          </p>
        ))}
      </details>
    </article>
  );
}
export function EquityAdjustments({ isin }: { isin: string }) {
  const [data, setData] = useState<ReturnType<
      typeof AdjustmentPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load() {
    const current = ++generation.current;
    setError('');
    setData(null);
    setBusy(true);
    try {
      const value = AdjustmentPublicSchema.parse(
        await json(`/equity-adjustments/${isin}`),
      );
      if (current === generation.current) setData(value);
    } catch (cause) {
      if (current === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load normalization coverage.',
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [isin]);
  return (
    <section
      className="source-workflow"
      aria-label="Reviewed price normalization"
      aria-busy={busy}
    >
      <h2>Compare prices across corporate actions</h2>
      {busy && <p role="status">Loading normalization coverage…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Reload normalization coverage
      </button>
      {data?.windows.length === 0 && (
        <p>
          No currently admitted complete-window normalization. Raw closes remain
          unadjusted.
        </p>
      )}
      {data?.windows.map((window) => (
        <AdjustmentWindowView key={window.id} window={window} />
      ))}
    </section>
  );
}
