import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  FactsheetListSchema,
  FactsheetEditionSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
import { FactsheetValues } from './FundFactsheet';
export function FundFactsheetOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof FactsheetListSchema.parse
    > | null>(null),
    [source, setSource] = useState(
      'https://www.kotakmf.com/factsheet/August_2026/kotak/ASSET-ALLOCATOR.html',
    ),
    [permission, setPermission] = useState(''),
    [rights, setRights] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [direct, setDirect] = useState(''),
    [regular, setRegular] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const generation = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const clear = () => {
    generation.current++;
    setFile(null);
    setRights(false);
    if (fileInput.current) fileInput.current.value = '';
  };
  const load = async (next: string | null = cursor) => {
    const current = generation.current,
      raw = await request(
        '/ops/fund-factsheets' +
          (next ? '?cursor=' + encodeURIComponent(next) : ''),
      );
    if (current === generation.current) {
      setQueue(FactsheetListSchema.parse(raw));
      setCursor(next);
    }
  };
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      if (e instanceof RequestError && (e.status === 401 || e.status === 403)) {
        clear();
        setQueue(null);
        onDenied?.();
      }
      setMessage(
        e instanceof Error ? e.message : 'Factsheet operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    generation.current++;
    setCursor(null);
    setHistory([]);
    setQueue(null);
    setFile(null);
    setRights(false);
    if (fileInput.current) fileInput.current.value = '';
    request('/ops/fund-factsheets')
      .then((raw) => {
        if (active) setQueue(FactsheetListSchema.parse(raw));
      })
      .catch((e) => {
        if (active) {
          setMessage('Factsheet queue unavailable. Retry.');
          if (
            e instanceof RequestError &&
            (e.status === 401 || e.status === 403)
          )
            onDenied?.();
        }
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [request, onDenied]);
  return (
    <section aria-label="Factsheet Operations">
      <h3>AMC factsheet review</h3>
      <p>
        Verified Kotak Multi Asset Omni FOF monthly HTML format. Independently
        map both Direct and Regular AMFI identities. BER is not total expense
        ratio.
      </p>
      <label>
        Factsheet original URL
        <input
          disabled={busy}
          value={source}
          onChange={(e) => {
            clear();
            setSource(e.target.value);
          }}
        />
      </label>
      <label>
        Factsheet permission reference
        <textarea
          disabled={busy}
          value={permission}
          onChange={(e) => {
            clear();
            setPermission(e.target.value);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
        />
        I confirm source retention, public web display and offline distribution
        rights for this deployment.
      </label>
      <label>
        Original factsheet HTML
        <input
          ref={fileInput}
          type="file"
          accept=".html"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        disabled={busy || !file || !rights || permission.trim().length < 20}
        onClick={() =>
          void action(async () => {
            const current = generation.current;
            if (!file || file.size > 1000000)
              throw Error('Choose an HTML file up to1MB.');
            const body = await file.text();
            if (current !== generation.current) return;
            const receipt = FactsheetEditionSchema.parse(
              await request(
                '/ops/fund-factsheets/import',
                {
                  requestId: crypto.randomUUID(),
                  sourceUrl: source,
                  body,
                  permissionReference: permission,
                  rightsConfirmed: true,
                },
                'POST',
              ),
            );
            if (current !== generation.current) return;
            setMessage('Factsheet retained: ' + receipt.state);
            setHistory([]);
            await load(null);
          })
        }
      >
        Retain factsheet
      </button>
      <button disabled={busy} onClick={() => void action(load)}>
        Refresh factsheet queue
      </button>
      <label>
        Direct AMFI scheme code
        <input
          disabled={busy}
          value={direct}
          onChange={(e) => setDirect(e.target.value)}
        />
      </label>
      <label>
        Regular AMFI scheme code
        <input
          disabled={busy}
          value={regular}
          onChange={(e) => setRegular(e.target.value)}
        />
      </label>
      <label>
        Factsheet review reason
        <textarea
          disabled={busy}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {message && <p role="status">{message}</p>}
      {!queue && !message && <p role="status">Loading factsheets…</p>}
      {queue?.editions.length === 0 && <p>No factsheets retained.</p>}
      {queue?.editions.map((e) => (
        <article key={e.id}>
          <h4>
            {e.id} · {e.state}
          </h4>
          {e.error && <p role="alert">{e.error}</p>}
          {e.values && <FactsheetValues values={e.values} />}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const raw = z
                  .strictObject({
                    id: z.uuid(),
                    hash: z.string(),
                    body: z.string().max(1000000),
                  })
                  .parse(
                    await request(`/ops/fund-factsheets/${e.id}/evidence`),
                  );
                if (raw.id !== e.id || raw.hash !== e.hash)
                  throw Error('Evidence identity changed. Refresh the queue.');
                await saveDownload(
                  new Blob([raw.body], { type: 'text/plain' }),
                  'retained-factsheet.html.txt',
                );
              })
            }
          >
            Download retained factsheet
          </button>
          <button
            disabled={
              busy ||
              !e.values ||
              reason.trim().length < 10 ||
              !/^\d{5,8}$/.test(direct) ||
              !/^\d{5,8}$/.test(regular) ||
              direct === regular
            }
            onClick={() =>
              void action(async () => {
                await request(
                  `/ops/fund-factsheets/${e.id}/review`,
                  {
                    requestId: crypto.randomUUID(),
                    decision: 'publish',
                    reason,
                    plans: [
                      { plan: 'Direct', schemeCode: direct },
                      { plan: 'Regular', schemeCode: regular },
                    ],
                  },
                  'POST',
                );
                await load();
              })
            }
          >
            Publish factsheet mappings
          </button>
          <button
            disabled={busy || reason.trim().length < 10}
            onClick={() =>
              void action(async () => {
                await request(
                  `/ops/fund-factsheets/${e.id}/review`,
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
            Withdraw factsheet
          </button>
        </article>
      ))}
      <nav aria-label="Factsheet queue pages">
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
