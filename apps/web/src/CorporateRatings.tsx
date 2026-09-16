import { useEffect, useRef, useState } from 'react';
import {
  CorporateRatingListSchema,
  CorporateRatingEditionSchema,
  CORPORATE_RATING_SOURCE,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
type Edition = ReturnType<typeof CorporateRatingEditionSchema.parse>;
function RatingEvidence({
  edition,
  isin,
}: {
  edition: Edition;
  isin?: string;
}) {
  return (
    <article>
      <h4>HUDCO · ICRA historical instrument evidence</h4>
      <p>
        Publication {edition.publishedOn}; annexure as-of {edition.annexureAsOf}
        . Editorial status: {edition.state}. This retained historical opinion
        does not establish today's outstanding rating.
      </p>
      {edition.observations
        .filter((o) => !isin || o.isin === isin)
        .map((o) => (
          <section key={o.isin} aria-label={'Rating ' + o.isin}>
            <h5>{o.isin}</h5>
            <p>
              {o.instrument} · coupon {o.couponPercent}% · maturity{' '}
              {o.maturityOn}
            </p>
            <p>
              {o.rating} ({o.outlook}) ·{' '}
              {o.agencyStatus === 'withdrawn-by-agency'
                ? 'Withdrawn by ICRA; historical rating is not outstanding.'
                : 'Rated in this original; latest surveillance is not verified.'}
            </p>
            <p>
              A rating withdrawal is not a default declaration. No market price,
              trading liquidity or buy/sell/hold recommendation is provided.
            </p>
          </section>
        ))}
      <details>
        <summary>Rating original and version</summary>
        <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
          Original ICRA rationale
        </a>
        <p>
          Source: ICRA Limited, acknowledged under the original's permitted-use
          statement. Version {edition.version}; SHA256 {edition.hash}. Captured{' '}
          {edition.recordedAt}; upload retrieval time unknown. Independent
          review {edition.reviewedAt ?? 'pending'}.
        </p>
      </details>
    </article>
  );
}
export function CorporateRatingsReader() {
  const [rows, setRows] = useState<ReturnType<
      typeof CorporateRatingListSchema.parse
    > | null>(null),
    [isin, setIsin] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  async function load(after?: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const value = CorporateRatingListSchema.parse(
        await json(
          '/corporate-ratings' +
            (after ? '?after=' + encodeURIComponent(after) : ''),
        ),
      );
      if (ticket === generation.current)
        setRows((old) => ({
          ...value,
          editions: after
            ? [...(old?.editions ?? []), ...value.editions]
            : value.editions,
        }));
    } catch (e) {
      if (ticket === generation.current)
        setError(
          e instanceof Error ? e.message : 'Rating evidence unavailable.',
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);
  return (
    <section className="panel" aria-label="Corporate rating history">
      <h3>Understand bond credit evidence</h3>
      <p>
        Agency opinions are distinct from market prices and trading liquidity.
        Offline evidence reflects the downloaded review state, not live
        surveillance.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh rating evidence
      </button>
      <label>
        Instrument rating filter
        <select value={isin} onChange={(e) => setIsin(e.target.value)}>
          <option value="">All three researched instruments</option>
          {['INE031A08939', 'INE031A08848', 'INE031A08855'].map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
      </label>
      {busy && <p role="status">Loading rating history…</p>}
      {error && <p role="alert">{error} Refresh to retry.</p>}
      {rows?.editions.length === 0 && (
        <p>No independently reviewed rating source is retained.</p>
      )}
      {!error &&
        rows?.editions.map((edition) => (
          <RatingEvidence key={edition.id} edition={edition} isin={isin} />
        ))}
      {rows?.nextCursor && (
        <button disabled={busy} onClick={() => void load(rows.nextCursor!)}>
          More rating history
        </button>
      )}
    </section>
  );
}
export function CorporateRatingsOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [rows, setRows] = useState<ReturnType<
      typeof CorporateRatingListSchema.parse
    > | null>(null),
    [body, setBody] = useState(''),
    [permission, setPermission] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [checked, setChecked] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const epoch = useRef(0),
    live = useRef(true),
    id = useRef(crypto.randomUUID());
  async function load(after?: string) {
    const ticket = ++epoch.current;
    const value = CorporateRatingListSchema.parse(
      await request(
        '/ops/corporate-ratings' +
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
      if (live.current) {
        if (e instanceof RequestError && e.status === 401) {
          epoch.current++;
          setRows(null);
          setBody('');
          setPermission('');
          setReason('');
          onDenied?.();
        }
        setError(
          e instanceof Error
            ? e.message
            : 'Rating source operation unavailable.',
        );
      }
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
    <section aria-label="Corporate rating Operations">
      <h3>Retain and review an exact rating original</h3>
      <p>
        <a href={CORPORATE_RATING_SOURCE.url} target="_blank" rel="noreferrer">
          ICRA HUDCO original142975
        </a>{' '}
        · only this verified PDF revision is supported. Different bytes
        quarantine. ICRA permits use of this original with acknowledgement;
        record applicable permission, not a claim about all agency content.
      </p>
      <label>
        Original ICRA rating PDF
        <input
          type="file"
          accept=".pdf"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            const ticket = ++epoch.current;
            setBody('');
            setConfirmed(false);
            id.current = crypto.randomUUID();
            if (!file) return;
            void action(async () => {
              if (file.size > 2000000) throw Error('Original exceeds2MB.');
              const bytes = new Uint8Array(await file.arrayBuffer());
              let raw = '';
              for (const byte of bytes) raw += String.fromCharCode(byte);
              if (live.current && ticket === epoch.current) {
                setBody(btoa(raw));
                id.current = crypto.randomUUID();
              }
            });
          }}
        />
      </label>
      <label>
        Rating source permission
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
          disabled={busy}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm the original and ICRA attribution requirements.
      </label>
      <button
        disabled={busy || !body || permission.trim().length < 10 || !confirmed}
        onClick={() =>
          void action(async () => {
            CorporateRatingEditionSchema.parse(
              await request(
                '/ops/corporate-ratings/import',
                {
                  requestId: id.current,
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
        Retain rating original
      </button>
      <button disabled={busy} onClick={() => void action(() => load())}>
        Refresh rating queue
      </button>
      <label>
        Rating editorial review reason
        <textarea
          disabled={busy}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I independently checked the exact original, ISIN rows, dates and agency
        withdrawal labels.
      </label>
      {error && <p role="alert">{error}</p>}
      {rows?.editions.length === 0 && <p>No originals retained.</p>}
      {rows?.editions.map((edition) => (
        <div key={edition.id}>
          <RatingEvidence edition={edition} />
          {edition.error && <p role="alert">{edition.error}</p>}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const raw = (await request(
                  '/ops/corporate-ratings/' + edition.id + '/evidence',
                )) as { hash: string; body: string };
                if (raw.hash !== edition.hash || typeof raw.body !== 'string')
                  throw Error('Original identity changed.');
                await saveDownload(
                  new Blob(
                    [Uint8Array.from(atob(raw.body), (c) => c.charCodeAt(0))],
                    { type: 'application/pdf' },
                  ),
                  'icra-rating-original.pdf',
                );
              })
            }
          >
            Inspect retained rating PDF
          </button>
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
                    '/ops/corporate-ratings/' + edition.id + '/review',
                    {
                      requestId: crypto.randomUUID(),
                      decision,
                      reason,
                      originalChecked: checked,
                      sourceHash: edition.hash,
                      version: edition.version,
                    },
                    'POST',
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed rating'
                : 'Withdraw editorial rating source'}
            </button>
          ))}
        </div>
      ))}
      {rows?.nextCursor && (
        <button
          disabled={busy}
          onClick={() => void action(() => load(rows.nextCursor!))}
        >
          More rating queue
        </button>
      )}
    </section>
  );
}
