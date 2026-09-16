import { useEffect, useRef, useState } from 'react';
import {
  EiaSpotPublicSchema,
  EiaSpotReceiptSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function EiaSpotView({
  receipt: r,
}: {
  receipt: ReturnType<typeof EiaSpotReceiptSchema.parse>;
}) {
  return (
    <article className="source-workflow">
      <h3>Daily crude spot · released {r.releasedOn}</h3>
      <p>
        {r.attribution}. USD per barrel; daily closing observations, not live
        quotes.
      </p>
      {r.nextReleaseOn < new Date().toISOString().slice(0, 10) && (
        <p role="status">
          The next scheduled release day has passed. These retained observations
          may be stale.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <caption>Original daily spot observations</caption>
          <thead>
            <tr>
              <th>Benchmark</th>
              <th>Date</th>
              <th>USD per barrel</th>
            </tr>
          </thead>
          <tbody>
            {r.points.map((p) => (
              <tr key={p.series + p.observedOn}>
                <th scope="row">{p.series}</th>
                <td>{p.observedOn}</td>
                <td>{p.value ?? 'Not reported'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Next source release date {r.nextReleaseOn}; exact time not supplied.
        Captured {r.retrievedAt}.
      </p>
      <a href={r.url} target="_blank" rel="noreferrer">
        Original EIA table
      </a>
      <details>
        <summary>Source and reuse limits</summary>
        <p>
          Refinitiv/LSEG contributed data requires applicable permission.
          Missing cells are not zero. Retained editions show what was captured,
          not a complete historical archive.
        </p>
        <code>{r.bodyHash}</code>
      </details>
    </article>
  );
}
export function EiaSpot() {
  const [data, setData] = useState<ReturnType<
      typeof EiaSpotPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const live = useRef(true),
    sequence = useRef(0),
    target = useRef<string | undefined>(undefined),
    moveFocus = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    failure = useRef<HTMLParagraphElement>(null);
  async function load(edition?: string, focus = false) {
    target.current = edition;
    moveFocus.current = focus;
    const current = ++sequence.current;
    setBusy(true);
    setError('');
    setData(null);
    try {
      const value = EiaSpotPublicSchema.parse(
        await json(
          '/eia-spot' +
            (edition ? '?edition=' + encodeURIComponent(edition) : ''),
        ),
      );
      if (live.current && sequence.current === current) setData(value);
    } catch (cause) {
      if (live.current && sequence.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Daily crude source unavailable.',
        );
    } finally {
      if (live.current && sequence.current === current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!busy && moveFocus.current) {
      moveFocus.current = false;
      if (error) failure.current?.focus();
      else if (data) heading.current?.focus();
    }
  }, [busy, error, data]);
  useEffect(() => {
    live.current = true;
    function readRoute(focus = false) {
      if (location.hash.split('?')[0] !== '#daily-oil') return;
      void load(
        new URLSearchParams(location.hash.split('?')[1] ?? '').get('edition') ??
          undefined,
        focus,
      );
    }
    const changed = () => readRoute(true);
    readRoute();
    window.addEventListener('hashchange', changed);
    return () => {
      live.current = false;
      sequence.current++;
      window.removeEventListener('hashchange', changed);
    };
  }, []);
  function select(edition?: string) {
    const hash =
      '#daily-oil' + (edition ? '?edition=' + encodeURIComponent(edition) : '');
    if (location.hash === hash) void load(edition, true);
    else location.hash = hash;
  }
  return (
    <section
      className="source-workflow"
      aria-label="Daily crude spot"
      aria-busy={busy}
    >
      <h2 tabIndex={-1} ref={heading}>
        Daily oil observations
      </h2>
      {error && (
        <p role="alert" tabIndex={-1} ref={failure}>
          {error}
        </p>
      )}
      {error && (
        <button disabled={busy} onClick={() => void load(target.current, true)}>
          Retry daily oil
        </button>
      )}
      <button disabled={busy} onClick={() => select()}>
        Latest daily edition
      </button>
      {busy && <p role="status">Loading reviewed daily oil…</p>}
      {data && (
        <>
          <label>
            Retained daily oil edition
            <select
              disabled={busy}
              value={data.receipt.id}
              onChange={(e) => select(e.target.value)}
            >
              {data.editions.map((id) => (
                <option key={id} value={id}>
                  {id === data.receipt.id
                    ? `${data.receipt.releasedOn} · `
                    : ''}
                  {id}
                </option>
              ))}
            </select>
          </label>
          <EiaSpotView receipt={data.receipt} />
          <p>
            Reviewed {data.reviewedAt}. Offline uses the downloaded edition
            only; connect for withdrawal and new-release checks.
          </p>
        </>
      )}
      <a href="#commodities">Back to monthly commodities</a>
    </section>
  );
}
