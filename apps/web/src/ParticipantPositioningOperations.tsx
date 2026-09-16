import { useEffect, useRef, useState } from 'react';
import {
  PositioningQueueSchema,
  PositioningCaptureSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { PositioningEdition } from './ParticipantPositioning';
export function ParticipantPositioningOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [filename, setFilename] = useState(''),
    [csv, setCsv] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [verified, setVerified] = useState(false),
    [rows, setRows] = useState<ReturnType<typeof PositioningQueueSchema.parse>>(
      [],
    ),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const live = useRef(true),
    fileEpoch = useRef(0),
    pending = useRef<{ key: string; id: string } | null>(null);
  function fail(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      fileEpoch.current++;
      setRows([]);
      setCsv('');
      setConfirmed(false);
      onDenied();
    } else
      setError(
        cause instanceof Error ? cause.message : 'Positioning request failed.',
      );
  }
  async function load() {
    setLoading(true);
    try {
      const result = PositioningQueueSchema.parse(
        await request('/ops/positioning'),
      );
      if (live.current) setRows(result);
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
      fileEpoch.current++;
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = JSON.stringify({ path, value });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const response = await request(
        '/ops/positioning/' + path,
        { ...value, requestId: pending.current.id },
        'POST',
      );
      if (live.current)
        setNotice(
          path === 'capture'
            ? PositioningCaptureSchema.parse(response).state === 'quarantined'
              ? 'Capture retained in quarantine. Inspect the error and upload the corrected original as a new capture.'
              : 'Original capture retained for independent review.'
            : 'Review saved.',
        );
      await load();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function evidence(id: string) {
    try {
      const value = await request('/ops/positioning/' + id + '/evidence');
      if (!live.current) return;
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(value, null, 2)], {
            type: 'application/json',
          }),
        ),
        link = document.createElement('a');
      link.href = url;
      link.download = 'positioning-' + id + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      fail(cause);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Positioning source review"
      aria-busy={busy || loading}
    >
      <h2>Participant OI source review</h2>
      <p>
        Upload the original dated NSE report only after confirming permission to
        retain, display and include its data in offline builds. Read every
        futures/options side separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading capture queue…</p>}
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh positioning queue
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send('capture', {
            filename,
            csv,
            sourceUrl:
              'https://archives.nseindia.com/content/nsccl/' + filename,
            rightsEvidence: rights,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Retain original source</legend>
          <label>
            Original participant OI CSV
            <input
              required
              type="file"
              accept=".csv"
              onChange={(event) => {
                const id = ++fileEpoch.current,
                  file = event.target.files?.[0];
                setCsv('');
                setFilename('');
                setConfirmed(false);
                if (!file) return;
                if (file.size > 2000000) {
                  setError('File exceeds2MB.');
                  return;
                }
                void file
                  .text()
                  .then((value) => {
                    if (live.current && id === fileEpoch.current) {
                      setFilename(file.name);
                      setCsv(value);
                    }
                  })
                  .catch(fail);
              }}
            />
          </label>
          <p>{filename}</p>
          <label>
            Source permission evidence
            <textarea
              required
              minLength={20}
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
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I have confirmed retention, display and offline rights for this
            source capture.
          </label>
          <button disabled={!csv || !confirmed}>
            Retain positioning capture
          </button>
        </fieldset>
      </form>
      <label>
        Independent review reason
        <textarea
          minLength={20}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setVerified(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        I independently checked source identity, totals and source-specific
        rights.
      </label>
      {!loading && rows.length === 0 && <p>No positioning captures yet.</p>}
      {rows.map((row) => (
        <article key={row.id}>
          <p>Status: {row.state}</p>
          {row.error && <p role="alert">{row.error}</p>}
          <button disabled={busy} onClick={() => void evidence(row.id)}>
            Download retained positioning evidence
          </button>
          {row.receipt && (
            <>
              <PositioningEdition edition={row.receipt} />
              <button
                disabled={busy || !verified || reason.trim().length < 20}
                onClick={() =>
                  void send('review', {
                    id: row.id,
                    decision: 'publish',
                    reason,
                    rightsVerified: verified,
                  })
                }
              >
                Publish positioning
              </button>
              <button
                disabled={busy || reason.trim().length < 20}
                onClick={() =>
                  void send('review', {
                    id: row.id,
                    decision: 'withdraw',
                    reason,
                    rightsVerified: verified,
                  })
                }
              >
                Withdraw positioning
              </button>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
