import { useEffect, useRef, useState } from 'react';
import {
  FILING_DISCOVERY_URL,
  FilingDiscoveryGateSchema,
  FilingDiscoveryInboxSchema,
  FilingDiscoveryCaptureSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function FilingDiscoveryOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied: () => void;
}) {
  const [data, setData] = useState<ReturnType<
      typeof FilingDiscoveryInboxSchema.parse
    > | null>(null),
    [rights, setRights] = useState(''),
    [enabled, setEnabled] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [raw, setRaw] = useState('');
  const alive = useRef(true),
    epoch = useRef(0),
    pending = useRef<{ key: string; id: string } | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  function fail(e: unknown) {
    if (!alive.current) return;
    if (e instanceof RequestError && e.status === 401) {
      setData(null);
      setRaw('');
      onDenied();
    }
    setError(e instanceof Error ? e.message : 'Filing discovery unavailable.');
  }
  async function load(kind: 'refresh' | 'items' | 'captures' = 'refresh') {
    setBusy(true);
    setError('');
    try {
      const query =
          kind === 'items' && data?.next
            ? '?after=' + data.next
            : kind === 'captures' && data?.captureNext
              ? '?captureAfter=' + data.captureNext
              : '',
        value = FilingDiscoveryInboxSchema.parse(
          await request('/ops/filing-discovery' + query),
        );
      if (alive.current) {
        setData((previous) =>
          kind === 'items' && previous
            ? {
                ...value,
                items: [...previous.items, ...value.items],
                captures: previous.captures,
                captureNext: previous.captureNext,
              }
            : kind === 'captures' && previous
              ? {
                  ...value,
                  captures: [...previous.captures, ...value.captures],
                  items: previous.items,
                  next: previous.next,
                }
              : value,
        );
        if (kind === 'refresh') {
          setRights(value.gate.rightsEvidence);
          setEnabled(value.gate.enabled);
        } else heading.current?.focus();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  async function saveGate() {
    setBusy(true);
    setError('');
    try {
      FilingDiscoveryGateSchema.parse(
        await request(
          '/ops/filing-discovery/gate',
          { enabled, rightsEvidence: rights },
          'POST',
        ),
      );
      if (alive.current) {
        setConfirmed(false);
        pending.current = null;
        setNotice(
          'Discovery permission saved. The separate research schedule controls automatic checks.',
        );
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function capture(fetch: boolean) {
    setBusy(true);
    setError('');
    const key = fetch ? 'fetch' : body;
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const receipt = FilingDiscoveryCaptureSchema.parse(
        await request(
          '/ops/filing-discovery/' + (fetch ? 'fetch' : 'capture'),
          { requestId: pending.current.id, ...(!fetch ? { body } : {}) },
          'POST',
        ),
      );
      if (alive.current) {
        pending.current = null;
        setNotice(
          `${receipt.status}: ${receipt.itemCount} discovered items. ${receipt.message}`,
        );
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Financial filing discovery"
      aria-busy={busy}
    >
      <h2 ref={heading} tabIndex={-1}>
        New filing pointers
      </h2>
      <p>
        Discovery only. This inbox does not establish security identity or parse
        financial facts. Item times have an unknown timezone. A revision hint
        never overwrites previously reviewed financials.
      </p>
      <a href={FILING_DISCOVERY_URL} target="_blank" rel="noreferrer">
        Official integrated financials RSS
      </a>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Working on filing discovery…</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh filing discovery
      </button>
      <fieldset disabled={busy}>
        <legend>RSS source permission</legend>
        <label>
          RSS retention and display permission
          <textarea
            value={rights}
            maxLength={3000}
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
          Enable permitted RSS discovery
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I verified this RSS retention and internal display permission.
        </label>
        <button
          disabled={
            !confirmed ||
            !FilingDiscoveryGateSchema.safeParse({
              enabled,
              rightsEvidence: rights,
            }).success
          }
          onClick={() => void saveGate()}
        >
          Save RSS permission
        </button>
      </fieldset>
      <p>
        Automatic research source: equity-filing-discovery. Both gate and
        schedule start disabled. If server download fails, retain the actual
        original RSS file below.
      </p>
      <fieldset disabled={busy || !data?.gate.enabled}>
        <legend>Acquire original RSS</legend>
        <label>
          Original filing RSS file
          <input
            type="file"
            accept=".xml,.rss,application/rss+xml,application/xml,text/xml"
            onChange={(e) => {
              const ticket = ++epoch.current,
                file = e.target.files?.[0];
              setBody('');
              setError('');
              pending.current = null;
              if (!file) return;
              if (file.size > 2_000_000) {
                setError('RSS exceeds2MB.');
                return;
              }
              void file
                .arrayBuffer()
                .then((bytes) => {
                  const v = new TextDecoder('utf-8', { fatal: true }).decode(
                    bytes,
                  );
                  if (alive.current && ticket === epoch.current) setBody(v);
                })
                .catch(fail);
            }}
          />
        </label>
        <button disabled={!body} onClick={() => void capture(false)}>
          Retain original RSS
        </button>
        <button onClick={() => void capture(true)}>Fetch official RSS</button>
      </fieldset>
      <h3>Discovery inbox</h3>
      {data?.items.length === 0 && <p>No filing pointers discovered yet.</p>}
      {data?.items.map((v) => (
        <article key={v.id}>
          <h4>{v.item.companyTitle}</h4>
          <p>
            {v.item.submission} · source time {v.item.publishedLiteral} ·
            timezone unknown
          </p>
          <p>{v.item.revisionRemark || 'No revision remark supplied.'}</p>
          <p>
            Observed {v.observedAt}. Security unmapped; original XML not parsed.
          </p>
          <a href={v.item.originalUrl} target="_blank" rel="noreferrer">
            Open original XML at exchange
          </a>
          <p>
            Next: acquire this original and verify its security identity and
            exact rendered-source relationship. If a supported original is
            available, use Indian equity data for independent source review.
            This discovery has not created a financial edition.
          </p>
        </article>
      ))}
      {data?.next && (
        <button disabled={busy} onClick={() => void load('items')}>
          Older filing pointers
        </button>
      )}
      <h3>Original capture history</h3>
      {data?.captures.map((c) => (
        <article key={c.id}>
          <p>
            {c.status} · {c.itemCount} items · {c.capturedAt}
          </p>
          <p>{c.message}</p>
          <code>{c.bodyHash}</code>
          <button
            disabled={busy}
            onClick={() =>
              void request('/ops/filing-discovery/' + c.id + '/evidence')
                .then((v) => {
                  if (
                    !v ||
                    typeof v !== 'object' ||
                    !('body' in v) ||
                    typeof v.body !== 'string'
                  )
                    throw Error('Original response unreadable.');
                  if (alive.current) setRaw(v.body);
                })
                .catch(fail)
            }
          >
            Inspect original RSS
          </button>
        </article>
      ))}
      {data?.captureNext && (
        <button disabled={busy} onClick={() => void load('captures')}>
          Older RSS captures
        </button>
      )}
      {raw && (
        <details open>
          <summary>Untrusted original RSS</summary>
          <pre>{raw}</pre>
          <button onClick={() => setRaw('')}>Close original RSS</button>
        </details>
      )}
    </section>
  );
}
