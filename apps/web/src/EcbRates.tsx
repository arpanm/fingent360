import { useEffect, useRef, useState } from 'react';
import {
  ECB_RATE_HOME,
  ECB_RATE_TERMS,
  ecbRateNames,
  ecbRateTimeline,
  EcbRatePublicSchema,
  EcbRateHistorySchema,
  EcbRateEditionSchema,
  EcbRateEvidenceSchema,
  type EcbRateEdition,
  type EcbRatePublic,
} from '@fingent360/contracts';
import { json } from './net';
import { returnTo, restorePosition } from './navigation';
import './ecb-rates.css';

export function EcbEdition({ edition }: { edition: EcbRateEdition }) {
  return (
    <section aria-label={`Numerical edition ${edition.edition}`}>
      <p>
        Retrieval edition {edition.edition} · retrieved {edition.retrievedAt}.
      </p>
      <p>
        Euro area · percent per annum. Effective dates are reported by the ECB.
        Original publication time is unknown; this is a retrieval revision, not
        a historical as-of vintage.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <caption>Reported policy-rate changes from 15 October 2008</caption>
          <thead>
            <tr>
              <th scope="col">Effective date</th>
              <th scope="col">Facility</th>
              <th scope="col">Percent per annum</th>
            </tr>
          </thead>
          <tbody>
            {[...edition.observations]
              .sort(
                (a, b) =>
                  b.effectiveOn.localeCompare(a.effectiveOn) ||
                  a.series.localeCompare(b.series),
              )
              .map((row) => (
                <tr key={`${row.series}/${row.effectiveOn}`}>
                  <th scope="row">{row.effectiveOn}</th>
                  <td>{ecbRateNames[row.series]}</td>
                  <td>{row.value}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
type Result = {
  route: string;
  current?: EcbRatePublic;
  history?: ReturnType<typeof EcbRateHistorySchema.parse>;
  edition?: EcbRateEdition;
};
export function EcbRates({ route = 'policy-rates' }: { route?: string }) {
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
      if (route === 'policy-rates')
        value = {
          route,
          current: EcbRatePublicSchema.parse(await json('/policy-rates')),
        };
      else if (route === 'policy-rates/history')
        value = {
          route,
          history: EcbRateHistorySchema.parse(
            await json('/policy-rates/history'),
          ),
        };
      else if (
        /^policy-rates\/(edition|evidence)\/[1-9][0-9]{0,8}$/.test(route)
      ) {
        const result = await json(
          `/policy-rates/${view === 'evidence' ? 'evidence' : 'editions'}/${id}`,
        );
        value = {
          route,
          edition:
            view === 'evidence'
              ? EcbRateEvidenceSchema.parse(result).edition
              : EcbRateEditionSchema.parse(result),
        };
      } else throw Error('This policy-rate view is unavailable.');
      if (live.current && ticket === generation.current) setData(value);
    })()
      .catch((failure: unknown) => {
        if (live.current && ticket === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Policy rates unavailable. Retry.',
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
    <section className="ecb-rates" aria-label="ECB policy rates">
      {view && (
        <button
          className="text-link back-control"
          aria-label="Back to previous policy-rate view"
          onClick={() => returnTo('policy-rates')}
        >
          Back
        </button>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {view === 'history'
          ? 'Reviewed retrieval history'
          : view === 'evidence'
            ? 'Policy-rate evidence'
            : 'ECB policy rates'}
      </h1>
      <p>
        European policy context for learning. These rates do not predict Indian
        investment returns or an individual holding's performance.
      </p>
      <p>
        Source: European Central Bank. The original information is available
        free of charge.{' '}
        <a href={ECB_RATE_HOME} target="_blank" rel="noopener noreferrer">
          Open ECB original (new tab)
        </a>
        {' · '}
        <a href={ECB_RATE_TERMS} target="_blank" rel="noopener noreferrer">
          Reuse terms (new tab)
        </a>
      </p>
      <button disabled={busy} onClick={() => setReload((value) => value + 1)}>
        {error ? 'Retry policy rates' : 'Reload policy rates'}
      </button>
      {busy && <p role="status">Reading reviewed policy rates…</p>}
      {error && <p role="alert">{error}</p>}
      {visible?.current && (
        <>
          {visible.current.status !== 'published' ? (
            <p role="status">
              {visible.current.status === 'withdrawn'
                ? 'This policy-rate source was withdrawn. Current values, history and evidence are unavailable.'
                : 'No reviewed ECB numerical edition is available yet.'}
            </p>
          ) : (
            <>
              <p>
                Evaluated for {visible.current.evaluatedOn} (Europe/Berlin).
                Reviewed {visible.current.reviewedAt}. Source last retrieved{' '}
                {visible.current.checkedAt ?? 'unknown'}; this reviewed edition
                captured {visible.current.edition!.retrievedAt}.
              </p>
              <p>
                Latest reviewed effective rates in this captured edition; the
                original may have changed since it was checked.
              </p>
              {(!visible.current.checkedAt ||
                Date.parse(visible.current.evaluatedAt) -
                  Date.parse(visible.current.checkedAt) >
                  86400000) && (
                <p role="status">
                  This source has not been checked within 24 hours. Treat these
                  as dated reviewed values and consult the ECB original for
                  current information.
                </p>
              )}
              <div className="ecb-rate-grid">
                {ecbRateTimeline(
                  visible.current.edition!,
                  visible.current.evaluatedOn,
                ).map((series) => (
                  <article className="panel" key={series.series}>
                    <h2>{ecbRateNames[series.series]}</h2>
                    {series.current ? (
                      <>
                        <p className="ecb-rate-value">
                          {series.current.value}% per annum
                        </p>
                        <p>Effective {series.current.effectiveOn}</p>
                      </>
                    ) : (
                      <p>No rate is effective by the displayed date.</p>
                    )}
                    {series.upcoming.length > 0 && (
                      <>
                        <h3>Future effective changes</h3>
                        <ol>
                          {series.upcoming.map((row) => (
                            <li key={row.effectiveOn}>
                              {row.effectiveOn}: {row.value}% per annum — not
                              yet effective
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </article>
                ))}
              </div>
              <p>
                <a href="#policy-rates/history">Review retrieval history</a>
                {' · '}
                <a
                  href={`#policy-rates/edition/${visible.current.edition!.edition}`}
                >
                  All reported effective dates
                </a>
                {' · '}
                <a
                  href={`#policy-rates/evidence/${visible.current.edition!.edition}`}
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
                <a href={`#policy-rates/edition/${edition.edition}`}>
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
                  `/policy-rates/history?before=${visible.history!.nextBefore}`,
                )
                  .then(EcbRateHistorySchema.parse)
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
          <EcbEdition edition={visible.edition} />
          {view === 'evidence' ? (
            <details>
              <summary>Evidence identity and parser</summary>
              <p>SHA-256 receipt {visible.edition.sourceHash}</p>
              <p>Parser {visible.edition.parserVersion}</p>
              <p>
                Response prepared{' '}
                {visible.edition.responsePreparedAt ?? 'unknown'}; this is not
                original publication time.
              </p>
              <p>
                Public evidence contains reviewed numerical records. Retained
                raw XML is available to authorized operators.
              </p>
            </details>
          ) : (
            <a href={`#policy-rates/evidence/${visible.edition.edition}`}>
              Inspect this edition's evidence
            </a>
          )}
        </>
      )}
    </section>
  );
}
