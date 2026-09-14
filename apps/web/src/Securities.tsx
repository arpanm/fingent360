import { IdentitySelection } from './IdentitySelection';
import { useEffect, useState } from 'react';
import {
  SecurityDirectorySchema,
  SecurityIdentitySchema,
  SecurityHistorySchema,
  SecurityEvidenceSchema,
  SecurityRunsSchema,
  SecurityRunSchema,
  SecurityRefreshInputSchema,
  type SecurityIdentity,
  type SecurityEvidence,
  type SecurityRun,
} from '@fingent360/contracts';
import { json } from './net';
import { shortDate } from './ui';
import { returnTo } from './navigation';
import './securities.css';

export function Securities({ isin }: { isin?: string | undefined }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SecurityIdentity[]>([]);
  const [detail, setDetail] = useState<SecurityIdentity | null>(null);
  const [limited, setLimited] = useState(false);
  const [history, setHistory] = useState<SecurityIdentity[] | null>(null);
  const [evidence, setEvidence] = useState<SecurityEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setHistory(null);
    setEvidence(null);
    void json(
      isin
        ? `/securities/${encodeURIComponent(isin)}`
        : `/securities?q=${encodeURIComponent(query)}`,
      undefined,
      'GET',
      controller.signal,
    )
      .then((value) => {
        if (isin) setDetail(SecurityIdentitySchema.parse(value));
        else {
          const directory = SecurityDirectorySchema.parse(value);
          setItems(directory.items);
          setLimited(directory.limited);
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Identity directory unavailable.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isin, query, retry]);
  async function more(which: 'history' | 'evidence') {
    if (!detail || busy) return;
    setBusy(true);
    setError('');
    try {
      if (which === 'history')
        setHistory(
          SecurityHistorySchema.parse(
            await json(`/securities/${detail.isin}/history`),
          ).revisions,
        );
      else
        setEvidence(
          SecurityEvidenceSchema.parse(
            await json(
              `/securities/${detail.isin}/evidence/${detail.sourceHash}`,
            ),
          ),
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Source detail could not load. Retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="securities-page">
      {isin && (
        <button className="secondary" onClick={() => returnTo('securities')}>
          ← Back
        </button>
      )}
      <div className="page-header">
        <div>
          <p className="page-kicker">KNOW THE IDENTIFIER</p>
          <h1>{isin ? 'Security identity' : 'Security directory'}</h1>
          <p className="page-description">
            Names and identifiers from OpenFIGI, with the date and evidence
            behind each record.
          </p>
        </div>
      </div>
      <p className="data-note">
        Identity metadata does not include a current price, prove ownership or
        confirm current exchange listing. Your recorded cost stays separate.
      </p>
      {!isin && (
        <form
          className="security-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label>
            Search name, ticker or ISIN
            <input
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
            />
          </label>
          <button disabled={loading}>Search identities</button>
        </form>
      )}
      {loading && <p role="status">Loading stored identities…</p>}
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry identity lookup
          </button>
          <a href="#holdings">Back to holdings</a>
        </div>
      )}
      {!loading && !error && !isin && items.length === 0 && (
        <div className="empty-state">
          <h2>No stored match yet.</h2>
          <p>
            Try an exact ISIN or a different name. The directory contains only
            identifiers explicitly checked from the source.
          </p>
          <a href="#holdings">Go to holdings</a>
        </div>
      )}
      {!loading && !error && !isin && (
        <div className="security-list">
          {items.map((v) => (
            <a className="panel" href={`#securities/${v.isin}`} key={v.isin}>
              <span className="eyebrow">
                {v.resolution === 'matched'
                  ? 'SOURCE MATCH'
                  : v.resolution === 'ambiguous'
                    ? 'MULTIPLE MATCHES'
                    : 'UNRESOLVED'}
              </span>
              <h2>
                {v.candidates.length === 1 ? v.candidates[0]!.name : v.isin}
              </h2>
              <p>
                {v.isin} ·{' '}
                {v.candidates[0]?.ticker ?? 'No validated common-stock match'}
              </p>
              <small>Checked {shortDate(v.checkedAt)} · View identity →</small>
            </a>
          ))}
        </div>
      )}
      {limited && (
        <p>
          Showing the first 200 results. Narrow the search to find a specific
          identity.
        </p>
      )}
      {!loading && isin && detail && (
        <article className="panel" aria-label="Security identity detail">
          <span className="eyebrow">
            {detail.isin} · EDITION {detail.version}
          </span>
          <h2>
            {detail.candidates.length === 1
              ? detail.candidates[0]!.name
              : 'Review the source matches'}
          </h2>
          <p>
            {detail.resolution === 'matched'
              ? 'One India common-stock mapping was returned.'
              : detail.resolution === 'ambiguous'
                ? 'Several mappings were returned. No identity has been selected automatically.'
                : 'No India common-stock mapping was returned. An ISIN check digit alone does not identify the security.'}
          </p>
          <p>
            Source edition retrieved {shortDate(detail.retrievedAt)}. Last
            successful check {shortDate(detail.checkedAt)}.
          </p>
          {Date.now() - Date.parse(detail.checkedAt) > 7 * 86400000 && (
            <p className="data-note">
              This identity has not been checked in more than seven days. Treat
              it as dated reference data.
            </p>
          )}
          <IdentitySelection isin={detail.isin} />
          {detail.candidates.map((candidate) => (
            <dl className="security-facts" key={candidate.figi}>
              <dt>Name</dt>
              <dd>{candidate.name}</dd>
              <dt>Ticker</dt>
              <dd>{candidate.ticker}</dd>
              <dt>FIGI</dt>
              <dd>{candidate.figi}</dd>
              <dt>Mapping scope</dt>
              <dd>India composite · INR · Common stock</dd>
              <dt>Share-class FIGI</dt>
              <dd>{candidate.shareClassFIGI ?? 'Not supplied'}</dd>
            </dl>
          ))}
          <div className="page-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void more('history')}
            >
              Identity history
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void more('evidence')}
            >
              Original identity evidence
            </button>
            <a href="https://www.openfigi.com" target="_blank" rel="noreferrer">
              Visit OpenFIGI
            </a>
            <a href={detail.termsUrl} target="_blank" rel="noreferrer">
              Source terms
            </a>
            <a href="#holdings">My holdings</a>
          </div>
          {history && (
            <section aria-label="Identity history">
              <h3>Stored editions</h3>
              {history.map((v) => (
                <p key={v.version}>
                  Edition {v.version} · {v.resolution} ·{' '}
                  {shortDate(v.retrievedAt)} ·{' '}
                  {v.candidates.map((c) => c.name).join(', ') || 'No match'}
                </p>
              ))}
            </section>
          )}
          {evidence && (
            <section aria-label="Original identity evidence">
              <h3>Original provider response</h3>
              <p>
                Retrieved {shortDate(evidence.retrievedAt)} · SHA-256{' '}
                {evidence.hash}
              </p>
              <pre tabIndex={0}>{evidence.body}</pre>
            </section>
          )}
        </article>
      )}
      <p className="data-note">
        FIGI and related open symbology metadata are provided by OpenFIGI. No
        endorsement is implied. Source accuracy is not guaranteed.
      </p>
    </section>
  );
}

