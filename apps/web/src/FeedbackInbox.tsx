import { FeedbackEncryption } from './FeedbackEncryption';
import { EvaluationLineage } from './EvaluationLineage';
import { useEffect, useState } from 'react';
import {
  FeedbackListSchema,
  FeedbackReportSchema,
  FeedbackReceiptSchema,
  type FeedbackReport,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { json } from './net';
import { Dialog } from './Dialog';
import { saveDownload } from './runtime';

export function FeedbackInbox() {
  const [items, setItems] = useState<
      z.infer<typeof FeedbackListSchema>['items']
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [report, setReport] = useState<FeedbackReport | null>(null),
    [status, setStatus] = useState('received'),
    [deleting, setDeleting] = useState(false);
  async function load(next?: string) {
    const query = new URLSearchParams();
    if (filter) query.set('status', filter);
    if (next) query.set('cursor', next);
    const data = FeedbackListSchema.parse(await json(`/ops/feedback?${query}`));
    setItems((previous) => (next ? [...previous, ...data.items] : data.items));
    setCursor(data.nextCursor);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const query = filter ? `?status=${filter}` : '';
    void json(`/ops/feedback${query}`)
      .then((value) => {
        if (active) {
          const data = FeedbackListSchema.parse(value);
          setItems(data.items);
          setCursor(data.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Feedback could not be loaded.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Feedback inbox">
      <h1>Feedback inbox</h1>
      <p>
        Submitted ideas and issues, including app screenshots and voice notes.
        Attachments are private; handle them as user data. The server retains
        report content for 30 days. Administrator access is required. Opening
        the inbox or a report records access visible to its sender.
      </p>
      <FeedbackEncryption />
      <div className="feedback-tools">
        <label htmlFor="feedback-status-filter">Feedback status</label>
        <select
          id="feedback-status-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="received">Received</option>
          <option value="reviewing">Being reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void action(() => load())}
        >
          Refresh feedback inbox
        </button>
      </div>
      {loading && <p role="status">Loading feedback…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && !error && items.length === 0 && (
        <p>No feedback matches this view.</p>
      )}
      <div className="feedback-list">
        {items.map((item) => (
          <article className="feedback-card" key={item.id}>
            <header>
              <span className="feedback-status">{item.status}</span>
              <time>{new Date(item.receivedAt).toLocaleString()}</time>
            </header>
            {item.context.publicView && (
              <details>
                <summary>Inspect source and generation trace</summary>
                <EvaluationLineage
                  initialSource={item.context.publicView.item.id}
                />
              </details>
            )}
            <p className="feedback-body-text">
              {item.text || 'Voice feedback'}
            </p>
            <p>
              {item.context.screen} · {item.context.runtime} ·{' '}
              {item.hasImage ? 'Screenshot attached' : 'No screenshot'} ·{' '}
              {item.hasAudio ? 'Voice attached' : 'No voice'}
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const value = FeedbackReportSchema.parse(
                    await json(`/ops/feedback/${item.id}`),
                  );
                  setReport(value);
                  setStatus(value.status);
                })
              }
            >
              Review feedback {item.id.slice(0, 8)}
            </button>
          </article>
        ))}
      </div>
      {cursor && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void action(() => load(cursor))}
        >
          Load more feedback
        </button>
      )}
      {report && (
        <Dialog
          title="Review feedback"
          onClose={() => {
            if (!busy) setReport(null);
          }}
        >
          <div className="feedback-ops-detail">
            <p>
              Receipt {report.id} · {report.context.screen} · App{' '}
              {report.context.appVersion}
            </p>
            {report.context.publicView && (
              <details>
                <summary>Inspect source and generation trace</summary>
                <EvaluationLineage
                  initialSource={report.context.publicView.item.id}
                />
              </details>
            )}
            <p className="feedback-body-text">
              {report.text || 'Voice feedback'}
            </p>
            {report.image && (
              <img
                src={`data:image/png;base64,${report.image.base64}`}
                alt="Feedback screenshot"
              />
            )}
            {report.audio && (
              <audio
                controls
                src={`data:${report.audio.mime};base64,${report.audio.base64}`}
                aria-label="Feedback voice recording"
              />
            )}
            <p>
              Captured {new Date(report.context.capturedAt).toLocaleString()} ·
              viewport {report.context.viewport.width} ×{' '}
              {report.context.viewport.height}
            </p>
            <label htmlFor="feedback-review-status">Review status</label>
            <select
              id="feedback-review-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="received">Received</option>
              <option value="reviewing">Being reviewed</option>
              <option value="resolved">Resolved</option>
            </select>
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <div className="feedback-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const receipt = FeedbackReceiptSchema.parse(
                      await json(
                        `/ops/feedback/${report.id}`,
                        { expectedVersion: report.version, status },
                        'PATCH',
                      ),
                    );
                    setReport({ ...report, ...receipt });
                    setNotice('Feedback status saved.');
                    await load();
                  })
                }
              >
                Save review status
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    setNotice(
                      await saveDownload(
                        new Blob([JSON.stringify(report, null, 2)], {
                          type: 'application/json',
                        }),
                        `fingent360-feedback-${report.id}.json`,
                      ),
                    );
                  })
                }
              >
                Download feedback
              </button>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              Delete report and attachments
            </button>
          </div>
        </Dialog>
      )}
      {deleting && report && (
        <Dialog
          title="Delete received feedback?"
          onClose={() => setDeleting(false)}
        >
          <p>
            The server will remove this report’s text and attachments. A minimal
            receipt tombstone prevents later retries from recreating it.
          </p>
          <div className="feedback-actions">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await json(`/ops/feedback/${report.id}`, undefined, 'DELETE');
                  setDeleting(false);
                  setReport(null);
                  await load();
                  setNotice('Feedback content deleted.');
                })
              }
            >
              Confirm server deletion
            </button>
            <button className="secondary" onClick={() => setDeleting(false)}>
              Keep report
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
