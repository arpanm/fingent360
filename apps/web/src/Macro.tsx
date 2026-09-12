import { useEffect, useState } from 'react';
import { Trend } from './Overview';
import { shortDate } from './ui';
import {
  MacroDashboardSchema,
  MacroEvidenceSchema,
  MacroHistorySchema,
  MacroRunSchema,
  type MacroDashboard,
  type MacroIndicator,
  type MacroObservation,
} from '@fingent360/contracts';
async function get(path = ''): Promise<unknown> {
  const response = await fetch(`/api/v1/macro${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body && 'message' in body
        ? String(body.message)
        : 'Macro data is unavailable.',
    );
  return body;
}
export function Macro() {
  const [data, setData] = useState<MacroDashboard | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState('');
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<MacroObservation[] | null>(null);
  const [evidence, setEvidence] = useState<{
    body: string;
    hash: string;
    url: string;
    retrievedAt: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void get()
      .then((body) => {
        if (active) setData(MacroDashboardSchema.parse(body));
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load macro data.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Operation failed. Previously saved data remains available.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setData(MacroDashboardSchema.parse(await get()));
  }
  async function refresh(indicator: MacroIndicator) {
    let failure: Error | null = null;
    try {
      const response = await fetch('/api/v1/macro/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ indicator }),
        signal: AbortSignal.timeout(45000),
      });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body === 'object' && body && 'message' in body
            ? String(body.message)
            : 'Source refresh failed.',
        );
      const result = MacroRunSchema.parse(body);
      setNotice(result.message);
    } catch (error) {
      failure =
        error instanceof Error ? error : new Error('Source refresh failed.');
    }
    await reload();
    if (failure) throw failure;
  }
  return (
    <section className="macro" aria-labelledby="macro-title">
      <div className="page-header">
        <div>
          <p className="page-kicker">REPORTED DATA · INDIA</p>
          <h1 id="macro-title">India macro dashboard</h1>
          <p className="page-description">
            A longer view of growth and inflation. Explore the numbers, then
            follow the evidence.
          </p>
        </div>
        <a className="button secondary" href="#account">
          Manage your watchlist
        </a>
      </div>
      <p className="data-note">
        Annual World Bank observations provide economic context, not live
        quotes, forecasts or investment recommendations.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void action(reload)}
      >
        Reload saved data
      </button>
      <p aria-live="polite">
        {busy ? 'Working… source refresh may take a moment.' : notice}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data && !error && <p>Loading saved observations…</p>}
      {data && (
        <>
          <div className="macro-grid">
            {data.sources.map((source) => {
              const latest = source.observations.find((o) => o.value !== null);
              return (
                <article
                  className="card"
                  key={source.indicator}
                  aria-label={source.title}
                >
                  <h3>{source.title}</h3>
                  <p>{source.explanation}</p>
                  {latest ? (
                    <>
                      <p className="big-number">
                        {Number(latest.value).toFixed(2)}%
                      </p>
                      <p>
                        Observation year: <strong>{latest.year}</strong> ·
                        reported annual percentage
                      </p>
                    </>
                  ) : (
                    <p>
                      No reported values stored yet. An operator can fetch the
                      latest available history using the source controls below.
                    </p>
                  )}
                  <Trend observations={source.observations} />
                  <p>
                    Source checked: {shortDate(source.lastSuccessAt)}.{' '}
                    {source.freshness === 'refresh_due'
                      ? 'Refresh due — last successful check is over 7 days old.'
                      : source.freshness === 'recently_checked'
                        ? 'Checked within 7 days; this does not make annual data a current release.'
                        : ''}
                  </p>
                  {source.latestRun && (
                    <p>
                      Latest refresh: {source.latestRun.status}.{' '}
                      {source.latestRun.message}
                    </p>
                  )}
                  {operatorOpen && /^[a-f0-9]{64}$/.test(key) && (
                    <button
                      disabled={
                        busy ||
                        !data.operatorConfigured ||
                        !/^[a-f0-9]{64}$/.test(key)
                      }
                      onClick={() =>
                        void action(() => refresh(source.indicator))
                      }
                    >
                      Refresh {source.title}
                    </button>
                  )}
                  <p>
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                      Official indicator and licensing
                    </a>{' '}
                    ·{' '}
                    <a href={source.termsUrl} target="_blank" rel="noreferrer">
                      CC BY 4.0 and additional terms
                    </a>
                  </p>
                  <p className="muted">
                    {source.attribution} No endorsement implied.
                  </p>
                  <details>
                    <summary>
                      Annual observations and provenance (
                      {source.observations.length})
                    </summary>
                    <div
                      className="table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={`${source.title} observations`}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>Year</th>
                            <th>Annual %</th>
                            <th>Revision</th>
                            <th>Evidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {source.observations.map((o) => (
                            <tr key={o.id}>
                              <td>{o.year}</td>
                              <td>{o.value ?? 'Unavailable'}</td>
                              <td>
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(async () => {
                                      setHistory(
                                        MacroHistorySchema.parse(
                                          await get(
                                            `/${source.indicator}/history/${o.year}`,
                                          ),
                                        ),
                                      );
                                      setEvidence(null);
                                    })
                                  }
                                >
                                  History {o.year} (v{o.revision})
                                </button>
                              </td>
                              <td>
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(async () => {
                                      setEvidence(
                                        MacroEvidenceSchema.parse(
                                          await get(
                                            `/evidence/${o.sourceHash}`,
                                          ),
                                        ),
                                      );
                                      setHistory(null);
                                    })
                                  }
                                >
                                  Source {o.year}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          <details
            className="card"
            onToggle={(event) => setOperatorOpen(event.currentTarget.open)}
          >
            <summary>Source refresh controls</summary>
            <p>
              Refreshes call the real provider and save source evidence. The
              local operator key is held only in this page’s memory and is never
              included in public data.
            </p>
            {!data.operatorConfigured && (
              <p>
                Source refresh is disabled. Run pnpm research:setup locally and
                restart the API, then reload this page.
              </p>
            )}
            <label>
              Operator key
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
            <button className="secondary" onClick={() => setKey('')}>
              Forget operator key
            </button>
          </details>
        </>
      )}
      {history && (
        <section className="card" aria-label="Observation history">
          <h3>Observation history</h3>
          {history.length === 0 && <p>No revisions found.</p>}
          {history.map((o) => (
            <div key={o.id}>
              <p>
                {o.indicator} · {o.year} · revision {o.revision}:{' '}
                {o.value ?? 'Unavailable'} annual %
              </p>
              <p>
                Provider dataset updated: {o.providerUpdatedAt}. Retrieved:{' '}
                {o.retrievedAt}. Previous revision ID:{' '}
                {o.supersedesId ?? 'None'}.
              </p>
              <p className="hash">Evidence hash: {o.sourceHash}</p>
              <button
                disabled={busy}
                className="secondary"
                onClick={() =>
                  void action(async () =>
                    setEvidence(
                      MacroEvidenceSchema.parse(
                        await get(`/evidence/${o.sourceHash}`),
                      ),
                    ),
                  )
                }
              >
                View evidence for revision {o.revision}
              </button>
            </div>
          ))}
        </section>
      )}
      {evidence && (
        <section className="card" aria-label="Source evidence">
          <h3>Stored source evidence</h3>
          <p>Retrieved: {evidence.retrievedAt}</p>
          <p>
            <a href={evidence.url} target="_blank" rel="noreferrer">
              Original provider request
            </a>
          </p>
          <p className="hash">
            SHA-256 (request URL + newline + raw response): {evidence.hash}
          </p>
          <details>
            <summary>Original JSON response</summary>
            <pre>{evidence.body}</pre>
          </details>
        </section>
      )}
    </section>
  );
}
