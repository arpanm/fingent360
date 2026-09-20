import { useEffect, useRef, useState } from 'react';
import {
  IndexLevelQueueSchema,
  IndexLevelCaptureSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
import { IndexLevelEdition } from './IndexLevels';
export function IndexLevelsOperations({
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
    [rows, setRows] = useState<
      ReturnType<typeof IndexLevelQueueSchema.parse>['items']
    >([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const readEpoch = useRef(0);
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
        cause instanceof Error ? cause.message : 'Index levels request failed.',
      );
  }
  async function load(cursor: string | null = pages[pageIndex] ?? null) {
    const ticket = ++readEpoch.current;
    setLoading(true);
    setRows([]);
    setNextCursor(null);
    setVerified(false);
    try {
      const result = IndexLevelQueueSchema.parse(
        await request(
          '/ops/index-levels' +
            (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        ),
      );
      if (live.current && ticket === readEpoch.current) {
        setRows(result.items);
        setNextCursor(result.nextCursor);
      }
    } catch (cause) {
      if (ticket === readEpoch.current) fail(cause);
    } finally {
      if (live.current && ticket === readEpoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      fileEpoch.current++;
      readEpoch.current++;
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
        '/ops/index-levels/' + path,
        { ...value, requestId: pending.current.id },
        'POST',
      );
      if (!live.current) return;
      setNotice(
        path === 'capture'
          ? IndexLevelCaptureSchema.parse(response).state === 'quarantined'
            ? 'Capture retained in quarantine. Inspect the error and upload the corrected original as a new capture.'
            : 'Original capture retained for independent review.'
          : 'Review saved.',
      );
      if (path === 'capture') {
        setPages([null]);
        setPageIndex(0);
        await load(null);
      } else await load();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function evidence(id: string) {
    setBusy(true);
    setError('');
    try {
      const value = await request('/ops/index-levels/' + id + '/evidence');
      if (!live.current) return;
      const message = await saveDownload(
        new Blob([JSON.stringify(value, null, 2)], {
          type: 'application/json',
        }),
        'index-levels-' + id + '.json',
        'Retained index evidence downloaded.',
      );
      if (live.current) setNotice(message);
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <section
      className="source-workflow"
      aria-label="Index levels source review"
      aria-busy={busy || loading}
    >
      <h2>Daily price-index source review</h2>
      <p>
        Upload the original dated NSE daily index snapshot only after confirming
        permission to retain, display and include its data in offline builds.
        The supported rows are Nifty50, Nifty Bank and Nifty IT price-index
        levels.
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
        Refresh index history queue
      </button>
      <nav aria-label="Index capture pages">
        <button
          disabled={busy || loading || pageIndex === 0}
          onClick={() => {
            const previous = pageIndex - 1;
            setPageIndex(previous);
            setError('');
            void load(pages[previous] ?? null);
          }}
        >
          Previous capture page
        </button>
        <span>Capture page {pageIndex + 1}</span>
        <button
          disabled={busy || loading || !nextCursor}
          onClick={() => {
            if (!nextCursor) return;
            const next = pageIndex + 1;
            setPages([...pages.slice(0, next), nextCursor]);
            setPageIndex(next);
            setError('');
            void load(nextCursor);
          }}
        >
          Next capture page
        </button>
      </nav>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send('capture', {
            filename,
            csv,
            sourceUrl:
              'https://archives.nseindia.com/content/indices/' + filename,
            rightsEvidence: rights,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Retain original source</legend>
          <label>
            Original daily index CSV
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
          <button disabled={!csv || !confirmed}>Retain index snapshot</button>
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
        I independently checked source identity, OHLC ranges and source-specific
        rights.
      </label>
      {!loading && !error && rows.length === 0 && (
        <p>No index snapshots captured yet.</p>
      )}
      {rows.map((row) => (
        <article key={row.id} data-capture-id={row.id}>
          <p>Status: {row.state}</p>
          {row.error && <p role="alert">{row.error}</p>}
          <button disabled={busy} onClick={() => void evidence(row.id)}>
            Download retained index evidence
          </button>
          {row.receipt && (
            <>
              <IndexLevelEdition edition={row.receipt} />
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
                Publish index snapshot
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
                Withdraw index snapshot
              </button>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
