import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GdpExpectationEditionSchema,
  GdpExpectationQueueSchema,
  GdpExpectationReviewSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function GdpExpectationOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof GdpExpectationQueueSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(''),
    [body, setBody] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [raw, setRaw] = useState('');
  const pending = useRef<{ key: string; id: string } | null>(null);
  const selection = useRef(0),
    pageSequence = useRef(0),
    alive = useRef(true);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      selection.current++;
      pageSequence.current++;
    };
  }, []);
  const deny = useCallback(
    (failure: unknown, protectedRead = true) => {
      if (
        failure instanceof RequestError &&
        (failure.status === 401 || (protectedRead && failure.status === 403))
      ) {
        selection.current++;
        pageSequence.current++;
        setQueue(null);
        setLoading(false);
        setRights('');
        setRaw('');
        setBody('');
        setConfirmed(false);
        pending.current = null;
        onDenied?.();
      }
      setError(
        failure instanceof Error
          ? failure.message
          : 'Expectation operation failed.',
      );
    },
    [onDenied],
  );
  const reload = useCallback(
    async (after?: string) => {
      if (!after) {
        selection.current++;
        setRaw('');
      }
      const sequence = ++pageSequence.current;
      setLoading(true);
      setError('');
      try {
        const value = GdpExpectationQueueSchema.parse(
          await request(
            '/ops/gdp-expectations' +
              (after ? '?after=' + encodeURIComponent(after) : ''),
          ),
        );
        if (!alive.current || sequence !== pageSequence.current) return;
        setQueue((previous) =>
          after && previous
            ? { ...value, editions: [...previous.editions, ...value.editions] }
            : value,
        );
      } catch (error) {
        if (alive.current && sequence === pageSequence.current) deny(error);
      } finally {
        if (alive.current && sequence === pageSequence.current)
          setLoading(false);
      }
    },
    [request, deny],
  );
  useEffect(() => {
    void reload();
    return () => {
      pageSequence.current++;
      selection.current++;
    };
  }, [reload]);
  const run = async (path: string, data: Record<string, unknown>) => {
    const activeSelection = selection.current;
    setBusy(true);
    setError('');
    try {
      const key = JSON.stringify({ path, data });
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      const requestId = pending.current.id;
      const input = { ...data, requestId };
      const result = await request(path, input, 'POST');
      if (!alive.current || activeSelection !== selection.current) return;
      if (path.endsWith('/review')) {
        if (GdpExpectationReviewSchema.parse(result).requestId !== requestId)
          throw Error('Review receipt does not match this request.');
      } else if (GdpExpectationEditionSchema.parse(result).id !== requestId)
        throw Error('Capture receipt does not match this request.');
      pending.current = null;
      setNotice(
        'Receipt retained. Review the original evidence before publication.',
      );
      await reload();
    } catch (error) {
      // A denied mutation (for example self-review) is not session expiry.
      // Protected reads still clear state on403; all401 responses do so.
      if (alive.current && activeSelection === selection.current)
        deny(error, false);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section aria-label="GDP expectation operations">
      <h2>Original GDP survey expectations</h2>
      <p>
        Only original Philadelphia Fed quarterly SPF pages are supported. Record
        actual permission for source retention, public derived facts and offline
        distribution; public access is not permission. Another named operator
        must publish.
      </p>
      <button disabled={busy || loading} onClick={() => void reload()}>
        Refresh expectation queue
      </button>
      {queue?.nextCursor && (
        <button
          disabled={busy || loading}
          onClick={() => void reload(queue.nextCursor!)}
        >
          Load older expectations
        </button>
      )}
      {loading && <p role="status">Loading expectation page…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void reload().catch(deny)}>
            Reload expectation queue
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <label>
        Original SPF report URL
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        SPF source permission scope
        <textarea
          value={rights}
          onChange={(e) => {
            setRights(e.target.value);
            setConfirmed(false);
          }}
          maxLength={1000}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I verified permission for storage, display and offline distribution.
      </label>
      <label>
        Original SPF HTML file
        <input
          type="file"
          accept=".html,.htm"
          disabled={busy}
          onChange={(e) => {
            const selected = ++selection.current;
            setConfirmed(false);
            setBody('');
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2000000) {
              setError('Choose a source file below 2 MB.');
              return;
            }
            void file
              .text()
              .then((value) => {
                if (selection.current === selected) setBody(value);
              })
              .catch((error) => {
                if (selection.current === selected) deny(error);
              });
          }}
        />
      </label>
      <button
        disabled={
          busy || !confirmed || rights.trim().length < 12 || !url || !body
        }
        onClick={() =>
          void run('/ops/gdp-expectations/import', {
            url,
            body,
            rightsBasis: rights,
            rightsConfirmed: true,
          })
        }
      >
        Retain SPF file
      </button>
      <button
        disabled={busy || !confirmed || rights.trim().length < 12 || !url}
        onClick={() =>
          void run('/ops/gdp-expectations/fetch', {
            url,
            rightsBasis: rights,
            rightsConfirmed: true,
          })
        }
      >
        Fetch original SPF report
      </button>
      <label>
        Expectation review reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
        />
      </label>
      {busy && <p role="status">Saving expectation evidence…</p>}
      {!queue && !error && <p>Loading source queue…</p>}
      {queue?.editions.length === 0 && <p>No expectation captures yet.</p>}
      {queue?.editions.map(({ edition, state }) => (
        <article key={edition.id}>
          <h3>
            {edition.expectation.period}: {edition.expectation.value}% · {state}
          </h3>
          <p>
            {edition.expectation.sourcePublishedOn} ·{' '}
            {edition.expectation.retrievedAt}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              const activeSelection = ++selection.current;
              void request(`/ops/gdp-expectations/${edition.id}/evidence`)
                .then((value) => {
                  if (!alive.current || activeSelection !== selection.current)
                    return;
                  if (
                    !value ||
                    typeof value !== 'object' ||
                    !('body' in value) ||
                    typeof value.body !== 'string'
                  )
                    throw Error('Original evidence unavailable.');
                  setRaw(value.body);
                })
                .catch((error) => {
                  if (alive.current && activeSelection === selection.current)
                    deny(error);
                });
            }}
          >
            Inspect SPF original
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void run('/ops/gdp-expectations/review', {
                  editionId: edition.id,
                  decision,
                  reason,
                })
              }
            >
              {decision === 'publish'
                ? 'Publish expectation'
                : 'Withdraw expectation'}
            </button>
          ))}
        </article>
      ))}
      {raw && (
        <details open>
          <summary>Retained original SPF HTML (untrusted source text)</summary>
          <pre>{raw}</pre>
          <button onClick={() => setRaw('')}>Close original</button>
        </details>
      )}
    </section>
  );
}
