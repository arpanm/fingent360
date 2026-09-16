import { useEffect, useRef, useState } from 'react';
import { EquityPriceHistorySchema } from '@fingent360/contracts';
import { json } from './net';
export function EquityPriceHistory({ isin }: { isin: string }) {
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [from, setFrom] = useState(
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    ),
    [data, setData] = useState<ReturnType<
      typeof EquityPriceHistorySchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cursors, setCursors] = useState<(string | null)[]>([null]);
  const generation = useRef(0),
    resultsHeading = useRef<HTMLHeadingElement>(null),
    errorSummary = useRef<HTMLParagraphElement>(null),
    focusResult = useRef(false);
  async function load(
    after: string | null = null,
    nextCursors: (string | null)[] = [null],
    moveFocus = false,
  ) {
    focusResult.current = moveFocus;
    const ticket = ++generation.current;
    setBusy(true);
    setData(null);
    setError('');
    try {
      const query = new URLSearchParams({
        from,
        to,
        limit: '15',
        ...(after ? { after } : {}),
      });
      const result = EquityPriceHistorySchema.parse(
        await json(`/equities/${isin}/prices?${query}`),
      );
      if (ticket === generation.current) {
        setData(result);
        setCursors(nextCursors);
      }
    } catch (cause) {
      if (ticket === generation.current)
        setError(
          cause instanceof Error ? cause.message : 'Price history unavailable.',
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!busy && focusResult.current) {
      focusResult.current = false;
      if (error) errorSummary.current?.focus();
      else if (data) resultsHeading.current?.focus();
    }
  }, [busy, data, error]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [isin]);
  return (
    <section aria-label="Price history" aria-busy={busy}>
      <h2>Price history</h2>
      <p>
        Unadjusted daily closes and volume from independently reviewed source
        editions. Disputed revisions stay visible; no arbitrary price is
        selected.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(null, [null], true);
        }}
      >
        <label>
          Price history from
          <input
            type="date"
            required
            value={from}
            disabled={busy}
            onChange={(event) => {
              setFrom(event.target.value);
              setData(null);
            }}
          />
        </label>
        <label>
          Price history through
          <input
            type="date"
            required
            value={to}
            disabled={busy}
            onChange={(event) => {
              setTo(event.target.value);
              setData(null);
            }}
          />
        </label>
        <button disabled={busy}>Load price history</button>
      </form>
      {busy && <p role="status">Loading retained price dates…</p>}
      {error && (
        <p role="alert" tabIndex={-1} ref={errorSummary}>
          {error} Choose a narrower range or retry.
        </p>
      )}
      {data && (
        <>
          <h3 tabIndex={-1} ref={resultsHeading}>
            Retained price results
          </h3>
          <p>
            Evidence captured {data.capturedAt}. Date range {data.from}–
            {data.to}.
          </p>
          {!data.days.length && (
            <p>No reviewed prices are retained for this page and range.</p>
          )}
          {data.days.map((day) => (
            <article key={day.on}>
              <h3>{day.on}</h3>
              {day.status === 'conflicting-revisions' && (
                <p role="status">
                  Conflicting same-exchange revisions: inspect every source
                  before using this date.
                </p>
              )}
              {day.records.map(
                (record, index) =>
                  record.observation.kind === 'price' && (
                    <div key={`${record.editionId}:${index}`}>
                      <p>
                        {record.observation.exchange} close ₹
                        {record.observation.close} · volume{' '}
                        {record.observation.volume} · unadjusted
                      </p>
                      <a
                        href={record.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Price source
                      </a>
                      <details>
                        <summary>Price provenance</summary>
                        <p>
                          ISIN {record.observation.isin} · edition{' '}
                          {record.editionId} · original hash {record.hash} ·
                          captured {record.retrievedAt}
                        </p>
                        <p>
                          Source row {record.observation.sourceRow}; original
                          publication {record.publishedAt ?? 'Not provided'}.
                        </p>
                      </details>
                    </div>
                  ),
              )}
            </article>
          ))}
          <button
            disabled={busy || cursors.length < 2}
            onClick={() => {
              const previous = cursors.slice(0, -1);
              void load(previous.at(-1) ?? null, previous, true);
            }}
          >
            Previous price dates
          </button>
          <button
            disabled={busy || !data.nextAfter}
            onClick={() =>
              void load(data.nextAfter, [...cursors, data.nextAfter], true)
            }
          >
            More price dates
          </button>
          <details>
            <summary>
              Dates without retained price evidence (
              {data.datesWithoutCapture.length})
            </summary>
            <p>
              These are calendar dates, including possible weekends and exchange
              holidays. This is not a verified trading calendar or a claim that
              every trading session was captured.
            </p>
            <p>
              {data.datesWithoutCapture.join(', ') ||
                'Every calendar date in this range has at least one retained price.'}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
