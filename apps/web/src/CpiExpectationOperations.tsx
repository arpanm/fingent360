import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLEVELAND_CPI_HISTORY_URL,
  CpiExpectationEditionSchema,
  CpiExpectationQueueSchema,
  CpiExpectationReviewSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function CpiExpectationOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof CpiExpectationQueueSchema.parse
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
  const [period, setPeriod] = useState(''),
    [asOf, setAsOf] = useState('');
  const historySelection =
    url === CLEVELAND_CPI_HISTORY_URL ? { period, asOf } : undefined;
  const historyReady = !historySelection || Boolean(period && asOf);
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
    (failure: unknown) => {
      if (
        failure instanceof RequestError &&
        (failure.status === 401 || failure.status === 403)
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
        const value = CpiExpectationQueueSchema.parse(
          await request(
            '/ops/cpi-expectations' +
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
        if (CpiExpectationReviewSchema.parse(result).requestId !== requestId)
          throw Error('Review receipt does not match this request.');
      } else if (CpiExpectationEditionSchema.parse(result).id !== requestId)
        throw Error('Capture receipt does not match this request.');
      pending.current = null;
      setNotice(
        'Receipt retained. Review the original evidence before publication.',
      );
      await reload();
    } catch (error) {
      if (alive.current && activeSelection === selection.current) deny(error);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section aria-label="CPI expectation operations">
      <h2>Original CPI model expectations</h2>
      <p>
        Only original Cleveland Fed current monthly nowcast, dated monthly chart
        archive and BLS archived CPI pages are supported. Record actual
        permission for source retention, public derived facts and offline
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
        Original CPI report URL
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <p>
        For a historical model vintage use{' '}
        <button
          disabled={busy}
          onClick={() => {
            setUrl(CLEVELAND_CPI_HISTORY_URL);
            setConfirmed(false);
          }}
        >
          Cleveland monthly archive
        </button>
        . Select the exact target month and vintage day; this does not establish
        prior app availability.
      </p>
      {historySelection && (
        <>
          <label>
            Historical CPI target month
            <input
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Historical model vintage day
            <input
              type="date"
              value={asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
        </>
      )}
      <label>
        CPI source permission scope
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
        Original CPI HTML or JSON file
        <input
          type="file"
          accept=".html,.htm,.json"
          disabled={busy}
          onChange={(e) => {
            const selected = ++selection.current;
            setConfirmed(false);
            setBody('');
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10000000) {
              setError('Choose a source file below 10 MB.');
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
          busy ||
          !historyReady ||
          !confirmed ||
          rights.trim().length < 12 ||
          !url ||
          !body
        }
        onClick={() =>
          void run('/ops/cpi-expectations/import', {
            url,
            body,
            rightsBasis: rights,
            rightsConfirmed: true,
            ...(historySelection ? { historySelection } : {}),
          })
        }
      >
        Retain CPI file
      </button>
      <button
        disabled={
          busy ||
          !historyReady ||
          !confirmed ||
          rights.trim().length < 12 ||
          !url
        }
        onClick={() =>
          void run('/ops/cpi-expectations/fetch', {
            url,
            rightsBasis: rights,
            rightsConfirmed: true,
            ...(historySelection ? { historySelection } : {}),
          })
        }
      >
        Fetch original CPI report
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
            {edition.expectation.kind}:{' '}
            {edition.expectation.points
              .map((point) => `${point.period} ${point.value}%`)
              .join(', ')}{' '}
            · {state}
          </h3>
          <p>
            {edition.expectation.sourcePublishedOn} ·{' '}
            {edition.expectation.retrievedAt}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              const activeSelection = ++selection.current;
              void request(`/ops/cpi-expectations/${edition.id}/evidence`)
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
            Inspect CPI original
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void run('/ops/cpi-expectations/review', {
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
          <summary>
            Retained original CPI source (untrusted source text)
          </summary>
          <pre>{raw}</pre>
          <button onClick={() => setRaw('')}>Close original</button>
        </details>
      )}
    </section>
  );
}
