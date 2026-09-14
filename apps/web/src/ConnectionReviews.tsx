import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ConnectionReviewInboxSchema,
  ConnectionReviewReceiptSchema,
  ResearchConnectionHistorySchema,
  type ResearchConnectionRevision,
  type ConnectionReviewInbox,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';

class SignedOut extends Error {}
async function api(path = '', body?: unknown) {
  const response = await fetch(`/api/v1/account/connection-reviews${path}`, {
    credentials: 'same-origin',
    method: body ? 'POST' : 'GET',
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 401) throw new SignedOut();
  const value: unknown = await response.json().catch(() => {
    throw Error('Review service returned an unreadable response.');
  });
  if (!response.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Review request failed.',
    );
  return value;
}

export function ConnectionReviews() {
  const [detail, setDetail] = useState<ResearchConnectionRevision | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [data, setData] = useState<ConnectionReviewInbox | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('open');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const receiptTrigger = useRef<HTMLButtonElement | null>(null);
  const returnReceiptFocus = useRef(false);
  const pending = useRef<{
    path: string;
    body: { requestId: string; expectedVersion?: number };
  } | null>(null);
  const generation = useRef(0);
  const receiptGeneration = useRef(0);
  const operationGeneration = useRef(0);
  const mounted = useRef(false);
  const authDenied = useRef(false);

  useLayoutEffect(() => {
    if (detail || receiptLoading) detailHeading.current?.focus();
    else if (returnReceiptFocus.current) {
      returnReceiptFocus.current = false;
      receiptTrigger.current?.focus();
    }
  }, [detail, receiptLoading]);

  function failed(cause: unknown, current = true) {
    if (!mounted.current || authDenied.current) return;
    if (cause instanceof SignedOut) {
      // A denial invalidates every in-flight private read and operation, including
      // older successful responses delayed before reaching this view.
      authDenied.current = true;
      generation.current++;
      receiptGeneration.current++;
      operationGeneration.current++;
      pending.current = null;
      returnReceiptFocus.current = false;
      setGuest(true);
      setData(null);
      setDetail(null);
      setReceiptLoading(false);
      setReady(false);
      setBusy(false);
      setNotice('');
      setError('');
    } else if (current)
      setError(cause instanceof Error ? cause.message : 'Request failed.');
  }

  async function load() {
    if (authDenied.current || !mounted.current) return;
    const epoch = ++generation.current;
    const current = () =>
      mounted.current && !authDenied.current && epoch === generation.current;
    setBusy(true);
    setReady(false);
    setError('');
    try {
      const value = ConnectionReviewInboxSchema.parse(await api());
      if (current()) {
        setData(value);
        setReady(true);
      }
    } catch (cause) {
      failed(cause, current());
    } finally {
      if (current()) setBusy(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current++;
      receiptGeneration.current++;
      operationGeneration.current++;
    };
  }, []);

  async function openReceipt(id: string) {
    if (authDenied.current || !mounted.current) return;
    const epoch = ++receiptGeneration.current;
    const current = () =>
      mounted.current &&
      !authDenied.current &&
      epoch === receiptGeneration.current;
    setReceiptLoading(true);
    setDetail(null);
    setError('');
    try {
      const response = await fetch(
        `/api/v1/account/research-connections/${id}/history`,
        {
          credentials: 'same-origin',
          signal: AbortSignal.timeout(15000),
        },
      );
      if (response.status === 401) throw new SignedOut();
      if (!response.ok)
        throw Error('Could not open this owned connection receipt.');
      const value = ResearchConnectionHistorySchema.parse(
        await response.json(),
      );
      if (current()) setDetail(value.revisions[0] ?? null);
    } catch (cause) {
      failed(cause, current());
    } finally {
      if (current()) setReceiptLoading(false);
    }
  }

  function closeReceipt() {
    receiptGeneration.current++;
    returnReceiptFocus.current = true;
    setDetail(null);
    setReceiptLoading(false);
  }

  async function perform(path: string, version?: number) {
    if (authDenied.current || !mounted.current) return;
    const epoch = ++operationGeneration.current;
    const current = () =>
      mounted.current &&
      !authDenied.current &&
      epoch === operationGeneration.current;
    setBusy(true);
    setReady(false);
    setError('');
    setNotice('');
    const request = pending.current ?? {
      path,
      body: {
        requestId: crypto.randomUUID(),
        ...(version === undefined ? {} : { expectedVersion: version }),
      },
    };
    pending.current = request;
    try {
      const receipt = ConnectionReviewReceiptSchema.parse(
        await api(request.path, request.body),
      );
      if (!current()) return;
      pending.current = null;
      setNotice(
        `${receipt.action === 'check' ? 'Update check' : 'Acknowledgement'} recorded at ${new Date(receipt.recordedAt).toLocaleString()}. This historical operation receipt does not establish current inbox status or reaffirm any connection.`,
      );
      // A receipt can replay an older operation. Only the subsequent validated
      // inbox read can enable acknowledging the currently displayed notices.
      await load();
    } catch (cause) {
      failed(cause, current());
    } finally {
      if (current()) setBusy(false);
    }
  }

  if (guest)
    return (
      <AccountGate
        next="connection-reviews"
        title="Review your research connections"
      />
    );
  return (
    <section className="account" aria-label="Connection review inbox">
      <header className="page-header">
        <p className="page-kicker">MY MONEY · PRIVATE RESEARCH</p>
        <h1>Connection review inbox</h1>
        <p>
          Check whether a saved source or your own records changed. These
          notices make no financial-impact claim.
        </p>
        <a href="#connections">Back to research connections</a>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p role="status">Loading saved notices…</p>}
      <div className="page-actions">
        <button
          disabled={busy || !!pending.current}
          onClick={() => void perform('/check')}
        >
          Check for updates
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Reload saved inbox
        </button>
        {pending.current && (
          <>
            <button
              disabled={busy}
              onClick={() => void perform(pending.current!.path)}
            >
              Retry last operation
            </button>
            <button
              disabled={busy}
              className="secondary"
              onClick={() => {
                pending.current = null;
                setNotice(
                  'Pending request dismissed. Reload or check again to see the saved outcome.',
                );
              }}
            >
              Dismiss retry
            </button>
          </>
        )}
      </div>
      {data && (
        <>
          <p>
            Last successful check:{' '}
            {data.lastCheckedAt
              ? new Date(data.lastCheckedAt).toLocaleString()
              : 'Not checked yet'}
            . Checking is manual.
          </p>
          {data.bundleGeneratedAt && (
            <p>
              On-device source bundle:{' '}
              {new Date(data.bundleGeneratedAt).toLocaleString()}. No provider
              refresh or synchronization occurs.
            </p>
          )}
          {!ready && (
            <p role="note">
              Current saved inbox status is unavailable. Older dated notices
              remain below; reload before acknowledging.
            </p>
          )}
          <div className="field">
            <label htmlFor="connection-review-filter">Show notices</label>
            <select
              id="connection-review-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="open">
                Open (
                {data.notices.filter((item) => item.status === 'open').length})
              </option>
              <option value="acknowledged">
                Acknowledged (
                {
                  data.notices.filter((item) => item.status === 'acknowledged')
                    .length
                }
                )
              </option>
              <option value="resolved">
                Resolved (
                {
                  data.notices.filter((item) => item.status === 'resolved')
                    .length
                }
                )
              </option>
              <option value="all">All ({data.notices.length})</option>
            </select>
          </div>
          <section aria-label="Review notices">
            {!data.notices.filter(
              (item) => filter === 'all' || item.status === filter,
            ).length ? (
              <p>
                No {filter === 'all' ? 'saved' : filter} notices.{' '}
                {data.lastCheckedAt
                  ? 'This describes your last check, not continuous monitoring.'
                  : 'Choose Check for updates to evaluate your saved connections.'}
              </p>
            ) : (
              data.notices
                .filter((item) => filter === 'all' || item.status === filter)
                .map((item) => (
                  <article className="panel" key={item.connectionId}>
                    <h2>{item.targetLabel}</h2>
                    <p>
                      Status: {item.status} · notice version {item.version}
                    </p>
                    {item.reasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                    <p>Evaluated {new Date(item.checkedAt).toLocaleString()}</p>
                    {item.acknowledgedAt && (
                      <p>
                        Acknowledged{' '}
                        {new Date(item.acknowledgedAt).toLocaleString()}; this
                        does not reaffirm the connection.
                      </p>
                    )}
                    <button
                      className="secondary"
                      disabled={receiptLoading}
                      onClick={(event) => {
                        receiptTrigger.current = event.currentTarget;
                        void openReceipt(item.connectionId);
                      }}
                    >
                      Open connection receipt for {item.targetLabel}
                    </button>
                    <a href="#connections">Check current connection context</a>
                    {item.status === 'open' && (
                      <button
                        disabled={!ready || busy || !!pending.current}
                        onClick={() =>
                          void perform(
                            `/${item.connectionId}/acknowledge`,
                            item.version,
                          )
                        }
                      >
                        Acknowledge notice for {item.targetLabel}
                      </button>
                    )}
                  </article>
                ))
            )}
          </section>
          {(detail || receiptLoading) && (
            <section className="panel" aria-label="Connection receipt">
              <h2 ref={detailHeading} tabIndex={-1}>
                Saved connection receipt
              </h2>
              {receiptLoading && (
                <p role="status">Loading saved connection receipt…</p>
              )}
              {detail && (
                <>
                  <p>
                    {detail.target.label} · connection edition {detail.version}
                  </p>
                  <p>{detail.note}</p>
                  <p>
                    {detail.source.name} · source edition{' '}
                    {detail.source.version} · retrieved{' '}
                    {new Date(detail.source.retrievedAt).toLocaleString()}
                  </p>
                  <p>
                    Saved {new Date(detail.savedAt).toLocaleString()}. This
                    historical receipt does not establish current publication or
                    financial impact.
                  </p>
                  <a href="#connections">Open current connection context</a>
                </>
              )}
              <button className="secondary" onClick={closeReceipt}>
                Close receipt
              </button>
            </section>
          )}
          <details>
            <summary>Recent checks and retention</summary>
            {data.evaluations.map((evaluation) => (
              <p key={`${evaluation.requestId}:${evaluation.checkedAt}`}>
                {new Date(evaluation.checkedAt).toLocaleString()} ·{' '}
                {evaluation.changedCount} notices changed
              </p>
            ))}
            <p>
              100 recent checks and 200 resolved notices are retained. Request
              receipts expire after 30 days; reusing an expired request ID
              starts a new operation. At most 1000 requests are retained inside
              that window. Original connection history remains unchanged.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
