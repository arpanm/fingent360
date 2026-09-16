import { useEffect, useState, useRef } from 'react';
import {
  CcilZeroListSchema,
  CCIL_ZERO_URL,
  CCIL_ZERO_RATES_URL,
  CcilZeroEditionSchema,
  CcilZeroEvidenceSchema,
  type CcilZeroRowSchema,
  type CcilZeroPointsSchema,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
function ZeroRows({ rows }: { rows: z.infer<typeof CcilZeroRowSchema>[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <caption>Reported Nelson–Siegel–Svensson model parameters</caption>
        <thead>
          <tr>
            {[
              'Source date',
              'Beta0',
              'Beta1',
              'Beta2',
              'Beta3',
              'Tau1',
              'Tau2',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              {(
                ['beta0', 'beta1', 'beta2', 'beta3', 'tau1', 'tau2'] as const
              ).map((key) => (
                <td key={key}>{row[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PointRows({ data }: { data: z.infer<typeof CcilZeroPointsSchema> }) {
  return (
    <div>
      <p>
        Original reported zero rates. Maturity labels follow the source table;
        that table does not declare maturity units or compounding. No
        interpolation or valuation is performed.
      </p>
      {data.rows.map((row) => (
        <details key={row.date}>
          <summary>Reported curve points · {row.date}</summary>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Maturity label</th>
                  <th>Reported rate</th>
                </tr>
              </thead>
              <tbody>
                {row.points.map((point) => (
                  <tr key={point.maturityLabel}>
                    <td>{point.maturityLabel}</td>
                    <td>{point.reportedRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
export function CcilZeroReader() {
  const [data, setData] = useState<ReturnType<
      typeof CcilZeroListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    json(
      '/bond-zero-curve' +
        (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
      undefined,
      'GET',
      abort.signal,
    )
      .then((raw) => {
        if (!abort.signal.aborted) setData(CcilZeroListSchema.parse(raw));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Yield source unavailable.',
          );
      });
    return () => abort.abort();
  }, [retry, cursor]);
  const dates = data?.editions
      .map((e) => e.data?.date)
      .filter((v): v is string => Boolean(v))
      .sort(),
    latest = dates?.at(-1),
    current =
      data?.editions.filter(
        (e) =>
          e.data?.date === latest &&
          e.sourceUrl === data.editions[0]?.sourceUrl,
      ) ?? [];
  return (
    <section aria-label="Sovereign curve model parameters">
      <h3>Sovereign curve model parameters</h3>
      <p>
        These are source-reported fitted sovereign curve parameters, not
        executable prices, security yields or priced holdings. No interpolated
        yield or compounding convention is assumed. Source dates have day
        precision; capture time is not original publication time.
      </p>
      {!data && !error && <p role="status">Loading reviewed yield evidence…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry yield evidence
          </button>
        </p>
      )}
      {data && !data.enabled && (
        <p>Yield source is not enabled for this deployment.</p>
      )}
      {data?.enabled && !data.editions.length && (
        <p>No reviewed yield disclosure is available.</p>
      )}
      {current.length > 1 && (
        <p role="alert">
          Multiple reviewed editions exist for the latest source date. Compare
          the retained evidence; no single corrected value is assumed.
        </p>
      )}
      {data?.editions.map((edition, i) => (
        <details key={edition.id} open={i === 0}>
          <summary>
            {edition.data?.date} ·{' '}
            {i === 0
              ? 'Most recently captured on this page'
              : 'Retained history'}
          </summary>
          <p>
            Captured {edition.retrievedAt}; reviewed {edition.reviewedAt}.
            Source hash {edition.hash}.
          </p>
          {edition.data &&
            Date.now() - Date.parse(edition.data.date + 'T00:00:00Z') >
              4 * 86400000 && (
              <p role="status">
                This disclosure is more than four calendar days old. Do not
                treat it as a current quote.
              </p>
            )}
          <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
            {edition.sourceUrl === CCIL_ZERO_URL
              ? 'CCIL original NSS parameters'
              : 'CCIL original zero-rate points'}
          </a>
          {edition.data &&
            (edition.data.parser === 'ccil-nss-static-html-v1' ? (
              <ZeroRows rows={edition.data.rows} />
            ) : (
              <PointRows data={edition.data} />
            ))}
        </details>
      ))}
      <nav aria-label="Curve history pages">
        <button
          disabled={history.length === 0}
          onClick={() => {
            setCursor(history.at(-1) ?? null);
            setHistory((v) => v.slice(0, -1));
          }}
        >
          Previous history
        </button>
        <button
          disabled={!data?.nextCursor}
          onClick={() => {
            setHistory((v) => [...v, cursor]);
            setCursor(data?.nextCursor ?? null);
          }}
        >
          Older history
        </button>
      </nav>
    </section>
  );
}
export function CcilZeroOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const generation = useRef(0);
  const [sourceUrl, setSourceUrl] = useState<string>(CCIL_ZERO_URL);
  const [queue, setQueue] = useState<ReturnType<
      typeof CcilZeroListSchema.parse
    > | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const load = async (next: string | null = cursor) => {
    const current = generation.current;
    const value = CcilZeroListSchema.parse(
      await request(
        '/ops/bond-zero-curve' +
          (next ? '?cursor=' + encodeURIComponent(next) : ''),
      ),
    );
    if (current === generation.current) {
      setQueue(value);
      setCursor(next);
    }
  };
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      if (
        error instanceof RequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        setQueue(null);
        onDenied?.();
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'Yield source operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    generation.current += 1;
    setQueue(null);
    setCursor(null);
    setHistory([]);
    request('/ops/bond-zero-curve')
      .then((raw) => {
        if (alive) setQueue(CcilZeroListSchema.parse(raw));
      })
      .catch((error) => {
        if (alive) {
          setMessage('Yield queue unavailable. Retry.');
          if (
            error instanceof RequestError &&
            (error.status === 401 || error.status === 403)
          )
            onDenied?.();
        }
      });
    return () => {
      alive = false;
      generation.current += 1;
    };
  }, [request, onDenied]);
  return (
    <section aria-label="CCIL NSS Operations">
      <h3>CCIL NSS source review</h3>
      <p>
        Activation requires a server-configured written CCIL permission covering
        retention, web display and downloaded Android distribution. Publication
        requires a different named reviewer. Downloaded source HTML is inert
        evidence.
      </p>
      {queue && !queue.enabled && (
        <p>
          Source disabled; existing evidence remains inspectable and
          withdrawable.
        </p>
      )}
      <label>
        CCIL curve source
        <select
          value={sourceUrl}
          disabled={busy}
          onChange={(e) => setSourceUrl(e.target.value)}
        >
          <option value={CCIL_ZERO_URL}>NSS parameters</option>
          <option value={CCIL_ZERO_RATES_URL}>Reported zero-rate points</option>
        </select>
      </label>
      <button
        disabled={busy || !queue?.enabled}
        onClick={() =>
          void action(async () => {
            CcilZeroEditionSchema.parse(
              await request(
                '/ops/bond-zero-curve/fetch',
                { requestId: crypto.randomUUID(), sourceUrl },
                'POST',
              ),
            );
            await load(null);
            setHistory([]);
          })
        }
      >
        Fetch original NSS page
      </button>
      <label>
        Import unchanged NSS HTML
        <input
          type="file"
          accept=".html,text/html"
          disabled={busy || !queue?.enabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void action(async () => {
              if (file.size > 500000) throw Error('Source exceeds500KB.');
              CcilZeroEditionSchema.parse(
                await request(
                  '/ops/bond-zero-curve/import',
                  {
                    requestId: crypto.randomUUID(),
                    sourceUrl,
                    body: await file.text(),
                  },
                  'POST',
                ),
              );
              await load(null);
              setHistory([]);
            });
          }}
        />
      </label>
      <button disabled={busy} onClick={() => void action(() => load())}>
        Refresh NSS queue
      </button>
      <label>
        NSS review reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
        />
      </label>
      {message && <p role="status">{message}</p>}
      {queue?.editions.length === 0 && <p>No retained yield editions.</p>}
      {queue?.editions.map((edition) => (
        <article key={edition.id}>
          <h4>
            {edition.data?.date ?? 'Unparsed source'} · {edition.state}
          </h4>
          {edition.error && <p role="alert">{edition.error}</p>}
          {edition.data &&
            (edition.data.parser === 'ccil-nss-static-html-v1' ? (
              <ZeroRows rows={edition.data.rows} />
            ) : (
              <PointRows data={edition.data} />
            ))}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const evidence = CcilZeroEvidenceSchema.parse(
                  await request(`/ops/bond-zero-curve/${edition.id}/evidence`),
                );
                if (
                  evidence.id !== edition.id ||
                  evidence.hash !== edition.hash
                )
                  throw Error('Source identity changed. Refresh queue.');
                await saveDownload(
                  new Blob([evidence.body], { type: 'text/plain' }),
                  'ccil-retained-source.txt',
                );
              })
            }
          >
            Download inert source evidence
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' && (!queue.enabled || !edition.data))
              }
              onClick={() =>
                void action(async () => {
                  CcilZeroEditionSchema.parse(
                    await request(
                      `/ops/bond-zero-curve/${edition.id}/review`,
                      { requestId: crypto.randomUUID(), decision, reason },
                      'POST',
                    ),
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed NSS parameters'
                : 'Withdraw NSS parameters'}
            </button>
          ))}
        </article>
      ))}
      <nav aria-label="Curve capture pages">
        <button
          disabled={busy || history.length === 0}
          onClick={() =>
            void action(async () => {
              await load(history.at(-1) ?? null);
              setHistory((v) => v.slice(0, -1));
            })
          }
        >
          Previous captures
        </button>
        <button
          disabled={busy || !queue?.nextCursor}
          onClick={() =>
            void action(async () => {
              const previous = cursor;
              await load(queue?.nextCursor ?? null);
              setHistory((v) => [...v, previous]);
            })
          }
        >
          Older captures
        </button>
      </nav>
    </section>
  );
}
