import { useEffect, useState } from 'react';
import {
  GdpExpectationPublicSchema,
  compareGdpExpectation,
} from '@fingent360/contracts';
import { json } from './net';
export function GdpExpectations({ period }: { period?: string }) {
  const [data, setData] = useState<ReturnType<
      typeof GdpExpectationPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    void json('/gdp-expectations')
      .then((value) => {
        if (alive) setData(GdpExpectationPublicSchema.parse(value));
      })
      .catch((error) => {
        if (alive)
          setError(
            error instanceof Error
              ? error.message
              : 'Expectation evidence unavailable.',
          );
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  const visibleExpectations =
    data?.expectations.filter(
      (row) => !period || row.expectation.period === period,
    ) ?? [];
  return (
    <section aria-label="GDP forecast comparison">
      <h2>What forecasters expected</h2>
      <p>
        Philadelphia Fed survey median, compared with a specifically dated BEA
        estimate. This is not a marketwide consensus, trading signal or causal
        portfolio coefficient.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry GDP expectations
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading reviewed expectations…</p>
      ) : !visibleExpectations.length ? (
        <p>No reviewed original GDP expectations are available.</p>
      ) : (
        visibleExpectations.map((row) => (
          <article key={row.id}>
            <h3>
              {row.expectation.period} · survey median {row.expectation.value}%
            </h3>
            <p>
              Quarterly real GDP growth, annualized. Source published{' '}
              {row.expectation.sourcePublishedOn}; captured{' '}
              {row.expectation.retrievedAt}.
            </p>
            <a href={row.expectation.url} target="_blank" rel="noreferrer">
              Original SPF report
            </a>
            {data.actuals.items.filter(
              (actual) => actual.original.period === row.expectation.period,
            ).length === 0 && (
              <p>
                No reviewed BEA estimate for this quarter is available for
                comparison.
              </p>
            )}
            {data.actuals.items
              .filter(
                (actual) => actual.original.period === row.expectation.period,
              )
              .map((actual) => {
                const comparison = compareGdpExpectation(
                  row.expectation,
                  actual.original,
                  row.reviewedAt,
                );
                return (
                  <div key={actual.itemId}>
                    <p>
                      {actual.original.estimate} estimate:{' '}
                      {actual.original.value}% · published{' '}
                      {actual.original.publishedAt}
                    </p>
                    <p>
                      {comparison.difference === null
                        ? 'Comparison unavailable'
                        : `${comparison.difference} percentage points above/below the survey median (actual minus expectation).`}
                    </p>
                    <p>{comparison.reason}</p>
                    <a
                      href={actual.original.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Original BEA estimate
                    </a>
                  </div>
                );
              })}
            <details>
              <summary>Reconstruction and uncertainty</summary>
              <p>
                The report supplies only a publication day. Same-day ordering is
                unknown. A later capture never proves what this app knew before
                release. Survey dispersion and a universal portfolio effect are
                not inferred.
              </p>
              <code>{row.expectation.hash}</code>
              <p>{row.expectation.policy}</p>
            </details>
          </article>
        ))
      )}
    </section>
  );
}
