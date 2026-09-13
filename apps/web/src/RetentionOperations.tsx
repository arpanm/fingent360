import { useEffect, useRef, useState } from 'react';
import {
  RetentionRecordSchema,
  RetentionHistorySchema,
  retentionScopes,
  type RetentionRecord,
  type RetentionCount,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { Dialog } from './Dialog';
import './retention.css';

function Counts({
  rows,
  result = false,
}: {
  rows: RetentionCount[];
  result?: boolean;
}) {
  return (
    <ul
      className="retention-counts"
      aria-label={result ? 'Cleanup result counts' : 'Cleanup preview counts'}
    >
      {rows.map((row) => {
        const scope = retentionScopes.find((value) => value.id === row.scope)!;
        return (
          <li key={row.scope}>
            <strong>{scope.label}</strong>
            <span>
              {row.count} {result ? 'cleaned' : 'eligible'} · maximum{' '}
              {scope.limit} per run
            </span>
            <small>
              {row.moreAvailable
                ? result
                  ? 'More expired rows remain at this cutoff.'
                  : 'Additional expired rows exist beyond this batch.'
                : result
                  ? 'No more eligible rows at this cutoff.'
                  : 'All eligible rows fit in this batch.'}
            </small>
          </li>
        );
      })}
    </ul>
  );
}
const title = (record: RetentionRecord) =>
  record.status === 'completed'
    ? 'Cleanup complete'
    : record.status === 'failed'
      ? 'Cleanup rolled back'
      : 'Saved cleanup preview';

export function RetentionOperations({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [records, setRecords] = useState<RetentionRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<RetentionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  async function history(cursor?: string) {
    const value = RetentionHistorySchema.parse(
      await json(
        `/ops/retention/runs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    );
    if (mounted.current) {
      setRecords(value.records);
      setNextCursor(value.nextCursor);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void history()
      .catch((e: unknown) => {
        if (mounted.current) {
          if (e instanceof RequestError && e.status === 401) onSessionExpired();
          else
            setError('Cleanup history could not load. Retry loading history.');
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (selected) heading.current?.focus();
  }, [selected]);
  async function action(work: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      if (mounted.current) {
        if (e instanceof RequestError && e.status === 401) onSessionExpired();
        else
          setError(
            e instanceof Error
              ? e.message
              : 'Cleanup could not finish. Reload the saved record and retry.',
          );
      }
    } finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function update(record: RetentionRecord) {
    if (!mounted.current) return;
    setSelected(record);
    try {
      await history();
    } catch (e) {
      if (mounted.current) {
        if (e instanceof RequestError && e.status === 401) onSessionExpired();
        else
          setError(
            'The saved record is shown below, but history could not reload. Retry loading history.',
          );
      }
    }
  }
  function preview() {
    void action(async () => {
      const requestId = pendingPreview ?? crypto.randomUUID();
      setPendingPreview(requestId);
      const record = RetentionRecordSchema.parse(
        await json('/ops/retention/previews', { requestId }, 'POST'),
      );
      if (mounted.current) setPendingPreview(null);
      await update(record);
    });
  }
  function execute() {
    if (!selected) return;
    const id = selected.id;
    setConfirm(false);
    void action(async () => {
      const record = RetentionRecordSchema.parse(
        await json(
          `/ops/retention/runs/${id}/execute`,
          { confirm: true },
          'POST',
        ),
      );
      await update(record);
    });
  }
  const eligible = selected?.preview.some((row) => row.count > 0) ?? false;
  return (
    <section className="retention-operations" aria-label="Expired data cleanup">
      <h2>Expired data cleanup</h2>
      <p>
        Preview records whose existing expiry time has passed, then choose
        whether to clean up one bounded batch. Opening this page does not run
        cleanup.
      </p>
      <p className="data-note">
        Current sessions, financial histories, issued reports, confirmed
        holdings receipts and source evidence stay intact. Expired feedback
        loses its text and attachments; its deletion receipt and audit remain.
      </p>
      <div className="page-actions">
        <button disabled={busy || loading} onClick={preview}>
          {pendingPreview ? 'Retry preview request' : 'Preview expired records'}
        </button>
        <button
          className="secondary"
          disabled={busy || loading}
          onClick={() => void action(() => history())}
        >
          Reload cleanup history
        </button>
      </div>
      {loading && <p role="status">Loading cleanup history…</p>}
      {busy && <p role="status">Saving the requested cleanup operation…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {selected && (
        <article className="panel" aria-label="Selected cleanup record">
          <h3 ref={heading} tabIndex={-1}>
            {title(selected)}
          </h3>
          <p>
            Server cutoff:{' '}
            <time dateTime={selected.cutoffAt}>{selected.cutoffAt}</time>
          </p>
          <p>
            Record <span className="retention-id">{selected.id}</span> · Policy{' '}
            {selected.policyVersion} · Attempts {selected.attempts}
          </p>
          {selected.status === 'ready' && !eligible && (
            <p>No expired records at this cutoff. No cleanup is needed.</p>
          )}
          {selected.status === 'failed' && (
            <p role="alert">
              The cleanup batch was rolled back. No category was partially
              cleaned. Review and retry this saved preview.
            </p>
          )}
          {selected.status === 'completed' && (
            <p>
              Completed{' '}
              <time dateTime={selected.completedAt!}>
                {selected.completedAt}
              </time>
              . Reopening this record never runs another cleanup.
            </p>
          )}
          <Counts
            rows={selected.result ?? selected.preview}
            result={selected.status === 'completed'}
          />
          {selected.status === 'completed' &&
            selected.result?.some((row) => row.moreAvailable) && (
              <p>
                Create another preview to review the next batch of expired rows.
              </p>
            )}
          <div className="page-actions">
            {selected.status !== 'completed' && eligible && (
              <button disabled={busy} onClick={() => setConfirm(true)}>
                {selected.status === 'failed'
                  ? 'Review cleanup retry'
                  : 'Review cleanup'}
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void action(async () =>
                  update(
                    RetentionRecordSchema.parse(
                      await json(`/ops/retention/runs/${selected.id}`),
                    ),
                  ),
                )
              }
            >
              Check saved cleanup result
            </button>
          </div>
        </article>
      )}
      <section aria-label="Cleanup history">
        <h3>Cleanup history</h3>
        {!loading && !records.length && !error && (
          <p>No cleanup previews have been saved.</p>
        )}
        <ol className="retention-history">
          {records.map((record) => (
            <li key={record.id}>
              <strong>{title(record)}</strong>
              <time dateTime={record.createdAt}>
                {new Date(record.createdAt).toLocaleString()}
              </time>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () =>
                    update(
                      RetentionRecordSchema.parse(
                        await json(`/ops/retention/runs/${record.id}`),
                      ),
                    ),
                  )
                }
                aria-label={`Open cleanup record ${record.id}`}
              >
                Open record
              </button>
            </li>
          ))}
        </ol>
        {nextCursor && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void action(() => history(nextCursor))}
          >
            Older cleanup records
          </button>
        )}
      </section>
      {confirm && selected && (
        <Dialog
          title="Clean up expired records?"
          onClose={() => {
            setConfirm(false);
            setNotice(
              'Cleanup cancelled. The saved preview is still available.',
            );
          }}
        >
          <p>
            This permanently removes only eligible expired data at server cutoff{' '}
            {selected.cutoffAt}, up to the displayed limits. It cannot be undone
            here.
          </p>
          <p>
            Counts may shrink if normal expiry or another operator already
            cleaned a row. Newly expiring data needs a new preview. Financial
            records and feedback deletion receipts remain.
          </p>
          <Counts rows={selected.preview} />
          <div className="page-actions">
            <button
              className="secondary"
              onClick={() => {
                setConfirm(false);
                setNotice(
                  'Cleanup cancelled. The saved preview is still available.',
                );
              }}
            >
              Cancel cleanup
            </button>
            <button onClick={execute}>Confirm cleanup</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export function OfflineOperationsNotice() {
  return (
    <section className="account">
      <h1>Operations need a connected server</h1>
      <p>
        Expired data cleanup applies to server records and requires an
        operations sign-in. It is unavailable in this device workspace. Your
        local accounts and financial records stay on this device.
      </p>
      <div className="page-actions">
        <a href="#app-settings">Open App settings</a>
        <a href="#today">Back to reading</a>
      </div>
    </section>
  );
}
