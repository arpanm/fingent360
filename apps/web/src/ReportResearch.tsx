import { useEffect, useState } from 'react';
import { ReportSignedOut } from './report-request';
import {
  ResearchConnectionsSchema,
  type ResearchConnectionView,
  type ReportResearchCapture,
  type ConnectionSourceReceipt,
} from '@fingent360/contracts';
function Receipt({ source }: { source: ConnectionSourceReceipt }) {
  return (
    <div>
      <dl className="report-source-receipt">
        <dt>Source</dt>
        <dd>
          {source.name} · edition {source.version}
        </dd>
        <dt>Effective period</dt>
        <dd>{source.effectiveLabel}</dd>
        <dt>Published</dt>
        <dd>{new Date(source.publishedAt).toLocaleString()}</dd>
        <dt>Retrieved</dt>
        <dd>{new Date(source.retrievedAt).toLocaleString()}</dd>
      </dl>
      <details className="report-technical-receipt">
        <summary>Verify source receipt</summary>
        <dl className="report-source-receipt">
          <dt>Item and hash</dt>
          <dd>
            {source.itemId} · {source.sourceHash}
          </dd>
          <dt>Recorded source URL</dt>
          <dd>{source.url}</dd>
        </dl>
      </details>
    </div>
  );
}
export function ReportResearchSelection({
  selected,
  onChange,
  onSignedOut,
  disabled,
}: {
  selected: ResearchConnectionView[];
  onChange: (rows: ResearchConnectionView[]) => void;
  onSignedOut: () => void;
  disabled: boolean;
}) {
  const [rows, setRows] = useState<ResearchConnectionView[] | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [bundleDate, setBundleDate] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetch('/api/v1/account/research-connections', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (response.status === 401)
          throw new ReportSignedOut(
            'Sign in again to choose your private connections.',
          );
        if (!response.ok)
          throw Error(
            'Could not load your research connections. Retry before choosing.',
          );
        const value = ResearchConnectionsSchema.parse(await response.json());
        if (active) {
          setRows(value.connections);
          setBundleDate(value.bundleGeneratedAt);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          if (error instanceof ReportSignedOut) {
            onSignedOut();
            return;
          }
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load connections.',
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [revision, onSignedOut]);
  return (
    <section aria-label="Research connection selection">
      <h3>Choose research connections</h3>
      <p>
        Choose up to 20 active connections. Their personal reasons and dated
        receipts will be copied into this private report. Removing a connection
        later does not remove its report copy; delete the report separately.
      </p>
      <p>
        <a href="#connections">Manage research connections</a>
      </p>
      {loading && <p role="status">Loading owned research connections…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange([]);
            setRows(null);
            setRevision((n) => n + 1);
          }}
        >
          Reload research connections
        </button>
      )}
      {bundleDate && (
        <p>
          On-device public bundle saved {new Date(bundleDate).toLocaleString()}.
          This dated snapshot does not refresh automatically.
        </p>
      )}
      {!loading && !error && !rows?.length && (
        <p>
          No active research connections. Open published reading and connect it
          to one of your records first, or turn off inclusion to create a
          financial-record report.
        </p>
      )}
      {!loading &&
        !error &&
        rows?.map((row) => (
          <article className="report-card" key={row.revision.id}>
            <label className="report-consent">
              <input
                type="checkbox"
                checked={selected.some(
                  (r) => r.revision.id === row.revision.id,
                )}
                disabled={
                  disabled ||
                  (selected.length >= 20 &&
                    !selected.some((r) => r.revision.id === row.revision.id))
                }
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, row]
                      : selected.filter(
                          (r) => r.revision.id !== row.revision.id,
                        ),
                  )
                }
              />
              Include {row.revision.target.label} · connection revision{' '}
              {row.revision.version}
            </label>
            <p>{row.revision.note}</p>
            <p>
              {row.revision.source.name} · source edition{' '}
              {row.revision.source.version} · {row.revision.target.binding.kind}{' '}
              version {row.revision.target.binding.version}
            </p>
            {row.reviewReasons.length > 0 ? (
              <div role="note">
                <strong>Review your connection</strong>
                {row.reviewReasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p>
                No review warnings at this check. Capture checks source and
                record status again.
              </p>
            )}
            <details>
              <summary>Dated source receipt</summary>
              <Receipt source={row.revision.source} />
            </details>
          </article>
        ))}
      <p>
        {selected.length} of 20 connections selected. A changed connection
        revision must be reloaded and reviewed before capture.
      </p>
    </section>
  );
}
export function ReportResearchReview({
  selected,
}: {
  selected: ResearchConnectionView[];
}) {
  return (
    <section aria-label="Reviewed research selection">
      <h3>Selected personal research receipts</h3>
      {selected.map((row) => (
        <article key={row.revision.id}>
          <h4>
            {row.revision.target.label} · connection revision{' '}
            {row.revision.version}
          </h4>
          <p>{row.revision.note}</p>
          <Receipt source={row.revision.source} />
          {row.reviewReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </article>
      ))}
      <p>
        Capture stores these exact connection revisions with source and target
        status checked again at capture. This report copy remains until you
        delete the report or account.
      </p>
    </section>
  );
}
export function IssuedReportResearch({
  capture,
  onCheckCurrent,
}: {
  capture: ReportResearchCapture;
  onCheckCurrent: () => void;
}) {
  return (
    <section aria-label="Captured research connections">
      <h3>Your research connections</h3>
      <p>
        Source and record status evaluated at capture:{' '}
        {new Date(capture.evaluatedAt).toLocaleString()}. Current publication
        and record status are unknown from this issued report.
      </p>
      {capture.bundleGeneratedAt && (
        <p>
          Public bundle saved{' '}
          {new Date(capture.bundleGeneratedAt).toLocaleString()}; this was a
          dated on-device snapshot.
        </p>
      )}
      <p>
        <a
          href="#connections"
          onClick={(event) => {
            event.preventDefault();
            onCheckCurrent();
          }}
        >
          Open research connections to check current context
        </a>
      </p>
      {capture.receipts.map((row) => (
        <article className="report-card" key={row.revision.id}>
          <h4>{row.revision.target.label}</h4>
          <p>Your personal reason: {row.revision.note}</p>
          <p>
            Connection revision {row.revision.version} · record version{' '}
            {row.revision.target.binding.version}
          </p>
          <details className="report-technical-receipt">
            <summary>Verify connection receipt</summary>
            <p>Connection ID: {row.revision.id}</p>
            <p>
              Saved {new Date(row.revision.savedAt).toLocaleString()} · consent
              recorded {new Date(row.revision.consentedAt).toLocaleString()}
            </p>
            <p>
              {row.revision.target.binding.kind} ID:{' '}
              {row.revision.target.binding.id}
            </p>
          </details>
          <Receipt source={row.revision.source} />
          {row.reviewReasons.length ? (
            <div role="note">
              <strong>Review needed at capture</strong>
              {row.reviewReasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : (
            <p>No review warnings at capture. This is a historical receipt.</p>
          )}
          <p>
            {row.sourceAtCapture
              ? `Published source edition at capture: ${row.sourceAtCapture.version}.`
              : 'Source was unavailable or withdrawn at capture; only the saved minimal dated receipt is retained.'}{' '}
            {row.targetAtCapture
              ? `Owned record at capture: ${row.targetAtCapture.label}, version ${row.targetAtCapture.binding.version}.`
              : 'The connected record was removed before capture.'}
          </p>
        </article>
      ))}
    </section>
  );
}
