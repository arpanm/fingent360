import { useEffect, useRef, useState } from 'react';
import {
  OIL_BENCHMARK_HOME,
  OIL_BENCHMARK_TERMS,
  OIL_BENCHMARK_LICENSE,
  OIL_BENCHMARK_CATALOGUE,
  OIL_BENCHMARK_ATTRIBUTION,
  oilBenchmarkNames,
  oilBenchmarkTimeline,
  OilBenchmarkPublicSchema,
  OilBenchmarkHistorySchema,
  OilBenchmarkEditionSchema,
  OilBenchmarkEvidenceSchema,
  type OilBenchmarkEdition,
  type OilBenchmarkPublic,
} from '@fingent360/contracts';
import { json } from './net';
import { returnTo, restorePosition } from './navigation';
import './oil-benchmarks.css';

export function OilEdition({
  edition,
  sourceDetails = false,
}: {
  edition: OilBenchmarkEdition;
  sourceDetails?: boolean;
}) {
  const years = [
    ...new Set(edition.observations.map((row) => row.period.slice(0, 4))),
  ]
    .sort()
    .reverse();
  const [year, setYear] = useState(years[0] ?? 'all');
  const selectedYear =
    year === 'all' || years.includes(year) ? year : years[0]!;
  const observations = edition.observations.filter(
    (row) =>
      selectedYear === 'all' || row.period.startsWith(selectedYear + '-'),
  );
  const periods = [...new Set(observations.map((row) => row.period))]
    .sort()
    .reverse();
  const byKey = new Map(
    observations.map((row) => [`${row.series}/${row.period}`, row] as const),
  );
  return (
    <section aria-label={`Numerical edition ${edition.edition}`}>
      <p>
        Retrieval edition {edition.edition} · retrieved {edition.retrievedAt}.
      </p>
      <p>
        Monthly nominal USD per barrel. Workbook updated{' '}
        {edition.reportedUpdatedOn}; exact release time is unknown. This is a
        retrieval revision, not a historical as-of vintage. Values use the
        workbook's one-decimal display precision.
      </p>
      <label htmlFor={`oil-year-${edition.edition}`}>Observation year</label>
      <select
        id={`oil-year-${edition.edition}`}
        value={selectedYear}
        onChange={(event) => setYear(event.target.value)}
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        <option value="all">All years (full record)</option>
      </select>
      {!periods.length && <p>No observations for this year.</p>}
      <div className="table-scroll">
        <table className="data-table">
          <caption>Reported monthly oil benchmarks from January 2000</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Brent (USD/barrel)</th>
              <th scope="col">WTI (USD/barrel)</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period}>
                <th scope="row">{period}</th>
                <td>{byKey.get(`BRENT/${period}`)?.value ?? 'Not reported'}</td>
                <td>{byKey.get(`WTI/${period}`)?.value ?? 'Not reported'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sourceDetails && (
        <details>
          <summary>Source cell precision for selected year</summary>
          <p>
            The saved lexical text may include spreadsheet storage tails.
            Displayed values use exact decimal rounding to the source's
            one-decimal format.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <caption>Original selected source cell text</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Brent source text</th>
                  <th scope="col">WTI source text</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period}>
                    <th scope="row">{period}</th>
                    <td>
                      {byKey.get(`BRENT/${period}`)?.sourceValue ?? 'Missing'}
                    </td>
                    <td>
                      {byKey.get(`WTI/${period}`)?.sourceValue ?? 'Missing'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
type Result = {
  route: string;
  current?: OilBenchmarkPublic;
  history?: ReturnType<typeof OilBenchmarkHistorySchema.parse>;
  edition?: OilBenchmarkEdition;
};
export function OilBenchmarks({
  route = 'oil-benchmarks',
}: {
  route?: string;
}) {
  const [data, setData] = useState<Result | null>(null),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(true),
    [reload, setReload] = useState(0);
  const generation = useRef(0),
    live = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const view = route.split('/')[1],
    id = route.split('/')[2];
  useEffect(() => {
    live.current = true;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setData(null);
    void (async () => {
      let value: Result;
      if (route === 'oil-benchmarks')
        value = {
          route,
          current: OilBenchmarkPublicSchema.parse(
            await json('/oil-benchmarks'),
          ),
        };
      else if (route === 'oil-benchmarks/history')
        value = {
          route,
          history: OilBenchmarkHistorySchema.parse(
            await json('/oil-benchmarks/history'),
          ),
        };
      else if (
        /^oil-benchmarks\/(edition|evidence)\/[1-9][0-9]{0,8}$/.test(route)
      ) {
        const result = await json(
          `/oil-benchmarks/${view === 'evidence' ? 'evidence' : 'editions'}/${id}`,
        );
        value = {
          route,
          edition:
            view === 'evidence'
              ? OilBenchmarkEvidenceSchema.parse(result).edition
              : OilBenchmarkEditionSchema.parse(result),
        };
      } else throw Error('This oil-benchmark view is unavailable.');
      if (live.current && ticket === generation.current) setData(value);
    })()
      .catch((failure: unknown) => {
        if (live.current && ticket === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Oil benchmarks unavailable. Retry.',
          );
      })
      .finally(() => {
        if (live.current && ticket === generation.current) {
          setBusy(false);
          if (view) heading.current?.focus({ preventScroll: true });
          else restorePosition(route);
        }
      });
    return () => {
      live.current = false;
      generation.current++;
    };
  }, [route, reload, view, id]);
  const visible = data?.route === route ? data : null;
  return (
    <section className="oil-benchmarks" aria-label="Oil benchmarks">
      {view && (
        <button
          className="text-link back-control"
          aria-label="Back to previous oil-benchmark view"
          onClick={() => returnTo('oil-benchmarks')}
        >
          Back
        </button>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {view === 'history'
          ? 'Reviewed retrieval history'
          : view === 'evidence'
            ? 'Oil-benchmark evidence'
            : 'Oil benchmarks'}
      </h1>
      <p>
        Global oil-price context for learning. Monthly averages are not
        end-of-day quotes, Indian landed costs, currency conversions or
        predictions about a holding.
      </p>
      <p>
        {OIL_BENCHMARK_ATTRIBUTION}{' '}
        <a href={OIL_BENCHMARK_HOME} target="_blank" rel="noopener noreferrer">
          Open World Bank original (new tab)
        </a>
        {' · '}
        <a
          href={OIL_BENCHMARK_CATALOGUE}
          target="_blank"
          rel="noopener noreferrer"
        >
          Dataset and attribution (new tab)
        </a>
        {' · '}
        <a
          href={OIL_BENCHMARK_LICENSE}
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY 4.0 (new tab)
        </a>
        {' · '}
        <a href={OIL_BENCHMARK_TERMS} target="_blank" rel="noopener noreferrer">
          Reuse terms (new tab)
        </a>
      </p>
      <p>
        We extract two monthly series and round source cell text exactly to the
        workbook's one-decimal display, with ties away from zero. No World Bank
        endorsement is implied.
      </p>
      <button disabled={busy} onClick={() => setReload((value) => value + 1)}>
        {error ? 'Retry oil benchmarks' : 'Reload oil benchmarks'}
      </button>
      {busy && <p role="status">Reading reviewed oil benchmarks…</p>}
      {error && <p role="alert">{error}</p>}
      {visible?.current && (
        <>
          {visible.current.status !== 'published' ? (
            <p role="status">
              {visible.current.status === 'withdrawn'
                ? 'This oil-benchmark source was withdrawn. Current values, history and evidence are unavailable.'
                : 'No reviewed monthly oil edition is available yet.'}
            </p>
          ) : (
            <>
              <p>
                Viewed on {visible.current.evaluatedOn} (UTC). Reviewed{' '}
                {visible.current.reviewedAt}. Source last retrieved{' '}
                {visible.current.checkedAt ?? 'unknown'}; this reviewed edition
                captured {visible.current.edition!.retrievedAt}.
              </p>
              <p>
                Latest reviewed monthly observations in this captured edition;
                workbook updated {visible.current.edition!.reportedUpdatedOn}. A
                recent retrieval does not make an old observation current.
              </p>
              <div className="oil-benchmark-grid">
                {oilBenchmarkTimeline(
                  visible.current.edition!,
                  visible.current.evaluatedOn,
                ).map((series) => (
                  <article className="panel" key={series.series}>
                    <h2>{oilBenchmarkNames[series.series]}</h2>
                    {series.current ? (
                      <>
                        <p className="oil-benchmark-value">
                          {series.current.value === null
                            ? 'Not reported'
                            : `${series.current.value} USD per barrel`}
                        </p>
                        <p>Observation month {series.current.period}</p>
                      </>
                    ) : (
                      <p>No completed observation month is available.</p>
                    )}
                  </article>
                ))}
              </div>
              <p>
                <a href="#oil-benchmarks/history">Review retrieval history</a>
                {' · '}
                <a
                  href={`#oil-benchmarks/edition/${visible.current.edition!.edition}`}
                >
                  All reported months
                </a>
                {' · '}
                <a
                  href={`#oil-benchmarks/evidence/${visible.current.edition!.edition}`}
                >
                  Inspect numerical evidence
                </a>
              </p>
              <p>
                Original publication/known-at times are unknown. Historical
                values were retrieved later; they are not a reconstructed as-of
                vintage.
              </p>
            </>
          )}
        </>
      )}
      {visible?.history && (
        <>
          <p>
            Only editions published since the last source withdrawal are listed.
            New captures do not rewrite earlier editions.
          </p>
          <ol>
            {visible.history.editions.map((edition) => (
              <li key={edition.edition}>
                <a href={`#oil-benchmarks/edition/${edition.edition}`}>
                  Retrieval edition {edition.edition}
                </a>{' '}
                · {edition.retrievedAt}
              </li>
            ))}
          </ol>
          {!visible.history.editions.length && (
            <p>No reviewed retrieval history.</p>
          )}
          {visible.history.nextBefore && (
            <button
              disabled={busy}
              onClick={() => {
                const ticket = ++generation.current;
                setBusy(true);
                setError('');
                void json(
                  `/oil-benchmarks/history?before=${visible.history!.nextBefore}`,
                )
                  .then(OilBenchmarkHistorySchema.parse)
                  .then((next) => {
                    if (live.current && ticket === generation.current)
                      setData({
                        route,
                        history: {
                          editions: [
                            ...visible.history!.editions,
                            ...next.editions,
                          ],
                          nextBefore: next.nextBefore,
                        },
                      });
                  })
                  .catch((failure: unknown) => {
                    if (live.current && ticket === generation.current) {
                      setData(null);
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : 'History unavailable. Retry.',
                      );
                    }
                  })
                  .finally(() => {
                    if (live.current && ticket === generation.current)
                      setBusy(false);
                  });
              }}
            >
              More retrieval editions
            </button>
          )}
        </>
      )}
      {visible?.edition && (
        <>
          <OilEdition
            edition={visible.edition}
            sourceDetails={view === 'evidence'}
          />
          {view === 'evidence' ? (
            <details>
              <summary>Evidence identity and parser</summary>
              <p>SHA-256 receipt {visible.edition.sourceHash}</p>
              <p>Parser {visible.edition.parserVersion}</p>
              <p>
                Workbook reported update date{' '}
                {visible.edition.reportedUpdatedOn}; exact publication/known-at
                time is unknown.
              </p>
              <p>
                Public evidence contains only selected reviewed numerical
                records and their original cell text. Operators can inspect the
                retained workbook receipt.
              </p>
            </details>
          ) : (
            <a href={`#oil-benchmarks/evidence/${visible.edition.edition}`}>
              Inspect this edition's evidence
            </a>
          )}
        </>
      )}
    </section>
  );
}
