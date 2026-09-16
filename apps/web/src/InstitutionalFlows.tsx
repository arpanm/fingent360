import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  InstitutionalFlowEditionSchema,
  InstitutionalFlowPublicSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function InstitutionalFlowEdition({
  edition,
}: {
  edition: ReturnType<typeof InstitutionalFlowEditionSchema.parse>;
}) {
  return (
    <article>
      <h2>
        {edition.source === 'nse-cash-html'
          ? 'Exchange provisional cash activity'
          : 'Depository investment and derivatives reports'}
      </h2>
      <p>
        Captured {edition.retrievedAt} ·{' '}
        {edition.reviewedAt
          ? 'reviewed ' + edition.reviewedAt
          : 'awaiting independent review'}
      </p>
      {edition.reviewedAt && (
        <p>
          <a href={'#read/institutional-flow-' + edition.id}>
            Read this reviewed report
          </a>
        </p>
      )}
      <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
        Official flow source
      </a>
      {edition.datasets.map((dataset) => (
        <section key={dataset.scope} aria-label={dataset.scope}>
          <h3>
            {dataset.scope} · {dataset.effectiveOn}
          </h3>
          <p>
            {dataset.dateMeaning === 'trade-date-provisional'
              ? 'Provisional trade date; custodial confirmations and physical settlement can change this record.'
              : dataset.dateMeaning === 'custodian-reporting-date'
                ? 'Custodian reporting date; underlying trades can be from earlier trading days.'
                : 'Exchange reporting date; this report describes prior trading-day activity/positions.'}
          </p>
          {Date.now() - Date.parse(dataset.effectiveOn + 'T00:00:00Z') >
            7 * 86400000 && (
            <p role="status">
              Historical report: its reporting date is more than seven days old.
              A recent capture does not make it current.
            </p>
          )}
          <p>Amounts: INR crore. Reconciliation: {dataset.reconciliation}.</p>
          {dataset.kind === 'nse-cash' ? (
            dataset.rows.map((row) => (
              <p key={row.participant}>
                {row.participant}: purchases {row.buy} · sales {row.sell} · net{' '}
                {row.net}
              </p>
            ))
          ) : dataset.kind === 'cdsl-investment' ? (
            <>
              <p>
                Provider conversion: {dataset.usdInr} INR per USD. USD millions
                remain the provider's rounded figures.
              </p>
              {dataset.rows.map((row) => (
                <details key={row.asset + row.route}>
                  <summary>
                    {row.asset} · {row.route}: net {row.net} crore
                  </summary>
                  <p>
                    Gross purchases {row.buy}; gross sales {row.sell}; reported
                    net USD million {row.netUsdMillion}.
                  </p>
                </details>
              ))}
            </>
          ) : (
            dataset.rows.map((row) => (
              <details key={row.product}>
                <summary>{row.product} activity and open interest</summary>
                <p>
                  Buy: {row.buyContracts} contracts, {row.buyAmount} crore.
                  Sell: {row.sellContracts} contracts, {row.sellAmount} crore.
                </p>
                <p>
                  Open interest: {row.openContracts} contracts, {row.openAmount}{' '}
                  crore. Open interest is a stock, not daily cash flow; options
                  may hedge other positions.
                </p>
              </details>
            ))
          )}
        </section>
      ))}
      <details>
        <summary>Retained provenance</summary>
        <p>
          Original UTF-8 body hash {edition.bodyHash}; capture hash{' '}
          {edition.sourceHash}; parser {edition.parser}.
        </p>
      </details>
    </article>
  );
}
export function InstitutionalFlows() {
  const [value, setValue] = useState<ReturnType<
      typeof InstitutionalFlowPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  async function load() {
    const ticket = ++epoch.current;
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const data = InstitutionalFlowPublicSchema.parse(
        await json('/institutional-flows'),
      );
      if (ticket === epoch.current) setValue(data);
    } catch (cause) {
      if (ticket === epoch.current)
        setError(cause instanceof Error ? cause.message : 'Flows unavailable.');
    } finally {
      if (ticket === epoch.current) setBusy(false);
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
      aria-label="Institutional flows"
      aria-busy={busy}
    >
      <a href="#explore">Back to Explore</a>
      <h1>Different institutions, different measures</h1>
      <p>
        NSE-only activity is included in combined exchange activity. Do not add
        these overlapping reports. Depository investment includes primary-market
        routes and debt; derivatives activity and open interest are separate.
        None is a portfolio recommendation.
      </p>
      <a href="#positioning">Inspect participant positioning separately</a>
      {busy && <p role="status">Loading reviewed institutional reports…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh institutional reports
      </button>
      {value && !value.editions.length && (
        <p>
          No permitted, independently reviewed institutional reports available.
        </p>
      )}
      {value?.editions.map((edition) => (
        <InstitutionalFlowEdition key={edition.id} edition={edition} />
      ))}
      <p>
        NSDL direct ingestion is not enabled. Historical publication coverage is
        limited to retained editions; offline snapshots cannot know later
        withdrawals until refreshed.
      </p>
    </main>
  );
}
