import { useEffect, useState } from 'react';
import {
  EquityCompaniesSchema,
  EquityCompanySchema,
  equityObservationKey,
  type EquityObservation,
} from '@fingent360/contracts';
import { json } from './net';
import './equity-coverage.css';

const families = [
  'identity',
  'price',
  'corporate-action',
  'fundamental',
  'classification',
] as const;
const labels = {
  identity: 'Exchange identity',
  price: 'Price & trading',
  'corporate-action': 'Corporate actions',
  fundamental: 'Reported financials',
  classification: 'Sector & index history',
};
function observationText(row: EquityObservation) {
  if (row.kind === 'identity')
    return `${row.name} · ${row.exchange}:${row.symbol} · series ${row.series} · face value ₹${row.faceValue}`;
  if (row.kind === 'price')
    return `Close ₹${row.close} · traded shares ${row.volume} · ${row.exchange} · unadjusted${row.udiff ? ` · ${row.udiff.symbol} · open ₹${row.udiff.open} · high ₹${row.udiff.high} · low ₹${row.udiff.low} · previous close ₹${row.udiff.previousClose}` : ''}`;
  if (row.kind === 'corporate-action')
    return `${row.purpose} · record date ${row.recordOn ?? 'not supplied'} · no portfolio adjustment applied`;
  if (row.kind === 'fundamental')
    return `${row.metric.replaceAll('-', ' ')}: ${row.value} ${row.scale} · ${row.basis} · ${row.audited ? 'audited' : 'unaudited'} · period ${row.periodStart}–${row.periodEnd}`;
  return `${row.sector} · ${row.index} · ${row.membership}${row.weightPercent === null ? ' · weight not supplied' : ` · weight ${row.weightPercent}%`}`;
}
export function EquityCoverage() {
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('equity'),
  );
  const [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [after, setAfter] = useState<string | undefined>(),
    [retry, setRetry] = useState(0);
  const [list, setList] = useState<ReturnType<
      typeof EquityCompaniesSchema.parse
    > | null>(null),
    [detail, setDetail] = useState<ReturnType<
      typeof EquityCompanySchema.parse
    > | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    const pop = () =>
      setSelected(new URLSearchParams(location.search).get('equity'));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  function choose(value: string | null) {
    const url = new URL(location.href);
    if (value) url.searchParams.set('equity', value);
    else url.searchParams.delete('equity');
    history.pushState(null, '', url);
    setSelected(value);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selected) choose(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setDetail(null);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (after) params.set('after', after);
    void json(
      selected
        ? `/equities/${encodeURIComponent(selected)}`
        : `/equities?${params}`,
      undefined,
      'GET',
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        if (selected) setDetail(EquityCompanySchema.parse(data));
        else setList(EquityCompaniesSchema.parse(data));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'Company evidence unavailable.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [selected, search, after, retry]);
  return (
    <section className="equity-coverage" aria-label="Indian equity evidence">
      <header>
        <p className="eyebrow">COMPANIES · SOURCE RECORDS</p>
        <h1>
          {selected
            ? (detail?.name ?? selected)
            : 'Understand the company behind the symbol'}
        </h1>
        <p>
          Exchange identities, reported financials and dated market evidence.
          Missing data stays visible; these records do not change your holdings.
        </p>
      </header>
      {selected ? (
        <button type="button" onClick={() => choose(null)}>
          ← All companies
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAfter(undefined);
            setSearch(q);
          }}
        >
          <label htmlFor="equity-search">Company, symbol or ISIN</label>
          <div className="equity-search">
            <input
              id="equity-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={100}
            />
            <button type="submit">Search</button>
          </div>
        </form>
      )}
      {busy ? (
        <p role="status">Loading reviewed evidence…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry(retry + 1)}>Retry evidence</button>
        </div>
      ) : detail ? (
        <>
          <p>{detail.isin} · retained editions; original precision preserved</p>
          {detail.truncated && (
            <p role="status">
              Only the newest 1,000 records are included in this view.
            </p>
          )}
          {families.map((kind) => {
            const rows = detail.records.filter(
              (r) => r.observation.kind === kind,
            );
            const keys = rows.map((r) => equityObservationKey(r.observation));
            return (
              <section
                className="equity-family"
                key={kind}
                aria-label={labels[kind]}
              >
                <h2>{labels[kind]}</h2>
                {!rows.length ? (
                  <p className="equity-missing">
                    No reviewed {labels[kind].toLowerCase()} available yet.
                  </p>
                ) : (
                  <>
                    {new Set(keys).size < keys.length && (
                      <p role="status">
                        Multiple editions cover the same observation. Compare
                        their dates and sources before using a value.
                      </p>
                    )}
                    {rows.map((record, i) => (
                      <article
                        key={`${record.editionId}:${record.observation.sourceRow}:${i}`}
                      >
                        <time dateTime={record.observation.effectiveOn}>
                          {record.observation.effectiveOn}
                        </time>
                        <p>{observationText(record.observation)}</p>
                        {record.observation.kind === 'price' &&
                          Date.now() -
                            Date.parse(record.observation.effectiveOn) >
                            7 * 86400000 && (
                            <p className="equity-missing">
                              Historical price; not a current quote.
                            </p>
                          )}
                        <details>
                          <summary>Source & edition</summary>
                          <p>
                            Captured {record.retrievedAt}. Published{' '}
                            {record.publishedAt ?? 'time not supplied'}.
                          </p>
                          <a
                            href={record.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Original source
                          </a>
                          <p>
                            Source row {record.observation.sourceRow} · edition{' '}
                            {record.editionId}
                          </p>
                          <code>{record.hash}</code>
                        </details>
                      </article>
                    ))}
                  </>
                )}
              </section>
            );
          })}
          <a href="#holdings">View my holdings</a>
        </>
      ) : (
        <>
          <p>{list?.companies.length ?? 0} companies on this page</p>
          <div className="equity-company-list">
            {list?.companies.map((row) => (
              <button key={row.isin} onClick={() => choose(row.isin)}>
                <strong>{row.name}</strong>
                <span>{row.isin} →</span>
              </button>
            ))}
          </div>
          {!list?.companies.length && (
            <p>
              No reviewed evidence matches. Try another search, or return after
              source review is complete.
            </p>
          )}
          <nav aria-label="Company pages">
            {after && (
              <button onClick={() => setAfter(undefined)}>First page</button>
            )}
            {list?.nextAfter && (
              <button onClick={() => setAfter(list.nextAfter!)}>
                Next companies
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
