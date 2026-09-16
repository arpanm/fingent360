import { GdpExpectations } from './GdpExpectations';
import { useEffect, useState } from 'react';
import { BeaGdpSeriesSchema } from '@fingent360/contracts';
import { json } from './net';
export function GdpVintages({ period }: { period?: string }) {
  const [state, setState] = useState<ReturnType<
      typeof BeaGdpSeriesSchema.parse
    > | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setState(null);
    setError('');
    void json(
      `/discovery/gdp-vintages${period ? `?period=${encodeURIComponent(period)}` : ''}`,
      undefined,
      'GET',
      abort.signal,
    )
      .then((value) => {
        if (!abort.signal.aborted) setState(BeaGdpSeriesSchema.parse(value));
      })
      .catch((reason) => {
        if (!abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'GDP vintages unavailable.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [period, retry]);
  return (
    <section aria-label="Original GDP vintages">
      <GdpExpectations {...(period === undefined ? {} : { period })} />
      <h2>
        {period
          ? `${period} original GDP estimates`
          : 'Original US GDP estimates'}
      </h2>
      <p>
        Each estimate describes real GDP growth from the previous quarter at an
        annualized rate. Revised estimates for the same quarter are publication
        vintages, not market surprises. Original publication and when this app
        retrieved the page are separate times. The value is from the retained
        page capture; later source-page corrections are not assumed to have been
        known at publication.
      </p>
      {busy && <p role="status">Loading original GDP estimates…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry GDP vintages
          </button>
        </p>
      )}
      {!busy && !error && state && (
        <>
          {!state.items.length ? (
            <p>
              No reviewed original estimates retained yet. Operations can
              refresh and review the BEA original GDP source. Offline devices
              need a new downloaded snapshot.
            </p>
          ) : (
            <ol>
              {state.items.map((item) => (
                <li key={item.itemId}>
                  <details>
                    <summary>
                      {item.original.period} · {item.original.estimate} estimate
                      · {item.original.value}% annualized
                    </summary>
                    <dl>
                      <dt>Original publication</dt>
                      <dd>
                        <time dateTime={item.original.publishedAt}>
                          {new Date(item.original.publishedAt).toLocaleString()}
                        </time>
                      </dd>
                      <dt>Retrieved by this app</dt>
                      <dd>
                        <time dateTime={item.original.retrievedAt}>
                          {new Date(item.original.retrievedAt).toLocaleString()}
                        </time>
                      </dd>
                      <dt>Reviewed</dt>
                      <dd>{new Date(item.reviewedAt).toLocaleString()}</dd>
                      <dt>Source excerpt</dt>
                      <dd>{item.original.excerpt}</dd>
                    </dl>
                    <a
                      href={item.original.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read original BEA release
                    </a>
                    <p>
                      Stored publication edition {item.version}; current
                      interactive tables may differ from this original release.
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          )}
          {state.truncated && (
            <p>
              Showing the latest 500 retained releases. Open a story to view its
              specific quarter.
            </p>
          )}
        </>
      )}
    </section>
  );
}
