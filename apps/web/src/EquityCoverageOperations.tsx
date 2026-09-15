import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EquityQueueSchema,
  EquityImportSchema,
  EquityEditionSchema,
  EquityReviewSchema,
  EQUITY_MASTER_URL,
  EQUITY_INDEX_URL,
  parseEquitySource,
  NSE_UDIFF_PARSER,
  nseUdiffUrl,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import './equity-coverage.css';
type Parser = ReturnType<typeof EquityImportSchema.parse>['parser'];
export function EquityCoverageOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [data, setData] = useState<ReturnType<
      typeof EquityQueueSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [parser, setParser] = useState<Parser>('nse-equity-master-v1'),
    [body, setBody] = useState(''),
    [sourceFileName, setSourceFileName] = useState(''),
    [sourceUrl, setSourceUrl] = useState(''),
    [effectiveOn, setEffectiveOn] = useState(''),
    [rightsBasis, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [evidence, setEvidence] = useState<string | null>(null);
  const pendingReview = useRef<{ key: string; requestId: string } | null>(null);
  const deny = useCallback(
    (err: unknown) => {
      if (err instanceof RequestError && err.status === 401) {
        setData(null);
        setEvidence(null);
        onDenied?.();
      }
      setError(
        err instanceof Error ? err.message : 'This operation could not finish.',
      );
    },
    [onDenied],
  );
  const reload = useCallback(async () => {
    setData(EquityQueueSchema.parse(await request('/ops/equities')));
  }, [request]);
  useEffect(() => {
    let current = true;
    void request('/ops/equities')
      .then((value) => {
        if (current) setData(EquityQueueSchema.parse(value));
      })
      .catch((err: unknown) => {
        if (current) deny(err);
      });
    return () => {
      current = false;
    };
  }, [request, deny]);
  async function capture(fetchSource: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const common = {
        requestId,
        parser,
        effectiveOn,
        publishedAt: null,
        rightsBasis,
        rightsConfirmed: confirmed,
      };
      const source =
        parser === 'nse-equity-master-v1'
          ? EQUITY_MASTER_URL
          : parser === 'nifty50-constituents-v1'
            ? EQUITY_INDEX_URL
            : parser === NSE_UDIFF_PARSER
              ? nseUdiffUrl(effectiveOn)
              : sourceUrl;
      if (!fetchSource) {
        EquityImportSchema.parse({
          ...common,
          sourceUrl: source,
          body,
          ...(parser === NSE_UDIFF_PARSER ? { sourceFileName } : {}),
        });
        parseEquitySource(parser, body, effectiveOn, sourceFileName);
      }
      const result = EquityEditionSchema.parse(
        await request(
          fetchSource ? '/ops/equities/fetch' : '/ops/equities/import',
          fetchSource
            ? common
            : {
                ...common,
                sourceUrl: source,
                body,
                ...(parser === NSE_UDIFF_PARSER ? { sourceFileName } : {}),
              },
          'POST',
        ),
      );
      setNotice(
        `Saved ${result.observations.length} observations as draft. Review sources before publication.`,
      );
      setRequestId(crypto.randomUUID());
      await reload();
    } catch (err) {
      deny(err);
    } finally {
      setBusy(false);
    }
  }
  async function review(editionId: string, decision: 'publish' | 'withdraw') {
    setBusy(true);
    setError('');
    try {
      const key = JSON.stringify({ editionId, decision, reason });
      if (pendingReview.current?.key !== key)
        pendingReview.current = { key, requestId: crypto.randomUUID() };
      const payload = EquityReviewSchema.parse({
        requestId: pendingReview.current.requestId,
        editionId,
        decision,
        reason,
      });
      const receipt = EquityReviewSchema.parse(
        await request('/ops/equities/review', payload, 'POST'),
      );
      if (JSON.stringify(receipt) !== JSON.stringify(payload))
        throw Error('Review receipt does not match the submitted decision.');
      pendingReview.current = null;
      setNotice(
        decision === 'publish'
          ? 'Edition published.'
          : 'Edition withdrawn from connected company views. Rebuild snapshots to remove previously bundled copies.',
      );
      await reload();
    } catch (err) {
      deny(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="equity-coverage" aria-label="Equity source operations">
      <h2>Equity source coverage</h2>
      <p>
        Retain original evidence, reconcile exact values and publish a reviewed
        edition. Named mode requires a different reviewer. No financial
        calculations or automatic portfolio adjustments are inferred.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => {
              setError('');
              void reload().catch(deny);
            }}
          >
            Reload queue
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void capture(false);
        }}
      >
        <label>
          Source format
          <select
            value={parser}
            onChange={(e) => {
              setParser(e.target.value as Parser);
              setBody('');
              setSourceFileName('');
              setRequestId(crypto.randomUUID());
            }}
          >
            <option value="nse-equity-master-v1">NSE securities CSV</option>
            <option value="nifty50-constituents-v1">
              Nifty 50 constituents CSV
            </option>
            <option value={NSE_UDIFF_PARSER}>
              NSE UDiFF final cash-market prices
            </option>
            <option value="f360-equity-evidence-v1">
              Reviewed normalized equity evidence JSON
            </option>
          </select>
        </label>
        <label>
          Source effective date
          <input
            type="date"
            required
            value={effectiveOn}
            onChange={(e) => {
              setEffectiveOn(e.target.value);
              setRequestId(crypto.randomUUID());
            }}
          />
        </label>
        {parser === 'f360-equity-evidence-v1' && (
          <label>
            Original HTTPS source URL
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                setRequestId(crypto.randomUUID());
              }}
            />
          </label>
        )}
        <label>
          Permission or licence basis
          <textarea
            required
            minLength={12}
            maxLength={1000}
            value={rightsBasis}
            onChange={(e) => {
              setRights(e.target.value);
              setRequestId(crypto.randomUUID());
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{' '}
          I verified permission to ingest, retain and display this source for
          this deployment.
        </label>
        {parser === NSE_UDIFF_PARSER && (
          <p>
            Choose the final dated CSV extracted from the NSE cash-market
            archive, or fetch that date’s official ZIP. Only EQ-series INE
            equities are accepted; other instruments are counted as excluded.
            Prices are unadjusted, with no invented master identity.
          </p>
        )}
        <label>
          Source file
          <input
            type="file"
            accept={parser === 'f360-equity-evidence-v1' ? '.json' : '.csv'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setBody('');
              setSourceFileName('');
              setRequestId(crypto.randomUUID());
              if (!file) return;
              setSourceFileName(file.name);
              if (file.size > 2000000) {
                setError('Choose a file no larger than 2 MB.');
                return;
              }
              void file.text().then(setBody).catch(deny);
            }}
          />
        </label>
        {body && (
          <p>{body.length.toLocaleString()} source characters selected.</p>
        )}
        <button type="submit" disabled={busy || !confirmed || !body}>
          Retain and validate file
        </button>
        {parser !== 'f360-equity-evidence-v1' && (
          <button
            type="button"
            disabled={
              busy ||
              !confirmed ||
              !effectiveOn ||
              rightsBasis.trim().length < 12
            }
            onClick={() => void capture(true)}
          >
            Fetch official source now
          </button>
        )}
      </form>
      <label>
        Publication or withdrawal reason
        <textarea
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {busy && <p role="status">Saving source workflow…</p>}
      {!data && !error && <p role="status">Loading retained editions…</p>}
      {data?.editions.length === 0 && <p>No source editions retained yet.</p>}
      {data?.editions.map(({ edition, state }) => (
        <article className="equity-family" key={edition.id}>
          <h3>
            {edition.parser} · {edition.effectiveOn}
          </h3>
          <p>
            {state} · {edition.observations.length} observations · captured{' '}
            {edition.retrievedAt}
          </p>
          {edition.coverage && (
            <p>
              {edition.coverage.acceptedRows} accepted of{' '}
              {edition.coverage.inputRows} source rows;{' '}
              {edition.coverage.excludedRows} outside this adapter’s equity
              scope.
            </p>
          )}
          <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
            Original source
          </a>
          <details>
            <summary>Inspect normalized records and rights basis</summary>
            <p>{edition.rightsBasis}</p>
            <pre style={{ maxHeight: 320, overflow: 'auto' }}>
              {JSON.stringify(edition.observations, null, 2)}
            </pre>
          </details>
          <button
            disabled={busy}
            onClick={() => {
              void request(`/ops/equities/${edition.id}/evidence`)
                .then((value) => {
                  if (
                    typeof value !== 'object' ||
                    !value ||
                    !('body' in value) ||
                    typeof value.body !== 'string'
                  )
                    throw Error('Unreadable retained source.');
                  setEvidence(value.body);
                })
                .catch(deny);
            }}
          >
            Inspect original retained file
          </button>
          <button
            disabled={busy || reason.trim().length < 5 || state === 'published'}
            onClick={() => void review(edition.id, 'publish')}
          >
            Publish edition
          </button>
          <button
            disabled={busy || reason.trim().length < 5 || state === 'withdrawn'}
            onClick={() => void review(edition.id, 'withdraw')}
          >
            Withdraw edition
          </button>
        </article>
      ))}
      {evidence !== null && (
        <section aria-label="Retained equity source">
          <h3>Original retained source</h3>
          <button onClick={() => setEvidence(null)}>Close source</button>
          <pre style={{ maxHeight: 400, overflow: 'auto' }}>{evidence}</pre>
        </section>
      )}
    </section>
  );
}
