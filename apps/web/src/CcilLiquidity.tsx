import { useEffect, useRef, useState } from 'react';
import {
  CCIL_LIQUIDITY_URL,
  CCIL_LIQUIDITY_HEADERS,
  CcilLiquidityListSchema,
  CcilLiquidityEditionSchema,
  CcilLiquidityEvidenceSchema,
  type CcilLiquiditySchema,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
type Listing = ReturnType<typeof CcilLiquidityListSchema.parse>;
const description =
  'Historical order-book liquidity, not executable prices. Security descriptions have no ISIN and are not matched to holdings. Metric units and conventions follow source column labels only; missing values are not zero.';
function Rows({ data }: { data: z.infer<typeof CcilLiquiditySchema> }) {
  const [page, setPage] = useState(0),
    [filter, setFilter] = useState('');
  const rows = data.rows.filter((r) =>
    r.securityDescription.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div>
      <label>
        Find source security description
        <input
          value={filter}
          maxLength={160}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        />
      </label>
      <p>
        {rows.length} source rows; showing{' '}
        {Math.min(page * 25 + 1, rows.length)}–
        {Math.min((page + 1) * 25, rows.length)}. Missing source metrics are
        shown as “Not reported”. Numeric strings preserve original workbook
        precision.
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label="Scrollable liquidity source rows"
        style={{ overflowX: 'auto', maxWidth: '100%' }}
      >
        <table>
          <caption>Reported CCIL liquidity observations</caption>
          <thead>
            <tr>
              {CCIL_LIQUIDITY_HEADERS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 25, (page + 1) * 25).map((r) => (
              <tr key={r.sourceRow}>
                <td>{r.securityDescription}</td>
                <td>{r.instrumentType}</td>
                <td>{r.tradeDate}</td>
                <td>{r.couponLabel}</td>
                <td>{r.settlementDate}</td>
                {r.metrics.map((v, i) => (
                  <td key={i}>{v ?? 'Not reported'}</td>
                ))}
                <td>{r.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button disabled={page === 0} onClick={() => setPage((v) => v - 1)}>
        Previous source rows
      </button>
      <button
        disabled={(page + 1) * 25 >= rows.length}
        onClick={() => setPage((v) => v + 1)}
      >
        Next source rows
      </button>
    </div>
  );
}
function Edition({ edition }: { edition: Listing['editions'][number] }) {
  return (
    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <p>
        Source month {edition.data?.date ?? 'Unparsed'}; captured{' '}
        {edition.retrievedAt}; reviewed {edition.reviewedAt ?? 'Not reviewed'}.
        SHA256 {edition.hash}.
      </p>
      <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
        CCIL original liquidity workbook
      </a>
      {edition.error && <p role="alert">{edition.error}</p>}
      {edition.data && <Rows data={edition.data} />}
    </div>
  );
}
export function CcilLiquidityReader() {
  const [data, setData] = useState<Listing | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    json(
      '/bond-liquidity' +
        (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
      undefined,
      'GET',
      abort.signal,
    )
      .then((raw) => {
        if (!abort.signal.aborted) setData(CcilLiquidityListSchema.parse(raw));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Liquidity evidence unavailable.',
          );
      });
    return () => abort.abort();
  }, [retry, cursor]);
  return (
    <section
      aria-label="Historical government-security liquidity"
      style={{ minWidth: 0 }}
    >
      <h3>Historical government-security liquidity</h3>
      <p>{description}</p>
      <p>
        This is a dated monthly disclosure. It does not establish current depth
        or liquidity. Capture time is not publication time; downloaded editions
        remain frozen at download time.
      </p>
      {!data && !error && (
        <p role="status">Loading reviewed liquidity evidence…</p>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry liquidity evidence
          </button>
        </p>
      )}
      {data && !data.enabled && (
        <p>Liquidity source is not enabled for this deployment.</p>
      )}
      {data?.enabled && !data.editions.length && (
        <p>No reviewed liquidity disclosure is available.</p>
      )}
      {data && data.editions.length > 1 && (
        <p>
          Multiple retained editions may cover the same month. Compare source
          hashes; no corrected edition is silently preferred.
        </p>
      )}
      {data?.editions.map((e, i) => (
        <details key={e.id} open={i === 0}>
          <summary>
            {e.data?.date} ·{' '}
            {i === 0
              ? 'Most recently captured on this page'
              : 'Retained history'}
          </summary>
          <Edition edition={e} />
        </details>
      ))}
      <nav aria-label="Liquidity history pages">
        <button
          disabled={!history.length || !data}
          onClick={() => {
            setCursor(history.at(-1) ?? null);
            setHistory((v) => v.slice(0, -1));
          }}
        >
          Previous liquidity history
        </button>
        <button
          disabled={!data?.nextCursor}
          onClick={() => {
            setHistory((v) => [...v, cursor]);
            setCursor(data?.nextCursor ?? null);
          }}
        >
          Older liquidity history
        </button>
      </nav>
    </section>
  );
}
export function CcilLiquidityOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const live = useRef(false),
    generation = useRef(0),
    session = useRef(0),
    attempt = useRef<{ body: string | undefined; id: string } | null>(null);
  const [queue, setQueue] = useState<Listing | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [reason, setReason] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]),
    [denied, setDenied] = useState(false);
  function failure(error: unknown) {
    if (!live.current) return;
    if (
      error instanceof RequestError &&
      (error.status === 401 || error.status === 403)
    ) {
      generation.current++;
      setQueue(null);
      setDenied(true);
      onDenied?.();
    }
    setMessage(
      error instanceof Error
        ? error.message
        : 'Liquidity operation failed. Retry.',
    );
  }
  async function load(next: string | null = cursor) {
    const ticket = ++generation.current;
    const raw = await request(
      '/ops/bond-liquidity' +
        (next ? '?cursor=' + encodeURIComponent(next) : ''),
    );
    if (live.current && ticket === generation.current) {
      setQueue(CcilLiquidityListSchema.parse(raw));
      setCursor(next);
    }
  }
  async function action(work: () => Promise<void>) {
    const owner = session.current;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      if (owner === session.current) failure(error);
    } finally {
      if (live.current && owner === session.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    session.current++;
    generation.current++;
    attempt.current = null;
    setBusy(false);
    setMessage('');
    setReason('');
    setDenied(false);
    setQueue(null);
    setHistory([]);
    setCursor(null);
    void load(null).catch(failure);
    return () => {
      live.current = false;
      session.current++;
      generation.current++;
      attempt.current = null;
    };
  }, [request, onDenied]);
  async function capture(body?: string) {
    const ticket = generation.current,
      owner = session.current;
    if (!attempt.current || attempt.current.body !== body)
      attempt.current = { body, id: crypto.randomUUID() };
    const captured = CcilLiquidityEditionSchema.parse(
      await request(
        '/ops/bond-liquidity/' + (body === undefined ? 'fetch' : 'import'),
        {
          requestId: attempt.current.id,
          sourceUrl: CCIL_LIQUIDITY_URL,
          ...(body === undefined ? {} : { body }),
        },
        'POST',
      ),
    );
    if (
      !live.current ||
      ticket !== generation.current ||
      owner !== session.current
    )
      return;
    attempt.current = null;
    await load(null);
    if (live.current && owner === session.current) {
      setHistory([]);
      setMessage('Retained ' + captured.state + ' liquidity evidence.');
    }
  }
  return (
    <section aria-label="CCIL liquidity Operations" style={{ minWidth: 0 }}>
      <h3>CCIL liquidity source review</h3>
      <p>{description}</p>
      <p>
        Written retention, web and offline permission is required before
        activation. July2026 is the verified workbook layout. A different named
        operator must publish.
      </p>
      {!queue && !message && <p role="status">Loading liquidity queue…</p>}
      {queue && !queue.enabled && (
        <p>
          Source disabled; retained evidence can still be inspected and
          withdrawn.
        </p>
      )}
      <button
        disabled={busy || denied || !queue?.enabled}
        onClick={() => void action(() => capture())}
      >
        Fetch original July2026 liquidity workbook
      </button>
      <label>
        Import unchanged liquidity XLSX
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy || denied || !queue?.enabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const ticket = generation.current,
              owner = session.current;
            void action(async () => {
              if (file.size > 2000000) throw Error('Workbook exceeds2MB.');
              const bytes = new Uint8Array(await file.arrayBuffer());
              let binary = '';
              for (const byte of bytes) binary += String.fromCharCode(byte);
              if (
                live.current &&
                ticket === generation.current &&
                owner === session.current
              )
                await capture(btoa(binary));
            });
          }}
        />
      </label>
      <button
        disabled={busy || denied}
        onClick={() => void action(() => load())}
      >
        Refresh liquidity queue
      </button>
      <label>
        Liquidity review reason
        <textarea
          value={reason}
          maxLength={2000}
          disabled={busy || denied}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {message && <p role="status">{message}</p>}
      {queue?.editions.length === 0 && <p>No retained liquidity editions.</p>}
      {queue?.editions.map((e) => (
        <article key={e.id} style={{ minWidth: 0 }}>
          <h4>
            {e.data?.date ?? 'Unparsed workbook'} · {e.state}
          </h4>
          <Edition edition={e} />
          <button
            disabled={busy || denied}
            onClick={() =>
              void action(async () => {
                const ticket = generation.current;
                const evidence = CcilLiquidityEvidenceSchema.parse(
                  await request(`/ops/bond-liquidity/${e.id}/evidence`),
                );
                if (!live.current || ticket !== generation.current) return;
                if (evidence.id !== e.id || evidence.hash !== e.hash)
                  throw Error('Evidence identity changed. Refresh queue.');
                const bytes = Uint8Array.from(atob(evidence.body), (c) =>
                  c.charCodeAt(0),
                );
                await saveDownload(
                  new Blob([bytes], { type: 'application/octet-stream' }),
                  'ccil-original-liquidity.xlsx',
                );
              })
            }
          >
            Download retained liquidity workbook
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                denied ||
                reason.trim().length < 20 ||
                (decision === 'publish' && (!queue.enabled || !e.data))
              }
              onClick={() =>
                void action(async () => {
                  const ticket = generation.current,
                    owner = session.current;
                  CcilLiquidityEditionSchema.parse(
                    await request(
                      `/ops/bond-liquidity/${e.id}/review`,
                      { requestId: crypto.randomUUID(), decision, reason },
                      'POST',
                    ),
                  );
                  if (
                    live.current &&
                    ticket === generation.current &&
                    owner === session.current
                  )
                    await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed liquidity'
                : 'Withdraw liquidity'}
            </button>
          ))}
        </article>
      ))}
      <nav aria-label="Liquidity capture pages">
        <button
          disabled={busy || denied || !history.length}
          onClick={() =>
            void action(async () => {
              await load(history.at(-1) ?? null);
              if (live.current) setHistory((v) => v.slice(0, -1));
            })
          }
        >
          Previous liquidity captures
        </button>
        <button
          disabled={busy || denied || !queue?.nextCursor}
          onClick={() =>
            void action(async () => {
              const previous = cursor;
              await load(queue?.nextCursor ?? null);
              if (live.current) setHistory((v) => [...v, previous]);
            })
          }
        >
          Older liquidity captures
        </button>
      </nav>
    </section>
  );
}
