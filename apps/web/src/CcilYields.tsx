import { useEffect, useState } from 'react';
import {
  CcilYieldsListSchema,
  CcilEditionSchema,
  CcilEvidenceSchema,
  type CcilYieldSchema,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
function YieldRows({ rows }: { rows: z.infer<typeof CcilYieldSchema>[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <caption>Reported indicative yields · percent per year</caption>
        <thead>
          <tr>
            <th>Tenor</th>
            <th>Source security label</th>
            <th>YTM %</th>
            <th>Convention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tenor}>
              <td>{row.tenor}</td>
              <td>{row.security}</td>
              <td>{row.ytmPercent}</td>
              <td>
                {row.convention === 'primary-auction-cutoff'
                  ? 'Primary auction cutoff'
                  : 'Indicative benchmark'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function CcilYieldsReader() {
  const [data, setData] = useState<ReturnType<
      typeof CcilYieldsListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    json('/bond-yields', undefined, 'GET', abort.signal)
      .then((raw) => {
        if (!abort.signal.aborted) setData(CcilYieldsListSchema.parse(raw));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Yield source unavailable.',
          );
      });
    return () => abort.abort();
  }, [retry]);
  const dates = data?.editions.map((e) => e.data?.date),
    latest = dates?.[0],
    current = data?.editions.filter((e) => e.data?.date === latest) ?? [];
  return (
    <section aria-label="Government bond yield context">
      <h3>Government bond yield context</h3>
      <p>
        Indicative benchmark yields and primary auction cutoffs are different
        measures. These are not executable prices, a zero-coupon curve, credit
        ratings or priced holdings.
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
            {i === 0 ? 'Latest retained edition' : 'Retained history'}
          </summary>
          <p>
            Retrieved {edition.retrievedAt}; reviewed {edition.reviewedAt}.
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
            CCIL original indicative yields
          </a>
          {edition.data && <YieldRows rows={edition.data.rows} />}
        </details>
      ))}
    </section>
  );
}
export function CcilYieldsOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof CcilYieldsListSchema.parse
    > | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const load = async () =>
    setQueue(CcilYieldsListSchema.parse(await request('/ops/bond-yields')));
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
    request('/ops/bond-yields')
      .then((raw) => {
        if (alive) setQueue(CcilYieldsListSchema.parse(raw));
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
    };
  }, [request, onDenied]);
  return (
    <section aria-label="CCIL yield Operations">
      <h3>CCIL yield source review</h3>
      <p>
        Activation requires a server-configured written CCIL permission covering
        retention and intended distribution. Publication requires a different
        named reviewer. Downloaded source HTML is inert evidence.
      </p>
      {queue && !queue.enabled && (
        <p>
          Source disabled; existing evidence remains inspectable and
          withdrawable.
        </p>
      )}
      <button
        disabled={busy || !queue?.enabled}
        onClick={() =>
          void action(async () => {
            CcilEditionSchema.parse(
              await request(
                '/ops/bond-yields/fetch',
                { requestId: crypto.randomUUID() },
                'POST',
              ),
            );
            await load();
          })
        }
      >
        Fetch original yield page
      </button>
      <label>
        Import unchanged CCIL HTML
        <input
          type="file"
          accept=".html,text/html"
          disabled={busy || !queue?.enabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void action(async () => {
              if (file.size > 500000) throw Error('Source exceeds500KB.');
              CcilEditionSchema.parse(
                await request(
                  '/ops/bond-yields/import',
                  { requestId: crypto.randomUUID(), body: await file.text() },
                  'POST',
                ),
              );
              await load();
            });
          }}
        />
      </label>
      <button disabled={busy} onClick={() => void action(load)}>
        Refresh yield queue
      </button>
      <label>
        Yield review reason
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
          {edition.data && <YieldRows rows={edition.data.rows} />}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const evidence = CcilEvidenceSchema.parse(
                  await request(`/ops/bond-yields/${edition.id}/evidence`),
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
                  CcilEditionSchema.parse(
                    await request(
                      `/ops/bond-yields/${edition.id}/review`,
                      { requestId: crypto.randomUUID(), decision, reason },
                      'POST',
                    ),
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed yields'
                : 'Withdraw yields'}
            </button>
          ))}
        </article>
      ))}
    </section>
  );
}
