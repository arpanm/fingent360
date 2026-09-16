import { useEffect, useRef, useState } from 'react';
import {
  OilEducationQueueSchema,
  OIL_EDUCATION_SOURCE,
} from '@fingent360/contracts';
import type { json } from './net';
import './source-workflows.css';
export function OilEducationOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [rows, setRows] = useState<
      ReturnType<typeof OilEducationQueueSchema.parse>
    >([]),
    [body, setBody] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const epoch = useRef(0),
    live = useRef(true),
    pending = useRef<{ key: string; id: string } | null>(null);
  function failure(cause: unknown) {
    if (!live.current) return;
    if ((cause as { status?: number }).status === 401) onDenied();
    setError(
      cause instanceof Error
        ? cause.message
        : 'Oil source operation unavailable.',
    );
  }
  async function load() {
    setBusy(true);
    try {
      const value = OilEducationQueueSchema.parse(
        await request('/ops/oil-education'),
      );
      if (live.current) setRows(value);
    } catch (cause) {
      failure(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  async function send(path: string, input: Record<string, unknown>) {
    const key = JSON.stringify({ path, input });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(
        '/ops/oil-education/' + path,
        { ...input, requestId: pending.current.id },
        'POST',
      );
      pending.current = null;
      if (live.current)
        setNotice(
          path === 'capture'
            ? 'Original retained. Review parsed or quarantined status below.'
            : 'Source review saved; reading and dependent trace admission follow this decision.',
        );
      await load();
    } catch (cause) {
      failure(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Oil education source"
      aria-busy={busy}
    >
      <h2>Oil-cost evidence to your goal</h2>
      <p>
        Retain the exact 1-Apr-2026 issuer disclosure, then independently review
        its source and permission. This prepares a real reading source; it does
        not predict an oil or stock price.
      </p>
      <a href={OIL_EDUCATION_SOURCE} target="_blank" rel="noreferrer">
        Original IndiGo disclosure
      </a>
      {busy && <p role="status">Loading or saving oil source…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={busy}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh oil source queue
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send('capture', {
            body,
            rightsEvidence: rights,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Original disclosure</legend>
          <label>
            Issuer HTML
            <input
              type="file"
              accept=".html,.htm"
              onChange={(e) => {
                const ticket = ++epoch.current;
                setBody('');
                setConfirmed(false);
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) {
                  setError('Choose a file no larger than 1 MB.');
                  return;
                }
                void file
                  .text()
                  .then((text) => {
                    if (live.current && ticket === epoch.current) setBody(text);
                  })
                  .catch(failure);
              }}
            />
          </label>
          <label>
            Source permission record
            <textarea
              minLength={20}
              maxLength={2000}
              required
              value={rights}
              onChange={(e) => {
                setRights(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Written permission covers retained original, display and offline
            use.
          </label>
          <button disabled={!body || !confirmed}>Retain oil disclosure</button>
        </fieldset>
      </form>
      <label>
        Independent source review reason
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReview(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={review}
          onChange={(e) => setReview(e.target.checked)}
        />
        I independently checked original issuer evidence and usage permission.
      </label>
      {!busy && !rows.length && <p>No oil disclosure retained.</p>}
      {rows.map((row) => (
        <article key={row.id}>
          <p>Status: {row.state}</p>
          {row.error && <p role="alert">{row.error}</p>}
          {row.receipt && (
            <>
              <p>
                Original report date {row.receipt.sourceDate}; exact release
                time unknown.
              </p>
              <blockquote>{row.receipt.anchor}</blockquote>
              <p>Body SHA256 {row.receipt.bodyHash}</p>
              {row.state === 'publish' && (
                <a href={'#read/oil-education-' + row.id}>
                  Read reviewed issuer report
                </a>
              )}
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void request(`/ops/oil-education/${row.id}/evidence`)
                .then((value) => {
                  const url = URL.createObjectURL(
                      new Blob([JSON.stringify(value, null, 2)], {
                        type: 'application/json',
                      }),
                    ),
                    a = document.createElement('a');
                  a.href = url;
                  a.download = 'oil-disclosure-' + row.id + '.json';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(failure)
            }
          >
            Download retained oil original
          </button>
          {row.receipt && (
            <>
              <button
                disabled={busy || !review || reason.trim().length < 12}
                onClick={() =>
                  void send('review', {
                    id: row.id,
                    decision: 'publish',
                    reason,
                    rightsVerified: review,
                  })
                }
              >
                Publish reviewed oil disclosure
              </button>
              <button
                disabled={busy || reason.trim().length < 12}
                onClick={() =>
                  void send('review', {
                    id: row.id,
                    decision: 'withdraw',
                    reason,
                    rightsVerified: review,
                  })
                }
              >
                Withdraw oil disclosure
              </button>
            </>
          )}
        </article>
      ))}
      <p>
        Next: create and review an Events entry citing the exact fuel-cost row,
        link Airlines and the canonical issuer identity, release its qualitative
        context in Research governance, then open Impact trace and select the
        oil walkthrough with your holding and goal.
      </p>
      <a href="#impact-traces">Open your impact trace</a>
    </section>
  );
}
