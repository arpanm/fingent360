import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  IndexLevelEditionSchema,
  IndexLevelPublicSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function IndexLevelEdition({
  edition,
}: {
  edition: ReturnType<typeof IndexLevelEditionSchema.parse>;
}) {
  return (
    <article>
      <h2>Price indices on {edition.effectiveOn}</h2>
      <p>{edition.interpretation}</p>
      <p>
        Units: index points. Retrieved {edition.retrievedAt}.{' '}
        {edition.reviewedAt
          ? `Independently reviewed ${edition.reviewedAt}.`
          : 'Awaiting independent review.'}
      </p>
      <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
        Original dated index snapshot
      </a>
      {edition.rows.map((row) => (
        <details key={row.name}>
          <summary>
            {row.name} · close {row.close} points
          </summary>
          <dl>
            {[
              ['Open', row.open],
              ['High', row.high],
              ['Low', row.low],
              ['Close', row.close],
              ['Points change', row.pointsChange],
              ['Change (%)', row.percentChange],
              ['Volume', row.volume],
              ['Turnover (INR crore)', row.turnoverCroreInr],
              ['P/E', row.pe],
              ['P/B', row.pb],
              ['Dividend yield (%)', row.dividendYieldPercent],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            Original source row {row.sourceRow}. Source index name: {row.name}.
          </p>
        </details>
      ))}
      <details>
        <summary>Source provenance</summary>
        <p>
          Capture {edition.id}. SHA-256 of original CSV: {edition.sourceHash}.
          Parser {edition.policy}.
        </p>
      </details>
    </article>
  );
}
export function IndexLevels() {
  const [data, setData] = useState<ReturnType<
    typeof IndexLevelPublicSchema.parse
  > | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  async function load(before?: string) {
    const turn = ++epoch.current;
    setBusy(true);
    setError('');
    if (!before) setData(null);
    try {
      const next = IndexLevelPublicSchema.parse(
        await json(`/index-levels${before ? '?before=' + before : ''}`),
      );
      if (turn === epoch.current)
        setData((old) =>
          before && old
            ? { ...next, editions: [...old.editions, ...next.editions] }
            : next,
        );
    } catch (cause) {
      if (turn === epoch.current)
        setError(
          cause instanceof Error ? cause.message : 'Index history unavailable.',
        );
    } finally {
      if (turn === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, []);
  return (
    <main
      className="source-workflow"
      aria-label="Daily index history"
      aria-busy={busy}
    >
      <a href="#explore">Back to Explore</a>
      <h1>Daily price-index history</h1>
      <p>
        Reviewed Nifty50, Nifty Bank and Nifty IT snapshots. These levels
        exclude reinvested dividends; dates without an admitted snapshot are not
        filled or inferred.
      </p>
      {busy && <p role="status">Loading reviewed index history…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh index history
      </button>
      {data?.editions.length === 0 && (
        <p>
          No permitted and independently reviewed index snapshots are available.
        </p>
      )}
      {data?.editions.map((edition) => (
        <IndexLevelEdition key={edition.id} edition={edition} />
      ))}
      {data?.nextBefore && (
        <button disabled={busy} onClick={() => void load(data.nextBefore!)}>
          Load older index dates
        </button>
      )}
    </main>
  );
}
