import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ReportDeletionSchema,
  ReportJobsSchema,
  ReportJobSchema,
  RecordReportSchema,
  type ReportJob,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { Dialog } from './Dialog';
import { money } from './ui';
import { saveDownload } from './runtime';
import './reports.css';
async function request(path = '', body?: unknown, method = 'POST') {
  const response = await fetch(`/api/v1/account/reports${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw Error(
      response.status === 401
        ? 'Sign in to view your private record reports.'
        : typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'Unable to load reports. Try again.',
    );
  return data;
}
export function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guest, setGuest] = useState(false);
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [label, setLabel] = useState('My saved-record review');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<ReportJob | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const sequence = useRef(0);
  const accepted = useRef(0);
  // A later pending read must not starve a usable earlier response. Only a
  // response already applied, or a completed mutation, supersedes older reads.
  function acceptRead(ticket: number) {
    if (ticket < accepted.current) return false;
    accepted.current = ticket;
    return true;
  }
  function invalidateReads() {
    accepted.current = ++sequence.current;
  }

  const deleted = useRef(new Set<string>());
  const [selected, setSelected] = useState<string | null>(null);
  const pending = useRef<{ id: string; label: string } | null>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  function merge(incoming: ReportJob[], authoritative = false) {
    if (authoritative) {
      setSelected((current) =>
        current && incoming.some((j) => j.id === current) ? current : null,
      );
      setDeleting((current) =>
        current && incoming.some((j) => j.id === current.id) ? current : null,
      );
    }
    setJobs((old) =>
      incoming
        .filter((j) => !deleted.current.has(j.id))
        .map((job) => {
          const prior = old.find((j) => j.id === job.id);
          return prior && prior.version > job.version ? prior : job;
        })
        .concat(
          authoritative
            ? []
            : old.filter(
                (j) =>
                  !deleted.current.has(j.id) &&
                  !incoming.some((i) => i.id === j.id),
              ),
        ),
    );
  }
  async function load() {
    setError('');
    const ticket = ++sequence.current;
    try {
      const data = ReportJobsSchema.parse(await request());
      if (!acceptRead(ticket)) return;
      data.deletions.forEach((r) => deleted.current.add(r.id));
      merge(data.jobs, true);
      setGuest(false);
    } catch (error) {
      if (!acceptRead(ticket)) return;
      const text = (error as Error).message;
      setError(text);
      setGuest(text.startsWith('Sign in'));
    } finally {
      if (ticket === accepted.current) setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      const ticket = ++sequence.current;
      void request()
        .then((data) => {
          if (live && acceptRead(ticket)) {
            const parsed = ReportJobsSchema.parse(data);
            parsed.deletions.forEach((r) => deleted.current.add(r.id));
            merge(parsed.jobs, true);
            setGuest(false);
            setLoading(false);
            setError('');
          }
        })
        .catch((error) => {
          if (live && acceptRead(ticket)) {
            const text = (error as Error).message;
            setError(text);
            setGuest(text.startsWith('Sign in'));
            setLoading(false);
          }
        });
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!pending.current)
        pending.current = { id: crypto.randomUUID(), label };
      const job = ReportJobSchema.parse(
        await request('', {
          requestId: pending.current.id,
          label: pending.current.label,
          consent,
        }),
      );
      invalidateReads();
      pending.current = null;
      merge([job]);
      setMessage(
        'Snapshot stored. Preparation will resume while Reports is open.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(job: ReportJob, action: 'cancel' | 'retry') {
    setBusy(true);
    try {
      await request(`/${job.id}/${action}`, { expectedVersion: job.version });
      await load();
      setMessage(
        action === 'cancel' ? 'Report cancelled.' : 'Retry requested.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError('');
    invalidateReads();
    try {
      const receipt = ReportDeletionSchema.parse(
        await request(
          `/${deleting.id}`,
          { expectedVersion: deleting.version, confirm: true },
          'DELETE',
        ),
      );
      deleted.current.add(receipt.id);
      invalidateReads();
      setJobs((old) => old.filter((j) => j.id !== receipt.id));
      setSelected(null);
      setDeleting(null);
      setMessage(
        'Report permanently deleted. Capacity reclaimed; downloaded copies are unchanged.',
      );
      await load();
      historyHeading.current?.focus({ preventScroll: true });
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(job: ReportJob) {
    try {
      const report = RecordReportSchema.parse(
        await request(`/${job.id}/download`),
      );
      setMessage(
        await saveDownload(
          new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json',
          }),
          `saved-record-review-${job.id}.json`,
        ),
      );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  if (guest)
    return (
      <section className="reports-page">
        <h1>Record reports</h1>
        <AccountGate
          next="reports"
          title="Keep a private saved-record review"
        />
      </section>
    );
  const report = jobs.find((j) => j.id === selected)?.report;
  return (
    <section className="reports-page" aria-label="Record reports">
      <header className="page-header">
        <p className="page-kicker">Your records</p>
        <h1>Record reports</h1>
        <p className="page-description">
          Keep a dated review of your goals, entered holdings cost and
          allocations. This is not a valuation or investment recommendation.
        </p>
      </header>
      <p>
        <a href="#account?next=reports">Account and sign in</a> ·{' '}
        <a href="#my-goals">Goals</a> · <a href="#holdings">Holdings</a>
      </p>
      {loading && <p role="status">Loading private reports…</p>}
      {error && (
        <div role="alert">
          {error}
          <button onClick={() => void load()}>Retry loading reports</button>
        </div>
      )}
      <form onSubmit={(event) => void create(event)} className="report-card">
        <h2>Create a snapshot</h2>
        <label>
          Report label
          <input
            value={label}
            maxLength={100}
            required
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            disabled={busy || !!pending.current}
          />
        </label>
        <label className="report-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          Store a private snapshot of my saved goals, holdings and allocations.
        </label>
        <button disabled={busy || !consent || !label.trim()} type="submit">
          {pending.current ? 'Retry same request' : 'Create record report'}
        </button>
      </form>
      <p role="status" aria-label="Report status">
        {message}
      </p>
      <section aria-label="Report history">
        <h2 ref={historyHeading} tabIndex={-1}>
          Report history
        </h2>
        <p aria-label="Report capacity">
          {jobs.length} of 100 report slots used. Delete completed or cancelled
          reports to reclaim space.
        </p>
        {!loading && !error && !jobs.length && (
          <p>
            No reports yet. Save goals or holdings, then capture a review here.
          </p>
        )}
        {jobs.map((job) => (
          <article className="report-card" key={job.id}>
            <h3>{job.label}</h3>
            <p>
              {job.status} · {new Date(job.requestedAt).toLocaleString()}
            </p>
            <p>{job.message}</p>
            <div className="report-actions">
              {['succeeded', 'failed', 'cancelled'].includes(job.status) && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setDeleteError('');
                    setDeleting(job);
                  }}
                >
                  Delete report
                </button>
              )}
              {job.report && (
                <>
                  <button onClick={() => setSelected(job.id)}>
                    Open report
                  </button>
                  <button onClick={() => void download(job)}>
                    Download JSON
                  </button>
                </>
              )}
              {['queued', 'running'].includes(job.status) && (
                <button disabled={busy} onClick={() => void act(job, 'cancel')}>
                  Cancel preparation
                </button>
              )}
              {job.status === 'failed' && (
                <button disabled={busy} onClick={() => void act(job, 'retry')}>
                  Retry preparation
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      {deleting && (
        <Dialog
          title="Delete this report?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            Permanently delete “{deleting.label}” and its private snapshot? Your
            goals, holdings and allocations remain. Downloaded copies cannot be
            removed.
          </p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <div className="report-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep report
            </button>
            <button
              className="report-delete-confirm"
              disabled={busy}
              onClick={() => void remove()}
            >
              Permanently delete report
            </button>
          </div>
        </Dialog>
      )}
      {report && (
        <Dialog title="Issued record report" onClose={() => setSelected(null)}>
          <section className="report-card" aria-label="Issued record report">
            <h2>{report.label}</h2>
            <div className="report-actions">
              <button onClick={() => setSelected(null)}>Close report</button>
              <button
                onClick={() =>
                  void download(jobs.find((j) => j.id === selected)!)
                }
              >
                Download this report
              </button>
            </div>
            <p>
              Captured {new Date(report.snapshot.capturedAt).toLocaleString()}.
              Issued {new Date(report.issuedAt).toLocaleString()}.
            </p>
            <h3>Contribution-only goal review</h3>
            {report.goalReviews.length ? (
              report.goalReviews.map((goal) => (
                <article key={goal.goalId}>
                  <h4>
                    {goal.name} · revision {goal.goalVersion}
                  </h4>
                  <p>
                    Target {money(goal.targetMinor)} · entered savings{' '}
                    {money(goal.savedMinor)} · monthly contribution{' '}
                    {money(goal.monthlyMinor)}
                  </p>
                  <p>
                    After {goal.horizonMonths} months with no growth:{' '}
                    {money(goal.projectedMinor)}. Remaining gap:{' '}
                    {money(goal.gapMinor)}.
                  </p>
                </article>
              ))
            ) : (
              <p>No saved goals in this snapshot.</p>
            )}
            <h3>Recorded holdings cost</h3>
            <p>
              {money(report.recordedHoldingsCostMinor)} across{' '}
              {report.snapshot.holdings.holdings.length} recorded holdings. This
              is not current market value.
            </p>
            <h3>Allocation records</h3>
            <p>
              Allocation revision {report.snapshot.allocations.version}. Cost
              allocations are shown separately and are not added to entered goal
              savings.
            </p>
            {report.snapshot.allocations.rows.map((row) => (
              <p key={`${row.goalId}:${row.isin}`}>
                {row.goalName} · {row.isin} · {row.quantity} units · recorded
                allocated cost {money(row.recordedCostMinor)}
              </p>
            ))}
            {report.allocationsRequireReview && (
              <div role="note">
                <h4>Allocation review needed at capture</h4>
                {report.allocationReview.map((row, index) => (
                  <p key={index}>
                    {row.isin}: {row.reasons.join(' ')}
                  </p>
                ))}
              </div>
            )}
            <ul>
              {report.caveats.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>
        </Dialog>
      )}
    </section>
  );
}
