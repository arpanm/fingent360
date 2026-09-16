import { useEffect, useRef, useState } from 'react';
import {
  SovereignListSchema,
  SovereignEditionSchema,
  SovereignCalculationSchema,
  SOVEREIGN_ORIGINALS,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
type Edition = ReturnType<typeof SovereignEditionSchema.parse>;
function money(value: string) {
  const v = BigInt(value);
  return String(v / 100n) + '.' + String(v % 100n).padStart(2, '0');
}
export function SovereignBondTerms({ edition }: { edition: Edition }) {
  return (
    <article>
      <h4>
        {edition.terms.name} · {edition.terms.isin}
      </h4>
      <p>
        Historical primary auction {edition.terms.auctionOn}; settlement{' '}
        {edition.terms.settlementOn}; maturity {edition.terms.maturityOn}.{' '}
        {edition.state}.
      </p>
      <p>
        Cutoff ₹96.67 / YTM6.9655%; weighted average ₹96.69 / YTM6.9625%,
        per₹100 face value. These are different historical auction statistics,
        not an executable secondary-market quote.
      </p>
      <p>
        Coupon6.48% annually, semiannual6April/6October; par redemption. Accrual
        uses30/360. Future holiday-adjusted payment dates and liquidity are not
        established. Government issuer classification is not a credit-agency
        rating.
      </p>
      <details>
        <summary>Sovereign source provenance</summary>
        <p>
          Exact extraction version {edition.terms.version}. Issued{' '}
          {edition.terms.issuedOn}; previous coupon{' '}
          {edition.terms.previousCouponOn}; next nominal coupon{' '}
          {edition.terms.nextCouponOn}; accrued days {edition.terms.accrualDays}
          ; basis {edition.terms.basis}.
        </p>
        <p>
          Uploaded originals; retrieval time unknown. Retained{' '}
          {edition.recordedAt}. Manual extraction independently reviewed{' '}
          {edition.reviewedAt ?? 'not yet'}.
        </p>
        <ul>
          {edition.originals.map((source) => (
            <li key={source.kind}>
              <a href={source.url} target="_blank" rel="noreferrer">
                Original {source.kind}
              </a>{' '}
              · {source.dateBasis} day {source.documentDate} · SHA256{' '}
              {source.hash}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
export function SovereignBondReader() {
  const [rows, setRows] = useState<ReturnType<
      typeof SovereignListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [face, setFace] = useState('10000'),
    [price, setPrice] = useState<'cutoff' | 'weighted'>('cutoff'),
    [result, setResult] = useState<ReturnType<
      typeof SovereignCalculationSchema.parse
    > | null>(null);
  const epoch = useRef(0);
  async function load(after?: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const value = SovereignListSchema.parse(
        await json(
          '/sovereign-bonds' +
            (after ? '?after=' + encodeURIComponent(after) : ''),
        ),
      );
      if (ticket === epoch.current)
        setRows((old) => ({
          ...value,
          editions: after
            ? [...(old?.editions ?? []), ...value.editions]
            : value.editions,
        }));
    } catch (e) {
      if (ticket === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Historical bond source unavailable.',
        );
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, []);
  async function calculate(edition: Edition) {
    const ticket = ++epoch.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const value = SovereignCalculationSchema.parse(
        await json(
          '/sovereign-bonds/' + edition.id + '/calculate',
          { nominalPaise: String(BigInt(face) * 100n), price },
          'POST',
        ),
      );
      if (value.editionId !== edition.id)
        throw Error('Source calculation identity changed.');
      if (ticket === epoch.current) setResult(value);
    } catch (e) {
      if (ticket === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Calculation unavailable. Reload source.',
        );
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Historical sovereign bond">
      <h3>Understand an actual government-bond auction</h3>
      <p>
        A retained historical example, not a current offer. Nominal amount stays
        in this transient calculation; no holding or account record is created.
        Offline results depend on the downloaded review state.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Reload sovereign originals
      </button>
      {busy && <p role="status">Loading sovereign source…</p>}
      {error && (
        <p role="alert">{error} Reload before relying on retained context.</p>
      )}
      {rows?.editions.length === 0 && (
        <p>No independently reviewed source pack is retained.</p>
      )}
      <label>
        Nominal face value in rupees
        <input
          value={face}
          disabled={busy}
          inputMode="numeric"
          onChange={(e) => {
            setFace(e.target.value);
            setResult(null);
          }}
        />
      </label>
      <label>
        Historical auction price basis
        <select
          disabled={busy}
          value={price}
          onChange={(e) => {
            setPrice(e.target.value as typeof price);
            setResult(null);
          }}
        >
          <option value="cutoff">Auction cutoff</option>
          <option value="weighted">Weighted auction average</option>
        </select>
      </label>
      {rows?.editions.map((edition) => (
        <div key={edition.id}>
          <SovereignBondTerms edition={edition} />
          <button
            disabled={busy || !!error || !/^[1-9]\d{1,11}$/.test(face)}
            onClick={() => void calculate(edition)}
          >
            Calculate historical settlement
          </button>
        </div>
      ))}
      {result && (
        <section aria-label="Historical settlement calculation">
          <h4>Settlement illustration on {result.settlementOn}</h4>
          <p>
            Clean ₹{money(result.cleanPaise)}; accrued ₹
            {money(result.accruedPaise)}; dirty ₹{money(result.dirtyPaise)}.
            Aggregate half-up paise rounding; fees excluded. No actual execution
            price or future holiday-adjusted return is claimed.
          </p>
        </section>
      )}
      {rows?.nextCursor && (
        <button disabled={busy} onClick={() => void load(rows.nextCursor!)}>
          More historical sovereign captures
        </button>
      )}
    </section>
  );
}
export function SovereignBondOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [rows, setRows] = useState<ReturnType<
      typeof SovereignListSchema.parse
    > | null>(null),
    [files, setFiles] = useState<Record<string, string>>({}),
    [permission, setPermission] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [checked, setChecked] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    id = useRef(crypto.randomUUID());
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      epoch.current++;
      setFiles({});
      setPermission('');
      setRows(null);
      setReason('');
      onDenied?.();
    }
    setError(e instanceof Error ? e.message : 'Source operation unavailable.');
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
  async function load(after?: string) {
    const ticket = ++epoch.current;
    const value = SovereignListSchema.parse(
      await request(
        '/ops/sovereign-bonds' +
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
  useEffect(() => {
    live.current = true;
    void action(() => load());
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, [request]);
  return (
    <section aria-label="Sovereign bond Operations">
      <h3>Review four matched original sources</h3>
      <p>
        Fixed historical April2026 auction pack with August2026 identity
        corroboration. Upload actual originals. Envelope checks do not parse or
        verify document meaning; a separate named reviewer checks every source
        and the extracted terms.
      </p>
      {SOVEREIGN_ORIGINALS.map((source) => (
        <label key={source.kind}>
          <a href={source.url} target="_blank" rel="noreferrer">
            Official {source.kind} original
          </a>
          <input
            aria-label={'Upload ' + source.kind + ' original'}
            type="file"
            accept={source.mime === 'application/pdf' ? '.pdf' : '.html,.htm'}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              const ticket = ++epoch.current;
              setFiles((old) => {
                const next = { ...old };
                delete next[source.kind];
                return next;
              });
              setConfirmed(false);
              id.current = crypto.randomUUID();
              if (!file) return;
              void action(async () => {
                if (file.size > 2000000) throw Error('Original exceeds2MB.');
                const bytes = new Uint8Array(await file.arrayBuffer());
                let b = '';
                for (const v of bytes) b += String.fromCharCode(v);
                if (live.current && ticket === epoch.current) {
                  setFiles((old) => ({ ...old, [source.kind]: btoa(b) }));
                  id.current = crypto.randomUUID();
                }
              });
            }}
          />
          {files[source.kind] ? 'Attached' : 'Required'}
        </label>
      ))}
      <label>
        Sovereign source permission
        <input
          disabled={busy}
          value={permission}
          onChange={(e) => {
            setPermission(e.target.value);
            id.current = crypto.randomUUID();
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm all linked originals and applicable retention/display
        permission.
      </label>
      <button
        disabled={
          busy ||
          Object.keys(files).length !== 4 ||
          permission.trim().length < 10 ||
          !confirmed
        }
        onClick={() =>
          void action(async () => {
            SovereignEditionSchema.parse(
              await request(
                '/ops/sovereign-bonds/import',
                {
                  requestId: id.current,
                  originals: SOVEREIGN_ORIGINALS.map((source) => ({
                    kind: source.kind,
                    body: files[source.kind],
                  })),
                  permissionReference: permission,
                  originalsConfirmed: true,
                },
                'POST',
              ),
            );
            await load();
          })
        }
      >
        Retain sovereign source pack
      </button>
      <button disabled={busy} onClick={() => void action(() => load())}>
        Refresh sovereign queue
      </button>
      <label>
        Sovereign review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I independently checked all originals, identity, price units and accrual
        convention.
      </label>
      {error && <p role="alert">{error}</p>}
      {rows?.editions.length === 0 && <p>No original packs retained.</p>}
      {rows?.editions.map((edition) => (
        <div key={edition.id}>
          <SovereignBondTerms edition={edition} />
          {edition.error && <p role="alert">{edition.error}</p>}
          {edition.originals.map((original) => (
            <button
              disabled={busy}
              key={original.kind}
              onClick={() =>
                void action(async () => {
                  const raw = (await request(
                    '/ops/sovereign-bonds/' +
                      edition.id +
                      '/evidence/' +
                      original.kind,
                  )) as { hash: string; body: string };
                  if (
                    raw.hash !== original.hash ||
                    typeof raw.body !== 'string'
                  )
                    throw Error('Original identity changed.');
                  const bytes = Uint8Array.from(atob(raw.body), (c) =>
                    c.charCodeAt(0),
                  );
                  await saveDownload(
                    new Blob([bytes], {
                      type:
                        original.mime === 'application/pdf'
                          ? 'application/pdf'
                          : 'text/plain',
                    }),
                    'retained-' +
                      original.kind +
                      (original.mime === 'application/pdf' ? '.pdf' : '.txt'),
                  );
                })
              }
            >
              Inspect retained {original.kind}
            </button>
          ))}
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' && (!checked || !!edition.error))
              }
              onClick={() =>
                void action(async () => {
                  await request(
                    '/ops/sovereign-bonds/' + edition.id + '/review',
                    {
                      requestId: crypto.randomUUID(),
                      decision,
                      reason,
                      allOriginalsChecked: checked,
                      termsVersion: edition.terms.version,
                      sourceHashes: edition.originals.map((o) => o.hash),
                    },
                    'POST',
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish sovereign source pack'
                : 'Withdraw sovereign source pack'}
            </button>
          ))}
        </div>
      ))}
      {rows?.nextCursor && (
        <button
          disabled={busy}
          onClick={() => void action(() => load(rows.nextCursor!))}
        >
          More sovereign queue
        </button>
      )}
    </section>
  );
}
