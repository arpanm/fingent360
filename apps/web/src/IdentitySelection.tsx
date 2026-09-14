import { useEffect, useRef, useState } from 'react';
import {
  IdentitySelectionPublicSchema,
  IdentitySelectionHistorySchema,
} from '@fingent360/contracts';
import { json } from './net';
export function IdentitySelection({ isin }: { isin: string }) {
  const [value, setValue] = useState<ReturnType<
    typeof IdentitySelectionPublicSchema.parse
  > | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof IdentitySelectionHistorySchema.parse
  > | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyGeneration = useRef(0);
  const generation = useRef(0);
  useEffect(() => {
    const ticket = ++generation.current;
    historyGeneration.current++;
    setHistoryBusy(false);
    setValue(null);
    setHistory(null);
    setError('');
    void json('/securities/' + isin + '/selection')
      .then((raw) => {
        const parsed = IdentitySelectionPublicSchema.parse(raw);
        if (parsed.isin !== isin) throw Error('Wrong identity selection.');
        if (ticket === generation.current) setValue(parsed);
      })
      .catch(() => {
        if (ticket === generation.current)
          setError('Reviewed selection unavailable. Retry.');
      });
    return () => {
      generation.current++;
      historyGeneration.current++;
    };
  }, [isin, retry]);
  async function historyPage(before?: number) {
    if (historyBusy) return;
    const ticket = ++historyGeneration.current,
      owner = generation.current;
    setHistoryBusy(true);
    setError('');
    try {
      const result = IdentitySelectionHistorySchema.parse(
        await json(
          '/securities/' +
            isin +
            '/selection/history' +
            (before ? '?before=' + before : ''),
        ),
      );
      if (result.receipts.some((receipt) => receipt.isin !== isin))
        throw Error('Wrong selection history.');
      if (ticket === historyGeneration.current && owner === generation.current)
        setHistory(result);
    } catch {
      if (ticket === historyGeneration.current && owner === generation.current)
        setError('Selection history unavailable. Retry.');
    } finally {
      if (ticket === historyGeneration.current && owner === generation.current)
        setHistoryBusy(false);
    }
  }
  return (
    <section
      aria-label="Reviewed candidate selection"
      style={{ minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <h3>Reviewed candidate selection</h3>
      <p>
        Editorial judgement among retained provider candidates, not externally
        verified corporate identity. Provider ambiguity remains unchanged.
      </p>
      {!value && !error && <p role="status">Loading reviewed selection…</p>}
      {historyBusy && <p role="status">Loading selection history…</p>}
      {history && !historyBusy && !history.receipts.length && (
        <p role="status">No reviewed selection history yet.</p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry(retry + 1)}>
            Retry reviewed selection
          </button>
        </p>
      )}
      {value && (
        <>
          <p>Selection status: {value.state}.</p>
          {value.receipt && (
            <>
              <p>
                {value.receipt.candidate.name} · {value.receipt.candidate.figi}
              </p>
              <p>{value.receipt.rationale}</p>
              <p>
                Selection revision {value.receipt.version}, provider revision{' '}
                {value.receipt.providerVersion}. Reviewed{' '}
                <time dateTime={value.receipt.reviewedAt}>
                  {new Date(value.receipt.reviewedAt).toLocaleString()}
                </time>
                .
              </p>
              {value.state !== 'current' && (
                <p>
                  This historical selection cannot be used in new event context.
                </p>
              )}
            </>
          )}
          <button disabled={historyBusy} onClick={() => void historyPage()}>
            Read selection history
          </button>
        </>
      )}
      {history?.receipts.map((receipt) => (
        <article key={receipt.version}>
          <p>
            Revision {receipt.version}: {receipt.status} ·{' '}
            {receipt.candidate.figi}
          </p>
          <p>{receipt.rationale}</p>
          <time dateTime={receipt.reviewedAt}>
            {new Date(receipt.reviewedAt).toLocaleString()}
          </time>
        </article>
      ))}
      {history?.nextBefore && (
        <button
          disabled={historyBusy}
          onClick={() => void historyPage(history.nextBefore!)}
        >
          Older selection history
        </button>
      )}
    </section>
  );
}
