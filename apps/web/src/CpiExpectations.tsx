import { useEffect, useState } from 'react';
import {
  CpiExpectationPublicSchema,
  compareCpiSnapshots,
} from '@fingent360/contracts';
import { json } from './net';
export function CpiExpectations() {
  const [data, setData] = useState<ReturnType<
      typeof CpiExpectationPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    void json('/cpi-expectations')
      .then((value) => {
        if (alive) setData(CpiExpectationPublicSchema.parse(value));
      })
      .catch((error) => {
        if (alive)
          setError(
            error instanceof Error
              ? error.message
              : 'CPI expectation evidence unavailable.',
          );
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  const nowcasts =
      data?.editions.filter((e) => e.expectation.kind !== 'observed-release') ??
      [],
    actuals =
      data?.editions.filter((e) => e.expectation.kind === 'observed-release') ??
      [];
  return (
    <section aria-label="CPI model comparisons">
      <h2>Inflation model snapshots</h2>
      <p>
        Cleveland Fed model nowcasts of US headline CPI, monthly seasonally
        adjusted nonannualized percentages. This is not market consensus or a
        portfolio recommendation.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry CPI snapshots
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading reviewed CPI snapshots…</p>
      ) : !nowcasts.length ? (
        <p>No reviewed model snapshots are available.</p>
      ) : (
        nowcasts.map((n) => (
          <article key={n.id}>
            <p>
              Captured {n.expectation.retrievedAt}. Reviewed {n.reviewedAt}.
            </p>
            <a href={n.expectation.url} target="_blank" rel="noreferrer">
              Cleveland Fed model source
            </a>
            {n.expectation.points.map((point) => (
              <div key={point.period}>
                <h3>
                  {point.period}: model {point.value}%
                </h3>
                {n.expectation.history ? (
                  <p>
                    Historical model vintage {n.expectation.history.asOf}.
                    Archive generation label{' '}
                    {n.expectation.history.archiveGeneratedLabel}; this is not
                    the vintage publication time.
                  </p>
                ) : (
                  <p>
                    Source update label {point.updateLabel}; source publication
                    year and time are not established by that label.
                  </p>
                )}
                {!actuals.some((a) =>
                  a.expectation.points.some((p) => p.period === point.period),
                ) && (
                  <p>
                    No reviewed BLS actual for this month. This snapshot is an
                    expectation, not a released fact.
                  </p>
                )}
                {actuals
                  .filter((a) =>
                    a.expectation.points.some((p) => p.period === point.period),
                  )
                  .map((a) => {
                    const result = compareCpiSnapshots(n, a, point.period);
                    return (
                      <div key={a.id}>
                        <p>
                          Actual minus model: {result.difference} percentage
                          points.
                        </p>
                        <p>{result.reason}</p>
                        <a
                          href={a.expectation.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Original BLS release ·{' '}
                          {a.expectation.sourcePublishedOn}
                        </a>
                      </div>
                    );
                  })}
              </div>
            ))}
            <details>
              <summary>Snapshot provenance and limitations</summary>
              <p>
                The source page changes. Only retained captured bytes establish
                this app’s snapshot. A current page does not reconstruct a prior
                vintage. Downloaded data reflects its capture date; connect for
                withdrawal updates.
              </p>
              <code>{n.expectation.hash}</code>
            </details>
          </article>
        ))
      )}
    </section>
  );
}
