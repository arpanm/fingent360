import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  InstitutionalFlowInputSchema,
  InstitutionalFlowQueueSchema,
  InstitutionalFlowCaptureSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { InstitutionalFlowEdition } from './InstitutionalFlows';
export function InstitutionalFlowOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [source, setSource] = useState<'nse-cash-html' | 'cdsl-daily-html'>(
      'nse-cash-html',
    ),
    [body, setBody] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [reviewConfirmed, setReviewConfirmed] = useState(false),
    [rows, setRows] = useState<
      ReturnType<typeof InstitutionalFlowQueueSchema.parse>
    >([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const live = useRef(true),
    selection = useRef(0),
    intent = useRef<{ key: string; id: string } | null>(null);
  function fail(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      selection.current++;
      setRows([]);
      setBody('');
      setConfirmed(false);
      onDenied();
    } else
      setError(
        cause instanceof Error
          ? cause.message
          : 'Request failed. Retry the same action.',
      );
  }
  async function load() {
    setLoading(true);
    try {
      const value = InstitutionalFlowQueueSchema.parse(
        await request('/ops/institutional-flows'),
      );
      if (live.current) setRows(value);
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      selection.current++;
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = JSON.stringify({ path, value });
    if (intent.current?.key !== key)
      intent.current = { key, id: crypto.randomUUID() };
    try {
      const input = { ...value, requestId: intent.current.id };
      const result = await request(
        '/ops/institutional-flows/' + path,
        path === 'capture' ? InstitutionalFlowInputSchema.parse(input) : input,
        'POST',
      );
      if (!live.current) return;
      if (path === 'capture') {
        const capture = InstitutionalFlowCaptureSchema.parse(result);
        setNotice(
          capture.state === 'retained'
            ? 'Original retained; independent review required.'
            : 'Original retained in quarantine: ' + capture.reason,
        );
      } else setNotice('Publication decision recorded.');
      await load();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Institutional flow onboarding"
      aria-busy={busy || loading}
    >
      <h2>Retain institutional reports</h2>
      <p>
        Use the original CDSL daily HTML page or NSE saved rendered HTML
        containing both populated cash tables. An empty script-only page is
        quarantined. Publication requires source-specific written
        storage/display/offline permission and a different named reviewer. No
        provider is fetched automatically. Publishing creates an evidence-backed
        reading item for Today/Explore. In Events, cite one exact net row,
        independently review it, then use “Extract institutional flow row” in
        Event scenarios. Withdrawal also removes that source from event/scenario
        admission.
      </p>
      {loading && <p role="status">Loading flow review queue…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh flow queue
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send('capture', {
            source,
            body,
            rightsEvidence: rights,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Original source capture</legend>
          <label>
            Flow source
            <select
              value={source}
              onChange={(event) => {
                selection.current++;
                setSource(event.target.value as typeof source);
                setBody('');
                setConfirmed(false);
              }}
            >
              <option value="nse-cash-html">NSE provisional cash tables</option>
              <option value="cdsl-daily-html">
                CDSL investment and derivatives
              </option>
            </select>
          </label>
          <label>
            Original flow HTML
            <input
              key={source}
              type="file"
              accept=".html,.htm"
              onChange={(event) => {
                const ticket = ++selection.current;
                setBody('');
                setConfirmed(false);
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) {
                  setError('Choose an HTML file no larger than 1 MB.');
                  return;
                }
                void file
                  .text()
                  .then((value) => {
                    if (live.current && ticket === selection.current)
                      setBody(value);
                  })
                  .catch(fail);
              }}
            />
          </label>
          <label>
            Flow source permission evidence
            <textarea
              required
              minLength={20}
              maxLength={2000}
              value={rights}
              onChange={(event) => {
                setRights(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Written permission covers original retention, display and offline
            distribution.
          </label>
          <button disabled={!confirmed || !body}>Retain flow capture</button>
        </fieldset>
      </form>
      <label>
        Flow independent review reason
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setReviewConfirmed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(event) => setReviewConfirmed(event.target.checked)}
        />
        I independently checked the source, distinct dates, arithmetic and usage
        rights.
      </label>
      {!loading && !rows.length && (
        <p>No institutional flow captures retained.</p>
      )}
      {rows.map((row) => (
        <article key={row.id}>
          <p>Status: {row.state}</p>
          {row.error && <p role="alert">{row.error}</p>}
          {row.receipt && <InstitutionalFlowEdition edition={row.receipt} />}
          <button
            disabled={busy}
            onClick={() =>
              void request(`/ops/institutional-flows/${row.id}/evidence`)
                .then((value) => {
                  const url = URL.createObjectURL(
                      new Blob([JSON.stringify(value, null, 2)], {
                        type: 'application/json',
                      }),
                    ),
                    anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = `institutional-flow-${row.id}.json`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                })
                .catch(fail)
            }
          >
            Download original flow capture
          </button>
          {row.receipt && (
            <>
              {(['publish', 'withdraw'] as const).map((decision) => (
                <button
                  key={decision}
                  disabled={
                    busy ||
                    reason.trim().length < 12 ||
                    (decision === 'publish' && !reviewConfirmed)
                  }
                  onClick={() =>
                    void send('review', {
                      id: row.id,
                      decision,
                      reason,
                      rightsVerified: reviewConfirmed,
                    })
                  }
                >
                  {decision === 'publish'
                    ? 'Publish independently reviewed flows'
                    : 'Withdraw flow edition'}
                </button>
              ))}
            </>
          )}
        </article>
      ))}
    </section>
  );
}
