import './research.css';
import { shortDate } from './ui';
import { useEffect, useState } from 'react';
import {
  SourceListSchema,
  ResearchCatalogSchema,
  type ResearchCatalog,
  type SourceRecord,
} from '@fingent360/contracts';
import { json } from './net';
export function Sources() {
  const [catalog, setCatalog] = useState<ResearchCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setCatalogError('');
    void json('/discovery/catalog')
      .then((raw) => {
        if (active) setCatalog(ResearchCatalogSchema.parse(raw));
      })
      .catch((e: unknown) => {
        if (active)
          setCatalogError(
            e instanceof Error ? e.message : 'Coverage unavailable.',
          );
      });
    return () => {
      active = false;
    };
  }, [catalogRetry]);
  const [items, setItems] = useState<SourceRecord[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void json('/sources')
      .then((v) => {
        if (active) setItems(SourceListSchema.parse(v));
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Sources unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section>
      <div className="page-header">
        <div>
          <p className="page-kicker">THE BASIS BEHIND THE BRIEF</p>
          <h1>Our sources</h1>
          <p className="page-description">
            Know where the information comes from. Every published item links to
            its own source and date.
          </p>
        </div>
      </div>
      <article className="panel">
        <h2>Original evidence, clearly identified.</h2>
        <p>
          Annual India macro observations come from World Bank Open Data.
          Official news items identify their publisher; explanations identify
          their educational source. Dates distinguish the reported period from
          the time a source was checked.
        </p>
        <a href="#macro">Explore the annual data</a>
      </article>
      <section className="panel" aria-label="Specialist source readers">
        <h2>Data and original-document readers</h2>
        <p>
          These readers use separate reviewed collections from the news feed.
          Open a reader to see this installation’s retained data, dates and
          limitations. A reader being available does not mean its source is
          activated or that data has been published. Offline, only downloaded
          editions are available.
        </p>
        <ul>
          <li>
            <a href="#equities">Company identities and exchange evidence</a> —
            dated identities, prices, actions and financial statements.
          </li>
          <li>
            <a href="#funds-bonds">Fund disclosures and bond yields</a> — AMFI
            NAV history, reviewed portfolios, merger notices, dated fees and
            historical sovereign auction calculations; individual fund
            disclosures require a matched scheme.
          </li>
          <li>
            <a href="#daily-oil">Daily oil observations</a> — retained WTI/Brent
            closing data, source dates and permission limits.
          </li>
          <li>
            <a href="#commodities">Monthly commodity evidence</a> — retained
            benchmark units, dates and original evidence.
          </li>
          <li>
            <a href="#regulatory-sources">Rules and tax originals</a> — reviewed
            document revisions and effective-date precision, without legal
            applicability approval.
          </li>
          <li>
            <a href="#india-macro">India release history</a> — original
            observations and retained revisions.
          </li>
          <li>
            <a href="#global-macro">Global economic coverage</a> — published
            releases, numerical policy rates, reference FX and calendars.
          </li>
          <li>
            <a href="#research-calendar">
              Release dates and GDP/CPI expectations
            </a>{' '}
            — survey forecasts and model nowcasts remain distinct from observed
            releases.
          </li>
          <li>
            <a href="#event-scenarios">Reviewed release scenarios</a> — dated
            actuals and expectations, with uncertainty rather than causal
            forecasts.
          </li>
        </ul>
      </section>
      <section aria-label="Published research coverage">
        <div className="section-heading">
          <h2>Published news and explanations</h2>
          <p>
            These counts describe the discovery feed, not every specialist
            collection above. Access alone does not mean a source is included.
          </p>
        </div>
        {!catalog && !catalogError && (
          <p role="status">Loading published coverage…</p>
        )}
        {catalogError && (
          <p role="alert">
            {catalogError}{' '}
            <button onClick={() => setCatalogRetry((n) => n + 1)}>
              Retry coverage
            </button>
          </p>
        )}
        {catalog && (
          <>
            <p className="data-note">
              Coverage checked {shortDate(catalog.evaluatedAt)}. A dated offline
              snapshot can differ from the online collection.
            </p>
            <div className="source-directory">
              {catalog.sources.map((source) => (
                <article className="panel" key={source.id}>
                  <span className="eyebrow">
                    {source.region === 'india' ? 'INDIA' : 'GLOBAL CONTEXT'}
                  </span>
                  <h3>{source.name}</h3>
                  <p>{source.description}</p>
                  <div className="research-source-meta">
                    <span>{source.publishedCount} published items</span>
                    <span>
                      {source.access === 'enabled'
                        ? source.publishedCount
                          ? 'Available to read'
                          : 'Awaiting publication'
                        : source.access === 'blocked'
                          ? 'Currently unavailable'
                          : 'Permission pending'}
                    </span>
                  </div>
                  <p className="research-source-status">{source.accessNote}</p>
                  {source.lastRunStatus === 'failed' && (
                    <p>
                      Latest source check did not complete. Previously published
                      items remain dated; they are not a fresh update.
                    </p>
                  )}
                  <p className="muted">
                    Latest publication:{' '}
                    {source.latestPublishedAt
                      ? shortDate(source.latestPublishedAt)
                      : 'None stored'}{' '}
                    · Last successful check:{' '}
                    {source.lastSuccessAt
                      ? shortDate(source.lastSuccessAt)
                      : 'Not recorded'}
                  </p>
                  <details>
                    <summary>Attribution and permitted use</summary>
                    <p>{source.rights}</p>
                    {source.lastMessage && <p>{source.lastMessage}</p>}
                  </details>
                  <div className="page-actions">
                    {source.publishedCount > 0 && (
                      <a
                        href={`#explore?source=${encodeURIComponent(source.id)}`}
                      >
                        Read published items from {source.name}
                      </a>
                    )}
                    <a href={source.homeUrl} target="_blank" rel="noreferrer">
                      Visit publisher
                    </a>
                    <a href={source.termsUrl} target="_blank" rel="noreferrer">
                      Source terms
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <div className="section-heading">
        <h2>Approved source registry</h2>
        <p>
          Recorded usage approvals. A registry entry does not activate an
          adapter or imply published coverage.
        </p>
      </div>
      {loading && <p role="status">Loading source information…</p>}
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      <div className="source-directory">
        {items.map((s) => (
          <article className="panel" key={s.id}>
            <span className="eyebrow">{s.data.category}</span>
            <h2>{s.data.name}</h2>
            <p>{s.data.constraints}</p>
            <div className="page-actions">
              <a href={s.data.sourceUrl} target="_blank" rel="noreferrer">
                Original source
              </a>
              <a href={s.data.termsUrl} target="_blank" rel="noreferrer">
                Usage terms
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
