import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
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
async function request(path = '', body?: unknown) {
  const response = await fetch(`/api/v1/account/reports${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
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
  const [selected, setSelected] = useState<string | null>(null);
  const pending = useRef<{ id: string; label: string } | null>(null);
  function merge(incoming: ReportJob[]) {
    setJobs((old) =>
      incoming
        .map((job) => {
          const prior = old.find((j) => j.id === job.id);
          return prior && prior.version > job.version ? prior : job;
        })
        .concat(old.filter((j) => !incoming.some((i) => i.id === j.id))),
    );
  }
  async function load() {
    setError('');
    try {
      merge(ReportJobsSchema.parse(await request()).jobs);
      setGuest(false);
    } catch (error) {
      const text = (error as Error).message;
      setError(text);
      setGuest(text.startsWith('Sign in'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void request()
        .then((data) => {
          if (live) {
            merge(ReportJobsSchema.parse(data).jobs);
            setGuest(false);
            setLoading(false);
            setError('');
          }
        })
        .catch((error) => {
          if (live) {
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
        <h2>Report history</h2>
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
