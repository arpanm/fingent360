import { useEffect, useState } from 'react';
import {
  SbiPortfolioListSchema,
  SbiPortfolioEditionSchema,
  SbiPortfolioEvidenceSchema,
  FUND_PORTFOLIO_SOURCES,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
import { SbiPortfolioTable } from './SbiPortfolio';
export function SbiPortfolioOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof SbiPortfolioListSchema.parse
    > | null>(null),
    [permission, setPermission] = useState(''),
    [sourceUrl, setSourceUrl] = useState<string>(FUND_PORTFOLIO_SOURCES[0].url),
    [code, setCode] = useState(''),
    [reason, setReason] = useState(''),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const load = async () =>
    setQueue(
      SbiPortfolioListSchema.parse(await request('/ops/fund-lookthrough')),
    );
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
        error instanceof Error ? error.message : 'Portfolio operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    request('/ops/fund-lookthrough')
      .then((raw) => {
        if (active) setQueue(SbiPortfolioListSchema.parse(raw));
      })
      .catch((error) => {
        if (active) {
          setMessage('Portfolio queue unavailable. Retry.');
          if (
            error instanceof RequestError &&
            (error.status === 401 || error.status === 403)
          )
            onDenied?.();
        }
      });
    return () => {
      active = false;
    };
  }, [request, onDenied]);
  return (
    <section aria-label="AMC portfolio Operations">
      <h3>Reviewed AMC portfolio disclosures</h3>
      <p>
        Verified SBI July/August2026 and Axis NIFTY50 ETF February2026 original
        formats. Publication needs an independently reviewed AMFI scheme/plan
        mapping and permission for source storage, public display and offline
        distribution in this deployment. Source inconsistencies remain visible.
      </p>
      <label>
        Verified original disclosure
        <select
          disabled={busy}
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        >
          {FUND_PORTFOLIO_SOURCES.map((source) => (
            <option key={source.url} value={source.url}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Portfolio retention permission reference
        <input
          value={permission}
          maxLength={2000}
          onChange={(e) => setPermission(e.target.value)}
        />
      </label>
      <button
        disabled={busy || permission.trim().length < 10}
        onClick={() =>
          void action(async () => {
            const receipt = SbiPortfolioEditionSchema.parse(
              await request(
                '/ops/fund-lookthrough/fetch',
                {
                  requestId: crypto.randomUUID(),
                  sourceUrl,
                  permissionReference: permission,
                },
                'POST',
              ),
            );
            setMessage('Captured ' + receipt.state);
            await load();
          })
        }
      >
        {sourceUrl.includes('axismf.com')
          ? 'Fetch original Axis workbook'
          : 'Fetch original SBI workbook'}
      </button>
      <label>
        {sourceUrl.includes('axismf.com')
          ? 'Import original Axis workbook'
          : 'Import original SBI workbook'}
        <input
          type="file"
          accept=".xlsx"
          disabled={busy || permission.trim().length < 10}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void action(async () => {
              if (file.size > 2000000) throw Error('Workbook exceeds2MB.');
              const bytes = new Uint8Array(await file.arrayBuffer());
              let binary = '';
              for (const byte of bytes) binary += String.fromCharCode(byte);
              await request(
                '/ops/fund-lookthrough/import',
                {
                  requestId: crypto.randomUUID(),
                  sourceUrl,
                  permissionReference: permission,
                  body: btoa(binary),
                },
                'POST',
              );
              await load();
            });
          }}
        />
      </label>
      <button disabled={busy} onClick={() => void action(load)}>
        Refresh portfolio queue
      </button>
      <label>
        Reviewed AMFI scheme code
        <input value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label>
        Mapping and quality review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I acknowledge all source discrepancies; this is limited-quality
        disclosure, not reliable complete exposure.
      </label>
      {message && <p role="status">{message}</p>}
      {queue?.editions.length === 0 && <p>No captures retained.</p>}
      {queue?.editions.map((edition) => (
        <article key={edition.id}>
          <h4>
            {edition.id} · {edition.state}
          </h4>
          <p>
            {edition.hash} · {edition.retrievedAt}
          </p>
          {edition.error && <p role="alert">{edition.error}</p>}
          {edition.portfolio && (
            <SbiPortfolioTable portfolio={edition.portfolio} />
          )}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const raw = SbiPortfolioEvidenceSchema.parse(
                  await request(
                    '/ops/fund-lookthrough/' + edition.id + '/evidence',
                  ),
                );
                if (raw.id !== edition.id || raw.hash !== edition.hash)
                  throw Error(
                    'Retained evidence identity changed. Refresh the queue.',
                  );
                const binary = atob(raw.body),
                  bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
                await saveDownload(
                  new Blob([bytes], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  }),
                  'retained-amc-portfolio.xlsx',
                );
              })
            }
          >
            Download retained workbook
          </button>
          <button
            disabled={
              busy ||
              !edition.portfolio ||
              reason.trim().length < 20 ||
              !/^\d{5,8}$/.test(code)
            }
            onClick={() =>
              void action(async () => {
                await request(
                  `/ops/fund-lookthrough/${edition.id}/review`,
                  {
                    requestId: crypto.randomUUID(),
                    decision: 'publish',
                    schemeCode: code,
                    reason,
                    acknowledgeDiscrepancy: ack,
                  },
                  'POST',
                );
                await load();
              })
            }
          >
            Publish reviewed disclosure
          </button>
          <button
            disabled={busy || reason.trim().length < 20}
            onClick={() =>
              void action(async () => {
                await request(
                  `/ops/fund-lookthrough/${edition.id}/review`,
                  {
                    requestId: crypto.randomUUID(),
                    decision: 'withdraw',
                    reason,
                  },
                  'POST',
                );
                await load();
              })
            }
          >
            Withdraw disclosure
          </button>
        </article>
      ))}
    </section>
  );
}
