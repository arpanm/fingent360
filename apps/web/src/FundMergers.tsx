import { useEffect, useRef, useState } from 'react';
import {
  FundMergerListSchema,
  FundMergerEditionSchema,
  MERGING_SCHEMES,
  HDFC_MERGER_URL,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
type Edition = ReturnType<typeof FundMergerEditionSchema.parse>;
export function FundMergerTerms({ edition }: { edition: Edition }) {
  return (
    <article>
      <h4>
        {edition.terms.from} → {edition.terms.to}
      </h4>
      <p>
        Announced effective date {edition.terms.effectiveOn}, close of business.
        Notice dated {edition.terms.noticeDate}. Status: {edition.state}.
      </p>
      <p>
        This reviewed notice records an announced scheme relationship, not
        investor-level execution confirmation. Conversion ratio, unit allocation
        and continuous NAV-series treatment are not established; your holdings
        and cash flows are unchanged.
      </p>
      {edition.mapping && (
        <p>
          From {edition.mapping.from.observation.name} (AMFI{' '}
          {edition.mapping.from.observation.schemeCode}) →{' '}
          {edition.mapping.to.observation.name} (AMFI{' '}
          {edition.mapping.to.observation.schemeCode}). Each exact historical
          plan identity is retained separately.
        </p>
      )}
      <a href={HDFC_MERGER_URL} target="_blank" rel="noreferrer">
        Original HDFC merger notice
      </a>
      <details>
        <summary>Merger provenance</summary>
        <p>
          Retained {edition.recordedAt}; original upload retrieval time unknown.
          SHA256 {edition.hash}. Named review {edition.reviewedAt ?? 'pending'};
          manual extraction, not automatic PDF interpretation.
        </p>
      </details>
    </article>
  );
}
export function FundMergerReader({ schemeCode }: { schemeCode?: string }) {
  const [data, setData] = useState<ReturnType<
      typeof FundMergerListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load(after?: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (schemeCode) params.set('schemeCode', schemeCode);
      if (after) params.set('after', after);
      const value = FundMergerListSchema.parse(
        await json('/fund-mergers?' + params),
      );
      if (ticket === generation.current)
        setData((old) => ({
          ...value,
          editions: after
            ? [...(old?.editions ?? []), ...value.editions]
            : value.editions,
        }));
    } catch (e) {
      if (ticket === generation.current)
        setError(
          e instanceof Error ? e.message : 'Merger lineage unavailable.',
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      generation.current++;
    };
  }, [schemeCode]);
  return (
    <section className="panel" aria-label="Fund merger lineage">
      <h3>Scheme merger history</h3>
      <p>
        Reviewed original notices, not automatic portfolio conversions.
        Downloaded app records cannot establish later withdrawals without a
        refreshed snapshot.
      </p>
      {busy && <p role="status">Loading merger lineage…</p>}
      {error && (
        <p role="alert">
          {error} Shown captures, if any, are historical until reload succeeds.
        </p>
      )}
      <button disabled={busy} onClick={() => void load()}>
        Reload merger lineage
      </button>
      {data?.editions.length === 0 && (
        <p>No admitted merger notice is retained for these schemes.</p>
      )}
      {data?.editions.map((edition) => (
        <FundMergerTerms key={edition.id} edition={edition} />
      ))}
      {data?.nextCursor && (
        <button disabled={busy} onClick={() => void load(data.nextCursor!)}>
          More merger notices
        </button>
      )}
    </section>
  );
}
export function FundMergerOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [rows, setRows] = useState<ReturnType<
      typeof FundMergerListSchema.parse
    > | null>(null),
    [from, setFrom] = useState<(typeof MERGING_SCHEMES)[number]>(
      MERGING_SCHEMES[0],
    ),
    [body, setBody] = useState(''),
    [permission, setPermission] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [fromCode, setFromCode] = useState(''),
    [toCode, setToCode] = useState(''),
    [reason, setReason] = useState(''),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const epoch = useRef(0),
    live = useRef(true),
    captureId = useRef(crypto.randomUUID());
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      epoch.current++;
      setRows(null);
      setBody('');
      setPermission('');
      setReason('');
      onDenied?.();
    }
    setError(e instanceof Error ? e.message : 'Merger operation failed.');
  }
  async function load(after?: string) {
    const ticket = ++epoch.current;
    const value = FundMergerListSchema.parse(
      await request(
        '/ops/fund-mergers' +
          (after ? '?after=' + encodeURIComponent(after) : ''),
      ),
    );
    if (live.current && ticket === epoch.current)
      setRows((old) => ({
        ...value,
        editions: after
          ? [...(old?.editions ?? []), ...value.editions]
          : value.editions,
      }));
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      fail(e);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void action(() => load());
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, [request]);
  return (
    <section aria-label="Fund merger Operations">
      <h3>Retain and review a fund merger notice</h3>
      <p>
        Initial source: HDFC9December2021. An envelope check does not interpret
        the PDF. A separate named reviewer must inspect the original and old/new
        AMFI plans. No conversion ratios are supplied.
      </p>
      <a href={HDFC_MERGER_URL} target="_blank" rel="noreferrer">
        Download official merger notice
      </a>
      <label>
        Merging scheme
        <select
          disabled={busy}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value as typeof from);
            captureId.current = crypto.randomUUID();
          }}
        >
          {MERGING_SCHEMES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Merger retention permission
        <input
          disabled={busy}
          value={permission}
          onChange={(e) => {
            setPermission(e.target.value);
            captureId.current = crypto.randomUUID();
          }}
        />
      </label>
      <label>
        Original merger PDF
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ticket = ++epoch.current;
            void action(async () => {
              if (file.size > 1500000) throw Error('Original exceeds1.5MB.');
              const bytes = new Uint8Array(await file.arrayBuffer());
              let binary = '';
              for (const b of bytes) binary += String.fromCharCode(b);
              if (live.current && ticket === epoch.current) {
                setBody(btoa(binary));
                captureId.current = crypto.randomUUID();
              }
            });
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm this is the linked original notice and retention is permitted.
      </label>
      <button
        disabled={busy || !body || permission.trim().length < 10 || !confirmed}
        onClick={() =>
          void action(async () => {
            FundMergerEditionSchema.parse(
              await request(
                '/ops/fund-mergers/import',
                {
                  requestId: captureId.current,
                  from,
                  body,
                  permissionReference: permission,
                  originalConfirmed: true,
                },
                'POST',
              ),
            );
            await load();
          })
        }
      >
        Retain merger notice
      </button>
      <button disabled={busy} onClick={() => void action(() => load())}>
        Refresh merger queue
      </button>
      <label>
        Old AMFI plan code
        <input value={fromCode} onChange={(e) => setFromCode(e.target.value)} />
      </label>
      <label>
        New AMFI plan code
        <input value={toCode} onChange={(e) => setToCode(e.target.value)} />
      </label>
      <label>
        Merger review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I checked the original notice and exact plans; no conversion ratio is
        established.
      </label>
      {error && <p role="alert">{error}</p>}
      {rows?.editions.length === 0 && <p>No retained notices.</p>}
      {rows?.editions.map((edition) => (
        <div key={edition.id}>
          <FundMergerTerms edition={edition} />
          {edition.error && <p role="alert">{edition.error}</p>}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const raw = (await request(
                  '/ops/fund-mergers/' + edition.id + '/evidence',
                )) as { id: string; hash: string; body: string };
                if (
                  raw.id !== edition.id ||
                  raw.hash !== edition.hash ||
                  typeof raw.body !== 'string'
                )
                  throw Error('Original identity mismatch.');
                const bytes = Uint8Array.from(atob(raw.body), (c) =>
                  c.charCodeAt(0),
                );
                await saveDownload(
                  new Blob([bytes], { type: 'application/pdf' }),
                  'retained-merger-notice.pdf',
                );
              })
            }
          >
            Inspect retained merger PDF
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' &&
                  (!checked ||
                    !/^\d{5,8}$/.test(fromCode) ||
                    !/^\d{5,8}$/.test(toCode) ||
                    !!edition.error))
              }
              onClick={() =>
                void action(async () => {
                  await request(
                    '/ops/fund-mergers/' + edition.id + '/review',
                    {
                      requestId: crypto.randomUUID(),
                      decision,
                      fromCode: fromCode || undefined,
                      toCode: toCode || undefined,
                      reason,
                      originalAndPlansChecked: checked,
                    },
                    'POST',
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed merger'
                : 'Withdraw merger'}
            </button>
          ))}
        </div>
      ))}
      {rows?.nextCursor && (
        <button
          disabled={busy}
          onClick={() => void action(() => load(rows.nextCursor!))}
        >
          More merger queue
        </button>
      )}
    </section>
  );
}
