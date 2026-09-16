import { useEffect, useRef, useState } from 'react';
import {
  MacroDashboardSchema,
  MacroHistorySchema,
  MacroEvidenceSchema,
  type MacroDashboard,
  type MacroObservation,
} from '@fingent360/contracts';
import { Trend } from './Overview';
import { json } from './net';
import { Icon, shortDate } from './ui';
import { returnTo, restorePosition } from './navigation';
const expandedIndicators = new Set<string>();
const indicatorTitles: Record<string, string> = {
  'NY.GDP.MKTP.KD.ZG': 'India GDP growth',
  'FP.CPI.TOTL.ZG': 'India CPI inflation',
};
export function Macro({ route = 'macro' }: { route?: string }) {
  const [expanded, setExpanded] = useState(() => new Set(expandedIndicators));
  const [data, setData] = useState<MacroDashboard | null>(null);
  const [history, setHistory] = useState<MacroObservation[] | null>(null);
  const [evidence, setEvidence] = useState<ReturnType<
    typeof MacroEvidenceSchema.parse
  > | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const parts = route.split('/');
  const view = parts[1];
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);
    setHistory(null);
    setEvidence(null);
    const load = async () => {
      if (view === 'history') {
        const result = MacroHistorySchema.parse(
          await json(
            `/macro/${encodeURIComponent(parts[2]!)}/history/${parts[3]}`,
          ),
        );
        if (active) setHistory(result);
      } else if (view === 'evidence') {
        const result = MacroEvidenceSchema.parse(
          await json(`/macro/evidence/${parts[2]}`),
        );
        if (active) setEvidence(result);
      } else {
        const result = MacroDashboardSchema.parse(await json('/macro'));
        if (active) setData(result);
      }
    };
    void load()
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Market context could not be loaded.',
          );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          if (view) heading.current?.focus({ preventScroll: true });
          else restorePosition(route);
        }
      });
    return () => {
      active = false;
    };
    // route contains the complete selected indicator/year/evidence identity.
  }, [route, reload, view]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view && !document.querySelector('dialog[open]'))
        returnTo('macro');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view]);
  const source = data?.sources.find((s) => s.indicator === parts[2]);
  return (
    <section
      className={`macro ${view ? 'evidence-reader' : ''}`}
      aria-labelledby="macro-title"
    >
      <a href="#india-macro">Original CPI releases and India calendar</a>
      {view && (
        <button
          className="text-link back-control"
          onClick={() => returnTo('macro')}
        >
          <Icon name="back" /> Back to market context
        </button>
      )}
      <div className="page-header">
        <div>
          <p className="page-kicker">EXPLORE / REPORTED DATA</p>
          <h1 id="macro-title" ref={heading} tabIndex={-1}>
            {view === 'history'
              ? `${source?.title ?? indicatorTitles[parts[2]!] ?? 'Annual observation'} · ${parts[3]}`
              : view === 'evidence'
                ? 'Source evidence'
                : 'India macro dashboard'}
          </h1>
          <p className="page-description">
            {view === 'history'
              ? 'The published record, including subsequent revisions.'
              : view === 'evidence'
                ? 'Check the original source behind this observation.'
                : 'Understand growth and inflation, one observation at a time.'}
          </p>
        </div>
      </div>
      {!view && (
        <p>
          <a href="#policy-rates">
            Explore reviewed ECB policy rates and effective-date history
          </a>
        </p>
      )}
      {!view && (
        <p>
          <a href="#oil-benchmarks">
            Explore reviewed monthly Brent and WTI benchmarks
          </a>
        </p>
      )}
      {!view && (
        <p>
          <a href="#reference-fx">
            Explore ECB reference exchange rates and derived INR/USD
          </a>
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button onClick={() => setReload((n) => n + 1)}>Try again</button>
        </div>
      )}
      {loading && (
        <p role="status">
          Loading {view ? 'selected evidence' : 'market context'}…
        </p>
      )}
      {!view && data && (
        <>
          <p className="data-note">
            Annual World Bank observations. The observation year describes the
            data; the checked date describes when it was retrieved.
          </p>
          <div className="macro-grid">
            {data.sources.map((s) => (
              <article
                key={s.indicator}
                className="macro-summary"
                aria-label={s.title}
              >
                <span className="eyebrow">ANNUAL DATA · INDIA</span>
                <h2>{s.title}</h2>
                <p>{s.explanation}</p>
                <div className="macro-value">
                  {s.observations.find((o) => o.value !== null)?.value !==
                  undefined ? (
                    <>
                      <strong>
                        {Number(
                          s.observations.find((o) => o.value !== null)?.value,
                        ).toFixed(2)}
                        <small>%</small>
                      </strong>
                      <span>
                        Observation year{' '}
                        {s.observations.find((o) => o.value !== null)?.year}
                      </span>
                    </>
                  ) : (
                    <p>No reported values available yet.</p>
                  )}
                </div>
                <Trend observations={s.observations} />
                <p className="muted">
                  Source checked {shortDate(s.lastSuccessAt)}
                </p>
                <details
                  open={expanded.has(s.indicator)}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setExpanded((previous) => {
                      if (previous.has(s.indicator) === open) return previous;
                      const next = new Set(previous);
                      if (open) {
                        next.add(s.indicator);
                        expandedIndicators.add(s.indicator);
                      } else {
                        next.delete(s.indicator);
                        expandedIndicators.delete(s.indicator);
                      }
                      return next;
                    });
                  }}
                >
                  <summary>
                    Annual observations and provenance ({s.observations.length})
                  </summary>
                  <div
                    className="observation-list"
                    aria-label={`${s.title} observations`}
                  >
                    {s.observations.map((o) => (
                      <div className="observation-row" key={o.id}>
                        <div>
                          <strong>{o.year}</strong>
                          <span>
                            {o.value ?? 'Unavailable'}
                            {o.value !== null ? '%' : ''}
                          </span>
                        </div>
                        <div className="row-actions">
                          <a
                            className="button secondary"
                            href={`#macro/history/${s.indicator}/${o.year}`}
                          >
                            History {o.year} (v{o.revision})
                          </a>
                          <a
                            className="button secondary"
                            href={`#macro/evidence/${o.sourceHash}`}
                          >
                            Source {o.year}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
                <a
                  className="text-link"
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  World Bank source <Icon name="arrow" />
                </a>
              </article>
            ))}
          </div>
          <div className="page-actions">
            <button
              className="secondary"
              disabled={loading}
              onClick={() => setReload((n) => n + 1)}
            >
              Check for saved updates
            </button>
            <a href="#account">Follow these indicators</a>
          </div>
        </>
      )}
      {history && (
        <section aria-label="Observation history" className="revision-list">
          {history.length === 0 ? (
            <p>No revisions found for this observation.</p>
          ) : (
            history.map((o) => (
              <article className="panel" key={o.id}>
                <span className="eyebrow">
                  REVISION {o.revision} · {o.year}
                </span>
                <h2>
                  {o.value ?? 'Unavailable'}
                  {o.value !== null ? '%' : ''}
                </h2>
                <dl className="evidence-facts">
                  <div>
                    <dt>Meaning</dt>
                    <dd>Reported annual percentage</dd>
                  </div>
                  <div>
                    <dt>Provider dataset updated</dt>
                    <dd>{shortDate(o.providerUpdatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Retrieved</dt>
                    <dd>{shortDate(o.retrievedAt)}</dd>
                  </div>
                </dl>
                <a className="button" href={`#macro/evidence/${o.sourceHash}`}>
                  View evidence for revision {o.revision}
                </a>
              </article>
            ))
          )}
        </section>
      )}
      {evidence && (
        <section aria-label="Original source record" className="panel">
          <span className="eyebrow">ORIGINAL PROVIDER RECORD</span>
          <h2>World Bank Open Data</h2>
          <p>
            Retrieved {shortDate(evidence.retrievedAt)}. This stored source
            supports the observation and preserves the provider response for
            inspection.
          </p>
          <a
            className="button"
            href={evidence.url}
            target="_blank"
            rel="noreferrer"
          >
            Open original provider source <Icon name="arrow" />
          </a>
          <details>
            <summary>Advanced evidence</summary>
            <p className="hash">SHA-256: {evidence.hash}</p>
            <h3>Original JSON response</h3>
            <pre>{evidence.body}</pre>
          </details>
        </section>
      )}
    </section>
  );
}
