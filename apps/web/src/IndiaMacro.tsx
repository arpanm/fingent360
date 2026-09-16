import { IndiaGdpReader } from './IndiaGdpReader';
import { useEffect, useState, useRef } from 'react';
import {
  INDIA_MACRO_REGISTRY,
  IndiaMacroDashboardSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
export function IndiaMacro() {
  const [data, setData] = useState<ReturnType<
      typeof IndiaMacroDashboardSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [asOf, setAsOf] = useState('');
  const generation = useRef(0);
  async function load() {
    const current = ++generation.current;
    setData(null);
    setBusy(true);
    setError('');
    try {
      const response = IndiaMacroDashboardSchema.parse(
        await json(
          `/india-macro${asOf ? `?asOf=${encodeURIComponent(asOf + ':00.000Z')}` : ''}`,
        ),
      );
      if (current === generation.current) setData(response);
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : 'Unable to load.');
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);
  return (
    <section
      className="source-workflow"
      aria-label="India macro releases"
      aria-busy={busy}
    >
      <a href="#more">Back to More</a>
      <h1>India, in context</h1>
      <p>
        See what each official release reported, including revisions. Consumer
        prices use the 2024 base; they are not spliced with older base series.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Published by (UTC)
          <input
            type="datetime-local"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
          />
        </label>
        <button disabled={busy}>Apply publication cutoff</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading official editions…</p>}
      <button disabled={busy} onClick={() => void load()}>
        Reload India releases
      </button>
      {data && (
        <>
          <p>
            Snapshot captured {data.cpi.capturedAt}. Historical selection uses
            recorded original publication dates, not our retrieval dates.
            Missing releases are not filled in.
          </p>
          <h2>Consumer prices</h2>
          {!data.cpi.selected.length && (
            <p>No reviewed release is available for this cutoff.</p>
          )}
          {data.cpi.selected.map((point) => (
            <article key={point.period}>
              <h3>{point.period}</h3>
              <p>
                Combined index {point.index} (2024=100) · year-on-year inflation{' '}
                {point.inflation ?? 'Unavailable'}
                {point.inflation !== null ? '%' : ''} · {point.status}
              </p>
              <p>
                Published {point.publishedAt} · captured {point.retrievedAt}
              </p>
              <a href={point.sourceUrl} target="_blank" rel="noreferrer">
                Original MoSPI release
              </a>
              <details>
                <summary>Release vintages for {point.period}</summary>
                {data.cpi.editions
                  .filter((edition) =>
                    edition.points.some(
                      (value) => value.period === point.period,
                    ),
                  )
                  .map((edition) => (
                    <p key={edition.id}>
                      {edition.publishedAt}: index{' '}
                      {
                        edition.points.find(
                          (value) => value.period === point.period,
                        )?.index
                      }{' '}
                      · {edition.reconciliation} · original hash {edition.hash}
                    </p>
                  ))}
              </details>
            </article>
          ))}
          <IndiaGdpReader
            {...(data.gdp === undefined ? {} : { data: data.gdp })}
            cutoff={data.cpi.asOf}
          />
          <h2>Official release calendar</h2>
          <p>
            Day-level schedules are not exact release times. Actual dates remain
            separate from planned dates.
          </p>
          {!data.calendar ? (
            <p>No reviewed calendar edition available.</p>
          ) : (
            <>
              <a
                href={data.calendar.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {data.calendar.editionLabel}
              </a>
              <p>
                Reviewed transcription of the retained official PDF · captured{' '}
                {data.calendar.retrievedAt}
              </p>
              {data.calendar.events.map((event) => (
                <article key={event.id}>
                  <h3>{event.title}</h3>
                  <p>
                    Planned {event.plannedOn} · actual{' '}
                    {event.actualOn ?? 'Not recorded'}
                  </p>
                  <details>
                    <summary>Calendar evidence</summary>
                    <p>
                      PDF page {event.page}: {event.sourceExcerpt}
                    </p>
                  </details>
                </article>
              ))}
              <details>
                <summary>Earlier calendar captures</summary>
                {data.calendarHistory.map((edition) => (
                  <p key={edition.id}>
                    {edition.editionLabel} · {edition.retrievedAt} ·{' '}
                    {edition.hash}
                  </p>
                ))}
              </details>
            </>
          )}
        </>
      )}
      <h2>Initial series registry</h2>
      {INDIA_MACRO_REGISTRY.map((series) => (
        <article key={series.id}>
          <h3>{series.name}</h3>
          <p>
            {series.unit} · {series.frequency}
          </p>
          <p>{series.coverage}</p>
          <a href={series.sourceUrl} target="_blank" rel="noreferrer">
            Official producer
          </a>
        </article>
      ))}
    </section>
  );
}
