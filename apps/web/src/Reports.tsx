import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ReportRequestSchema,
  type ReportRequest,
  type ResearchConnectionView,
  ReportDeletionSchema,
  ReportJobsSchema,
  ReportJobSchema,
  RecordReportSchema,
  type ReportJob,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import { Dialog } from './Dialog';
import {
  ReportResearchSelection,
  ReportResearchReview,
  IssuedReportResearch,
} from './ReportResearch';
import { useDraftGuard } from './useDraftGuard';
import { money } from './ui';
import { saveDownload, runtime } from './runtime';
import { ReportSignedOut, reportRequest as request } from './report-request';
import './reports.css';
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
  const [includeResearch, setIncludeResearch] = useState(false);
  const [research, setResearch] = useState<ResearchConnectionView[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [captureError, setCaptureError] = useState('');
  const [printMessage, setPrintMessage] = useState('');
  const issuedRef = useRef<HTMLElement>(null);
  useDraftGuard(
    includeResearch && (research.length > 0 || consent),
    'Leave and discard this unsaved report selection?',
  );
  const authDenied = useRef(false);
  const sequence = useRef(0);
  const accepted = useRef(0);
  // A later pending read must not starve a usable earlier response. Only a
  // response already applied, or a completed mutation, supersedes older reads.
  function acceptRead(ticket: number) {
    if (authDenied.current || ticket < accepted.current) return false;
    accepted.current = ticket;
    return true;
  }
  function invalidateReads() {
    accepted.current = ++sequence.current;
  }

  const deleted = useRef(new Set<string>());
  const [selected, setSelected] = useState<string | null>(null);
  const pending = useRef<ReportRequest | null>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const signOut = useCallback(() => {
    authDenied.current = true;
    accepted.current = ++sequence.current;
    pending.current = null;
    deleted.current.clear();
    setGuest(true);
    setJobs([]);
    setSelected(null);
    setDeleting(null);
    setResearch([]);
    setIncludeResearch(false);
    setReviewing(false);
    setConsent(false);
    setLabel('My saved-record review');
    setCaptureError('');
    setDeleteError('');
    setMessage('');
    setPrintMessage('');
    setError('');
    setLoading(false);
    setBusy(false);
  }, []);
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
    if (authDenied.current) return;
    setError('');
    const ticket = ++sequence.current;
    try {
      const data = ReportJobsSchema.parse(await request());
      if (!acceptRead(ticket)) return;
      data.deletions.forEach((r) => deleted.current.add(r.id));
      merge(data.jobs, true);
      setGuest(false);
    } catch (error) {
      if (error instanceof ReportSignedOut) {
        signOut();
        return;
      }
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
      if (authDenied.current || document.visibilityState === 'hidden') return;
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
          if (live && error instanceof ReportSignedOut) {
            signOut();
            return;
          }
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
  }, [signOut]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (includeResearch && !pending.current) {
      setReviewing(true);
      return;
    }
    await capture();
  }
  async function capture() {
    setBusy(true);
    setCaptureError('');
    try {
      if (!pending.current)
        pending.current = ReportRequestSchema.parse({
          requestId: crypto.randomUUID(),
          label,
          consent,
          ...(includeResearch
            ? {
                researchConnections: research.map((row) => ({
                  id: row.revision.id,
                  version: row.revision.version,
                })),
              }
            : {}),
        });
      const job = ReportJobSchema.parse(await request('', pending.current));
      if (authDenied.current) return;
      invalidateReads();
      pending.current = null;
      merge([job]);
      setReviewing(false);
      setResearch([]);
      setIncludeResearch(false);
      setConsent(false);
      setMessage(
        'Snapshot stored. Preparation will resume while Reports is open.',
      );
    } catch (error) {
      if (error instanceof ReportSignedOut) {
        signOut();
        return;
      }
      if (!authDenied.current) {
        setCaptureError((error as Error).message);
        setMessage((error as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  function printableDocument() {
    if (!issuedRef.current) return null;
    const doc = document.implementation.createHTMLDocument(
      'Private saved-record report',
    );
    const content = issuedRef.current.cloneNode(true) as HTMLElement;
    content
      .querySelectorAll('button, .report-actions, .report-print-message')
      .forEach((node) => node.remove());
    // DOM cloning preserves escaped personal text and only this immutable report.
    content
      .querySelectorAll('a')
      .forEach((node) => node.replaceWith(node.textContent ?? ''));
    // Export every retained receipt even when its on-screen disclosure is closed.
    content.querySelectorAll('details').forEach((node) => {
      node.open = true;
    });
    const style = doc.createElement('style');
    style.textContent =
      'body{font:14px system-ui;color:#111;margin:24px;line-height:1.5}h1,h2,h3,h4{break-after:avoid}article{break-inside:avoid;margin-block:18px}dd{overflow-wrap:anywhere}dl{margin:12px 0}dt{font-weight:bold}';
    doc.head.appendChild(style);
    doc.body.appendChild(content);
    return doc;
  }
  async function savePrintCopy() {
    const doc = printableDocument();
    if (!doc) return;
    try {
      setPrintMessage(
        await saveDownload(
          new Blob(['<!doctype html>', doc.documentElement.outerHTML], {
            type: 'text/html',
          }),
          `saved-record-review-${selected}.html`,
          'Printable report downloaded. Open it in a browser to print or save a PDF.',
        ),
      );
    } catch (error) {
      setPrintMessage((error as Error).message);
    }
  }
  function printReport() {
    const doc = printableDocument();
    if (!doc) return;
    const view = window.open('', '_blank');
    if (!view) {
      setPrintMessage(
        'Allow a print window and retry, or save the printable copy.',
      );
      return;
    }
    view.opener = null;
    view.document.title = doc.title;
    view.document.head.replaceChildren(...Array.from(doc.head.childNodes));
    view.document.body.replaceChildren(...Array.from(doc.body.childNodes));
    view.focus();
    view.print();
  }
  async function act(job: ReportJob, action: 'cancel' | 'retry') {
    setBusy(true);
    try {
      await request(`/${job.id}/${action}`, { expectedVersion: job.version });
      if (authDenied.current) return;
      await load();
      setMessage(
        action === 'cancel' ? 'Report cancelled.' : 'Retry requested.',
      );
    } catch (error) {
      if (error instanceof ReportSignedOut) {
        signOut();
        return;
      }
      if (authDenied.current) return;
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
      if (authDenied.current) return;
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
      if (error instanceof ReportSignedOut) {
        signOut();
        return;
      }
      if (authDenied.current) return;
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
      if (authDenied.current) return;
      setMessage(
        await saveDownload(
          new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json',
          }),
          `saved-record-review-${job.id}.json`,
        ),
      );
    } catch (error) {
      if (error instanceof ReportSignedOut) {
        signOut();
        return;
      }
      if (authDenied.current) return;
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
        <a href="#my-goals">Goals</a> · <a href="#holdings">Holdings</a> ·{' '}
        <a href="#connections">Research connections</a>
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
            checked={includeResearch}
            disabled={busy || !!pending.current}
            onChange={(event) => {
              setIncludeResearch(event.target.checked);
              setResearch([]);
              setConsent(false);
            }}
          />
          Include research connections in this report
        </label>
        {includeResearch && (
          <ReportResearchSelection
            selected={research}
            onChange={setResearch}
            onSignedOut={signOut}
            disabled={busy || !!pending.current}
          />
        )}
        <label className="report-consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy || !!pending.current}
            onChange={(event) => setConsent(event.target.checked)}
          />
          Store a private snapshot of my saved goals, holdings and allocations
          {includeResearch
            ? ', including my selected research reasons and receipts'
            : ''}
          .
        </label>
        <button
          disabled={
            busy ||
            !consent ||
            !label.trim() ||
            (includeResearch && !research.length)
          }
          type="submit"
        >
          {pending.current
            ? 'Retry same request'
            : includeResearch
              ? 'Review report selection'
              : 'Create record report'}
        </button>
      </form>
      {pending.current && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                'The previous request may already be saved. Discard this retry and start a new report draft?',
              )
            ) {
              pending.current = null;
              setReviewing(false);
              setResearch([]);
              setMessage(
                'Retry draft discarded. Check report history before creating another snapshot.',
              );
            }
          }}
        >
          Discard report retry draft
        </button>
      )}
      {reviewing && (
        <Dialog
          title="Review report selection"
          onClose={() => {
            if (!busy) setReviewing(false);
          }}
        >
          <h3>{pending.current?.label ?? label}</h3>
          <ReportResearchReview selected={research} />
          {captureError && <p role="alert">{captureError}</p>}
          <div className="report-actions">
            <button disabled={busy} onClick={() => void capture()}>
              {pending.current
                ? 'Retry same request'
                : 'Capture selected report'}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setReviewing(false)}
            >
              Back to report selection
            </button>
          </div>
        </Dialog>
      )}
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
          <section
            ref={issuedRef}
            className="report-card"
            aria-label="Issued record report"
          >
            <h2>{report.label}</h2>
            <div className="report-actions">
              <button className="secondary" onClick={() => setSelected(null)}>
                Close report
              </button>
              <button
                onClick={
                  runtime.native ? () => void savePrintCopy() : printReport
                }
              >
                {runtime.native ? 'Save report for printing' : 'Print report'}
              </button>
              {!runtime.native && (
                <button
                  className="secondary"
                  onClick={() => void savePrintCopy()}
                >
                  Save printable copy
                </button>
              )}
              <button
                className="secondary"
                onClick={() =>
                  void download(jobs.find((j) => j.id === selected)!)
                }
              >
                Download this report
              </button>
            </div>
            {printMessage && (
              <p role="status" className="report-print-message">
                {printMessage}
              </p>
            )}
            {runtime.native && (
              <p>
                Save the printable HTML, then open it in a browser to print or
                save a PDF.
              </p>
            )}
            <p>
              Captured {new Date(report.snapshot.capturedAt).toLocaleString()}.
              Issued {new Date(report.issuedAt).toLocaleString()}.
            </p>
            <p>
              Format{' '}
              {report.policy === 'saved-record-review-v2'
                ? 'v2 · includes selected research receipts'
                : 'v1 · financial records'}
              .
            </p>
            {report.policy === 'saved-record-review-v2' && (
              <IssuedReportResearch
                capture={report.snapshot.researchConnections}
                onCheckCurrent={() => {
                  setSelected(null);
                  setTimeout(() => {
                    window.location.hash = 'connections';
                  }, 0);
                }}
              />
            )}
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
