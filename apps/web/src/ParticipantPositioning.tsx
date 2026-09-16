import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  PositioningEditionSchema,
  PositioningPublicSchema,
  OI_FIELDS,
} from '@fingent360/contracts';
import { json } from './net';
export function PositioningEdition({
  edition,
}: {
  edition: ReturnType<typeof PositioningEditionSchema.parse>;
}) {
  return (
    <article>
      <h2>Positions on {edition.effectiveOn}</h2>
      <p>{edition.interpretation}</p>
      <p>
        Units: contracts. Retrieved {edition.retrievedAt}.{' '}
        {edition.reviewedAt
          ? 'Independently reviewed ' + edition.reviewedAt
          : 'Awaiting independent review.'}
      </p>
      <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
        Original dated NSE OI file
      </a>
      {edition.rows.map((row) => (
        <details key={row.participant}>
          <summary>{row.participant} contract breakdown</summary>
          <dl>
            {OI_FIELDS.map((field, index) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>{row.counts[index]}</dd>
              </div>
            ))}
          </dl>
          <p>
            Index futures only: {row.counts[0]} long and {row.counts[1]} short.
            Options may hedge other positions; contract counts do not measure
            net exposure or cash buying.
          </p>
        </details>
      ))}
      <details>
        <summary>Source and reconciliation</summary>
        <p>
          Source hash {edition.sourceHash}. All participant totals, category
          totals and exchange-wide long/short pairs reconcile. {edition.policy}
        </p>
      </details>
    </article>
  );
}
export function ParticipantPositioning() {
  const [data, setData] = useState<ReturnType<
      typeof PositioningPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  async function load() {
    const id = ++epoch.current;
    setData(null);
    setError('');
    setBusy(true);
    try {
      const next = PositioningPublicSchema.parse(await json('/positioning'));
      if (id === epoch.current) setData(next);
    } catch (cause) {
      if (id === epoch.current)
        setError(
          cause instanceof Error ? cause.message : 'Could not load positions.',
        );
    } finally {
      if (id === epoch.current) setBusy(false);
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
      aria-label="Participant positioning"
      aria-busy={busy}
    >
      <a href="#explore">Back to Explore</a>
      <h1>Who holds open contracts?</h1>
      <p>
        Derivatives positioning is separate from provisional cash-market flows
        and final FPI investment. Inspect each instrument and each side; there
        is no bullishness score.
      </p>
      {busy && <p role="status">Loading reviewed positioning…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh positioning
      </button>
      {data?.editions.length === 0 && (
        <p>No permitted and reviewed positioning files are available.</p>
      )}
      {data?.editions.map((edition) => (
        <PositioningEdition key={edition.id} edition={edition} />
      ))}
    </main>
  );
}
