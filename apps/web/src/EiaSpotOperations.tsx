import { useEffect, useRef, useState } from 'react';
import {
  EiaSpotQueueSchema,
  EiaSpotReceiptSchema,
  EiaSpotGateSchema,
  EiaSpotReviewSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { EiaSpotView } from './EiaSpot';
export function EiaSpotOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied: () => void;
}) {
  const [q, setQ] = useState<ReturnType<
      typeof EiaSpotQueueSchema.parse
    > | null>(null),
    [rights, setRights] = useState(''),
    [enabled, setEnabled] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [body, setBody] = useState(''),
    [reason, setReason] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [raw, setRaw] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    loadSequence = useRef(0),
    pending = useRef<{ key: string; id: string } | null>(null);
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      setQ(null);
      setRaw('');
      setBody('');
      onDenied();
    }
    setError(e instanceof Error ? e.message : 'Daily source operation failed.');
  }
  async function load(older = false) {
    const sequence = ++loadSequence.current;
    setBusy(true);
    try {
      const data = EiaSpotQueueSchema.parse(
        await request(
          '/ops/eia-spot' + (older && q?.next ? '?after=' + q.next : ''),
        ),
      );
      if (live.current && sequence === loadSequence.current) {
        setQ((v) =>
          older && v ? { ...data, items: [...v.items, ...data.items] } : data,
        );
        if (!older) {
          setRights(data.gate.rightsEvidence);
          setEnabled(data.gate.enabled);
        }
      }
    } catch (e) {
      if (
        live.current &&
        (sequence === loadSequence.current ||
          (e instanceof RequestError && e.status === 401))
      )
        fail(e);
    } finally {
      if (live.current && sequence === loadSequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      epoch.current++;
      loadSequence.current++;
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const key = JSON.stringify({ path, value });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const result = await request(
        '/ops/eia-spot/' + path,
        path === 'gate' ? value : { ...value, requestId: pending.current.id },
        'POST',
      );
      if (path === 'gate') EiaSpotGateSchema.parse(result);
      else if (path === 'review') EiaSpotReviewSchema.parse(result);
      else EiaSpotReceiptSchema.parse(result);
      if (live.current) {
        pending.current = null;
        setConfirmed(false);
        setReviewed(false);
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Daily oil source operations">
      <h2>EIA daily crude spot</h2>
      <p>
        Source data is contributed by Refinitiv/LSEG. A public EIA page does not
        grant contributor redistribution rights. Gate defaults disabled; another
        named reviewer publishes captures.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh daily queue
      </button>
      {q?.next && (
        <button disabled={busy} onClick={() => void load(true)}>
          Load older daily captures
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Working on daily source…</p>}
      <fieldset disabled={busy || !q}>
        <legend>Source permission</legend>
        <label>
          Contributor permission reference
          <textarea
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
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setConfirmed(false);
            }}
          />
          Enable permitted acquisition and display
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I verified contributor storage, display and offline rights.
        </label>
        <button
          disabled={
            !confirmed ||
            !EiaSpotGateSchema.safeParse({ enabled, rightsEvidence: rights })
              .success
          }
          onClick={() => void send('gate', { enabled, rightsEvidence: rights })}
        >
          Save daily source permission
        </button>
      </fieldset>
      <label>
        Original EIA daily HTML
        <input
          disabled={busy || !q?.gate.enabled}
          type="file"
          accept=".html,.htm"
          onChange={(e) => {
            const sequence = ++epoch.current,
              file = e.target.files?.[0];
            setBody('');
            if (!file) return;
            if (file.size > 1000000) {
              setError('Choose original HTML below 1 MB.');
              return;
            }
            void file
              .text()
              .then((v) => {
                if (live.current && sequence === epoch.current) setBody(v);
              })
              .catch(fail);
          }}
        />
      </label>
      <button
        disabled={busy || !q?.gate.enabled || !body}
        onClick={() => void send('capture', { body })}
      >
        Retain daily HTML
      </button>
      <button
        disabled={busy || !q?.gate.enabled}
        onClick={() => void send('fetch', {})}
      >
        Fetch original daily table
      </button>
      <label>
        Daily source review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I independently verified crude units, dates, cells and rights.
      </label>
      {q?.items.length === 0 && <p>No daily captures yet.</p>}
      {q?.items.map(({ receipt, state }) => (
        <div key={receipt.id}>
          <EiaSpotView receipt={receipt} />
          <p>State: {state}</p>
          <button
            disabled={busy}
            onClick={() =>
              void request(`/ops/eia-spot/${receipt.id}/evidence`)
                .then((v) => {
                  if (
                    live.current &&
                    v &&
                    typeof v === 'object' &&
                    'body' in v &&
                    typeof v.body === 'string'
                  )
                    setRaw(v.body);
                })
                .catch(fail)
            }
          >
            Inspect daily original
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' && (!reviewed || !q.gate.enabled))
              }
              onClick={() =>
                void send('review', {
                  id: receipt.id,
                  decision,
                  reason,
                  confirmed: reviewed,
                })
              }
            >
              {decision === 'publish'
                ? 'Publish daily capture'
                : 'Withdraw daily capture'}
            </button>
          ))}
        </div>
      ))}
      {raw && (
        <details open>
          <summary>Original daily HTML, untrusted text</summary>
          <pre>{raw}</pre>
          <button onClick={() => setRaw('')}>Close daily original</button>
        </details>
      )}
    </section>
  );
}