export function SecurityOperations() {
  const [isins, setIsins] = useState('');
  const [runs, setRuns] = useState<SecurityRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<{
    requestId: string;
    isins: string[];
  } | null>(null);
  const load = async () =>
    setRuns(SecurityRunsSchema.parse(await json('/ops/securities/runs')).runs);
  useEffect(() => {
    let active = true;
    void json('/ops/securities/runs')
      .then((v) => {
        if (active) setRuns(SecurityRunsSchema.parse(v).runs);
      })
      .catch(() => {
        if (active) setError('Identity run history could not load.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh(retry = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const parsed = SecurityRefreshInputSchema.parse(
        retry && request
          ? request
          : {
              requestId: crypto.randomUUID(),
              isins: isins
                .split(/[\s,]+/)
                .map((v) => v.trim().toUpperCase())
                .filter(Boolean),
            },
      );
      setRequest(parsed);
      const result = SecurityRunSchema.parse(
        await json(
          '/ops/securities/refresh',
          parsed,
          'POST',
          AbortSignal.timeout(120000),
        ),
      );
      await load();
      setRequest(null);
      if (result.status === 'failed')
        setError(
          'Some identities could not refresh. Review the recorded outcomes, then start a new refresh to retry.',
        );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Refresh could not finish. Check progress or retry the same request.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Identity operations">
      <h2>Security identity refresh</h2>
      <p>
        Map up to five public Indian ISINs through OpenFIGI. No prices or
        private portfolio amounts are requested. Previously stored identities
        remain on a failure.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void refresh();
        }}
      >
        <label>
          Public ISINs
          <textarea
            value={isins}
            disabled={busy}
            onChange={(e) => setIsins(e.target.value)}
            placeholder="One ISIN per line"
            maxLength={100}
            required
          />
        </label>
        <button disabled={busy || !isins.trim()}>
          {busy ? 'Checking source…' : 'Refresh identities'}
        </button>
      </form>
      {loading && <p role="status">Loading identity runs…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="page-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            void load()
              .then(() => setError(''))
              .catch(() => setError('Run history could not load. Retry.'));
          }}
        >
          Check identity progress
        </button>
        {request && !busy && (
          <button onClick={() => void refresh(true)}>
            Retry same identity request
          </button>
        )}
        <a href="#securities">Open security directory</a>
      </div>
      {runs.map((run) => (
        <article className="panel" key={run.id}>
          <h3>
            {run.status === 'running'
              ? 'Refresh in progress'
              : run.status === 'completed'
                ? 'Refresh complete'
                : 'Refresh needs attention'}
          </h3>
          <p>
            {shortDate(run.startedAt)} · {run.isins.join(', ')}
          </p>
          {run.outcomes.map((v) => (
            <p key={v.isin}>
              {v.isin}: {v.status} — {v.message}
            </p>
          ))}
          {run.status === 'running' && (
            <p>
              If a server restart interrupted this refresh, start a new request.
              The next request records this run as interrupted.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
