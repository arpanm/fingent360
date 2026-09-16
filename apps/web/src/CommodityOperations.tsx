import { downloadCommodityOriginal } from './commodity-download';
import { useEffect, useRef, useState } from 'react';
import {
  CommodityQueueSchema,
  CommodityCaptureSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function CommodityOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [rows, setRows] = useState<
      ReturnType<typeof CommodityQueueSchema.parse>['items']
    >([]),
    [next, setNext] = useState<string | null>(null),
    [body, setBody] = useState<string | undefined>(),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reviewConfirmed, setReviewConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    intent = useRef<{ key: string; id: string } | null>(null);
  async function load(after?: string) {
    const value = CommodityQueueSchema.parse(
      await request(
        '/ops/commodity-benchmarks' + (after ? '?after=' + after : ''),
      ),
    );
    if (live.current) {
      setRows(value.items);
      setNext(value.next);
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (live.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Commodity capture unavailable.',
        );
        if (
          cause instanceof RequestError &&
          (cause.status === 401 || cause.status === 403)
        ) {
          epoch.current++;
          setRows([]);
          setBody(undefined);
          setRights('');
          setConfirmed(false);
          setReviewConfirmed(false);
          setReason('');
          setNext(null);
          intent.current = null;
          onDenied?.();
        }
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void run(() => load());
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  function id(key: string) {
    if (intent.current?.key !== key)
      intent.current = { key, id: crypto.randomUUID() };
    return intent.current.id;
  }
  return (
    <section
      className="panel"
      aria-label="Commodity benchmark operations"
      aria-busy={busy}
    >
      <h2>Monthly commodity originals</h2>
      <p>
        World Bank Gold, Silver and Copper. Upload the original XLSX or leave it
        empty to download the fixed official workbook. These are monthly
        benchmarks, not live quotes.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Updating commodity evidence…</p>}
      <button disabled={busy} onClick={() => void run(() => load())}>
        Refresh commodity captures
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const fields = { body, rightsEvidence: rights },
              key = JSON.stringify(fields);
            await request(
              '/ops/commodity-benchmarks/capture',
              CommodityCaptureSchema.parse({ ...fields, requestId: id(key) }),
              'POST',
            );
            intent.current = null;
            setMessage(
              'Original retained; inspect the independent review below.',
            );
            await load();
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Original World Bank workbook
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0],
                  at = ++epoch.current;
                setBody(undefined);
                setConfirmed(false);
                void run(async () => {
                  if (!file) return;
                  if (file.size > 3000000)
                    throw Error('Workbook exceeds three MB.');
                  const bytes = new Uint8Array(await file.arrayBuffer());
                  let text = '';
                  for (let i = 0; i < bytes.length; i += 8192)
                    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
                  if (live.current && epoch.current === at) setBody(btoa(text));
                });
              }}
            />
          </label>
          <label>
            Retention, display and offline rights evidence
            <textarea
              required
              minLength={20}
              value={rights}
              onChange={(e) => {
                setRights(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the World Bank dataset attribution and any third-party
            conditions for this original.
          </label>
          <button disabled={!confirmed || rights.trim().length < 20}>
            Capture commodity original
          </button>
        </fieldset>
      </form>
      <label>
        Independent review reason
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReviewConfirmed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => setReviewConfirmed(e.target.checked)}
        />
        I independently verified the original values and
        retention/display/offline rights.
      </label>
      {!rows.length && <p>No retained commodity captures.</p>}
      <ol>
        {rows.map((row) => (
          <li key={row.id}>
            <h3>Capture {row.id}</h3>
            <p>
              {row.state} ·{' '}
              {row.receipt?.reportedUpdatedOn ?? 'Unsupported layout'}
            </p>
            {row.error && <p>{row.error}</p>}
            {row.receipt && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setMessage(
                        await downloadCommodityOriginal(
                          row.id,
                          row.receipt!.bodyHash,
                          true,
                          request,
                        ),
                      );
                    })
                  }
                >
                  Download retained commodity original
                </button>
                <p>
                  {row.receipt.observations.length} exact monthly cells ·{' '}
                  {row.receipt.bodyHash}
                </p>
                <details>
                  <summary>Inspect extracted source values</summary>
                  <p>Latest six observations across the selected series:</p>
                  <ul>
                    {row.receipt.observations.slice(-6).map((v) => (
                      <li key={v.series + v.period}>
                        {v.series} {v.period}: {v.value ?? 'Missing'} (original{' '}
                        {v.sourceValue ?? 'blank'})
                      </li>
                    ))}
                  </ul>
                </details>
                <button
                  disabled={
                    busy || !reviewConfirmed || reason.trim().length < 20
                  }
                  onClick={() =>
                    void run(async () => {
                      await request(
                        '/ops/commodity-benchmarks/review',
                        {
                          requestId: id('publish:' + row.id + reason),
                          id: row.id,
                          decision: 'publish',
                          reason,
                          rightsVerified: true,
                        },
                        'POST',
                      );
                      intent.current = null;
                      setReviewConfirmed(false);
                      await load();
                    })
                  }
                >
                  Publish commodity capture
                </button>
                <button
                  disabled={busy || reason.trim().length < 20}
                  onClick={() =>
                    void run(async () => {
                      await request(
                        '/ops/commodity-benchmarks/review',
                        {
                          requestId: id('withdraw:' + row.id + reason),
                          id: row.id,
                          decision: 'withdraw',
                          reason,
                          rightsVerified: false,
                        },
                        'POST',
                      );
                      intent.current = null;
                      await load();
                    })
                  }
                >
                  Withdraw commodity capture
                </button>
                <a href={'#commodities?edition=' + row.id}>
                  Open reviewed monthly reader
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
      {next && (
        <button disabled={busy} onClick={() => void run(() => load(next))}>
          Older commodity captures
        </button>
      )}
      <p>Twenty captures per page. Refresh returns to newest captures.</p>
    </section>
  );
}
