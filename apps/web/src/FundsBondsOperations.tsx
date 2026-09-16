import { CcilYieldsOperations } from './CcilYields';
import { AmfiHistorySelector } from './AmfiHistorySelector';
import { SbiPortfolioOperations } from './SbiPortfolioOperations';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FundNavCaptureSchema,
  FundNavEditionSchema,
  FundNavQueueSchema,
  FundNavReviewSchema,
  parseAmfiNav,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import './funds-bonds.css';
export function FundsBondsOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof FundNavQueueSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [permissionReference, setReference] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [body, setBody] = useState(''),
    [historyUrl, setHistoryUrl] = useState(''),
    [id, setId] = useState(() => crypto.randomUUID()),
    [reason, setReason] = useState(''),
    [raw, setRaw] = useState<string | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const deny = useCallback(
    (err: unknown) => {
      if (err instanceof RequestError && err.status === 401) {
        setQueue(null);
        setRaw(null);
        onDenied?.();
      }
      setError(err instanceof Error ? err.message : 'NAV operation failed.');
    },
    [onDenied],
  );
  const reload = useCallback(
    async () => setQueue(FundNavQueueSchema.parse(await request('/ops/funds'))),
    [request],
  );
  useEffect(() => {
    let alive = true;
    void request('/ops/funds')
      .then((data) => {
        if (alive) setQueue(FundNavQueueSchema.parse(data));
      })
      .catch((err: unknown) => {
        if (alive) deny(err);
      });
    return () => {
      alive = false;
    };
  }, [request, deny]);
  async function capture(fetchSource: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const metadata = {
        requestId: id,
        permissionReference,
        writtenPermissionConfirmed: confirmed,
        ...(historyUrl.trim() ? { sourceUrl: historyUrl.trim() } : {}),
      };
      if (!fetchSource) {
        FundNavCaptureSchema.parse({ ...metadata, body });
        parseAmfiNav(body, historyUrl.trim() || undefined);
      }
      const receipt = FundNavEditionSchema.parse(
        await request(
          fetchSource ? '/ops/funds/fetch' : '/ops/funds/import',
          fetchSource ? metadata : { ...metadata, body },
          'POST',
        ),
      );
      if (receipt.id !== id)
        throw Error('NAV capture receipt does not match this request.');
      setNotice(
        `${receipt.count} NAV rows retained as a draft. Review the original before publishing.`,
      );
      setId(crypto.randomUUID());
      await reload();
    } catch (err) {
      deny(err);
    } finally {
      setBusy(false);
    }
  }
  async function review(editionId: string, decision: 'publish' | 'withdraw') {
    setBusy(true);
    setError('');
    try {
      const key = JSON.stringify({ editionId, decision, reason });
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      const payload = FundNavReviewSchema.parse({
        requestId: pending.current.id,
        editionId,
        decision,
        reason,
      });
      const response = FundNavReviewSchema.parse(
        await request('/ops/funds/review', payload, 'POST'),
      );
      if (JSON.stringify(response) !== JSON.stringify(payload))
        throw Error('Review receipt does not match. Retry the same decision.');
      pending.current = null;
      setNotice(
        decision === 'publish'
          ? 'NAV edition published.'
          : 'NAV edition withdrawn from connected reads and future snapshots. Rebuild existing device bundles.',
      );
      await reload();
    } catch (err) {
      deny(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="funds-bonds" aria-label="Fund source operations">
      <CcilYieldsOperations
        request={request}
        {...(onDenied === undefined ? {} : { onDenied })}
      />
      <SbiPortfolioOperations
        request={request}
        {...(onDenied === undefined ? {} : { onDenied })}
      />
      <h2>Retain and review AMFI NAV evidence</h2>
      <p>
        AMFI's terms restrict electronic storage and redistribution. Record
        actual written permission covering this deployment before capture.
        Public accessibility alone is insufficient. Named publication requires
        another operator.
      </p>
      <p>
        The current AMFI report includes separate Plan and Option columns. Both
        current eight-column and legacy six-column files are recognized; missing
        plan/option stays unknown. AMFI states its old-format download ends 30
        September 2026. Fetch uses the current report.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => {
              setError('');
              void reload().catch(deny);
            }}
          >
            Reload NAV queue
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void capture(false);
        }}
      >
        <label>
          Written permission reference and permitted scope
          <textarea
            required
            minLength={12}
            maxLength={1000}
            value={permissionReference}
            onChange={(e) => {
              setReference(e.target.value);
              setId(crypto.randomUUID());
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{' '}
          I verified written permission for retention and display in this
          deployment, including offline device distribution.
        </label>
        <AmfiHistorySelector
          disabled={busy}
          onChoose={(url) => {
            setHistoryUrl(url);
            setId(crypto.randomUUID());
          }}
        />
        <label>
          Historical report URL (optional; leave empty for latest NAV)
          <input
            type="url"
            value={historyUrl}
            onChange={(event) => {
              setHistoryUrl(event.target.value);
              setId(crypto.randomUUID());
            }}
            placeholder="Paste the official current history download URL"
          />
        </label>
        <p>
          For history, open{' '}
          <a
            href="https://www.amfiindia.com/net-asset-value/nav-download"
            target="_blank"
            rel="noreferrer"
          >
            AMFI NAV Download
          </a>
          , select a published mutual fund and type in the current history form,
          choose the permitted dates, then paste its report URL. Upload that
          exact file or fetch it here. All 76 published AMC choices and all
          scheme types are supported; legacy history is not admitted. A
          requested range does not establish daily completeness.
        </p>
        <label>
          AMFI NAV text file
          <input
            type="file"
            accept=".txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setBody('');
              setId(crypto.randomUUID());
              if (!file) return;
              if (file.size > 4000000) {
                setError('Choose a NAV file no larger than 4 MB.');
                return;
              }
              void file.text().then(setBody).catch(deny);
            }}
          />
        </label>
        <button disabled={busy || !confirmed || !body}>
          Retain uploaded NAV file
        </button>
        <button
          type="button"
          disabled={
            busy || !confirmed || permissionReference.trim().length < 12
          }
          onClick={() => void capture(true)}
        >
          Fetch official NAV file
        </button>
      </form>
      <label>
        Review or withdrawal reason
        <textarea
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {busy && <p role="status">Processing NAV evidence…</p>}
      {!queue && !error && <p>Loading editions…</p>}
      {queue?.editions.length === 0 && <p>No NAV editions retained.</p>}
      {queue?.editions.map(({ edition, state }) => (
        <article key={edition.id}>
          <h3>
            {edition.retrievedAt.slice(0, 10)} · {edition.count} dated
            observations
          </h3>
          <p>
            {state} · {edition.id}
          </p>
          <details>
            <summary>Permission and source</summary>
            <p>{edition.permissionReference}</p>
            <p>{edition.sourceUrl}</p>
            <code>{edition.hash}</code>
          </details>
          <button
            disabled={busy}
            onClick={() => {
              void request(`/ops/funds/${edition.id}/evidence`)
                .then((data) => {
                  if (
                    !data ||
                    typeof data !== 'object' ||
                    !('body' in data) ||
                    typeof data.body !== 'string'
                  )
                    throw Error('Retained NAV source is unreadable.');
                  setRaw(data.body);
                })
                .catch(deny);
            }}
          >
            Inspect original NAV text
          </button>
          <button
            disabled={busy || state === 'published' || reason.trim().length < 5}
            onClick={() => void review(edition.id, 'publish')}
          >
            Publish NAV edition
          </button>
          <button
            disabled={busy || state === 'withdrawn' || reason.trim().length < 5}
            onClick={() => void review(edition.id, 'withdraw')}
          >
            Withdraw NAV edition
          </button>
        </article>
      ))}
      {raw !== null && (
        <section aria-label="Retained NAV text">
          <button onClick={() => setRaw(null)}>Close original text</button>
          <pre style={{ maxHeight: 400, overflow: 'auto' }}>{raw}</pre>
        </section>
      )}
    </section>
  );
}
