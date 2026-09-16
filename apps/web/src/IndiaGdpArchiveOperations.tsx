import { useEffect, useRef, useState } from 'react';
import { IndiaGdpArchiveResultSchema } from '@fingent360/contracts';
import { json } from './net';
export function IndiaGdpArchiveOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [month, setMonth] = useState(''),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<ReturnType<
      typeof IndiaGdpArchiveResultSchema.parse
    > | null>(null);
  const live = useRef(true);
  const epoch = useRef(0);
  const [evidence, setEvidence] = useState('');
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  async function capture() {
    epoch.current++;
    setEvidence('');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const value = IndiaGdpArchiveResultSchema.parse(
        await request(
          '/ops/india-macro/gdp-archive',
          { month, rightsEvidence: rights, rightsConfirmed: confirmed },
          'POST',
        ),
      );
      if (live.current) setResult(value);
    } catch (cause) {
      if (!live.current) return;
      if (
        cause &&
        typeof cause === 'object' &&
        'status' in cause &&
        cause.status === 401
      ) {
        setRights('');
        setConfirmed(false);
        setResult(null);
        onDenied?.();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Archive unavailable; retry the same month.',
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section aria-label="GDP archive pickup" aria-busy={busy}>
      <h3>Recover a missed GDP release</h3>
      <p>
        Choose one month from the official PIB archive. Supported quarterly
        originals become drafts; unfamiliar numerical layouts remain
        quarantined. This does not claim a complete historical GDP archive.
        Review each retained original independently before publication.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void capture();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Archive publication month
            <input
              type="month"
              required
              value={month}
              max={new Date().toISOString().slice(0, 7)}
              onChange={(event) => {
                epoch.current++;
                setEvidence('');
                setMonth(event.target.value);
                setConfirmed(false);
                setResult(null);
              }}
            />
          </label>
          <label>
            PIB archive retention permission
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
            I confirmed original retention, display and offline rights for this
            archive capture.
          </label>
          <button disabled={!confirmed || !month || rights.trim().length < 20}>
            Fetch month into GDP review
          </button>
        </fieldset>
      </form>
      {busy && (
        <p role="status">Reading the official archive and retaining drafts…</p>
      )}
      {error && (
        <p role="alert">
          {error} Retry using the same month and permission evidence; unchanged
          originals reuse their capture IDs.
        </p>
      )}
      {result && (
        <>
          <p role="status">
            Archive month {result.month}: {result.results.length} quarterly
            originals retained or quarantined.
          </p>
          <p>
            Discovery captured {result.retrievedAt}. Original index:{' '}
            {result.indexHash}. Retrieval receipt: {result.captureHash}
          </p>
          {result.failures.map((item) => (
            <p role="alert" key={item.url}>
              {item.url}: {item.reason}
            </p>
          ))}
          {result.results.length === 0 && result.failures.length === 0 && (
            <p>
              No matching quarterly GDP titles were found in this archive
              response. This is not proof that no GDP publication exists
              elsewhere.
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => {
              const ticket = ++epoch.current;
              void request(
                '/ops/india-macro/archive-evidence/' + result.captureHash,
              )
                .then((value) => {
                  if (live.current && ticket === epoch.current)
                    setEvidence(JSON.stringify(value, null, 2));
                })
                .catch((cause) => {
                  if (live.current && ticket === epoch.current) {
                    setEvidence('');
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : 'Archive evidence unavailable.',
                    );
                    if (
                      cause &&
                      typeof cause === 'object' &&
                      'status' in cause &&
                      cause.status === 401
                    ) {
                      setResult(null);
                      setRights('');
                      setConfirmed(false);
                      onDenied?.();
                    }
                  }
                });
            }}
          >
            Inspect retained archive discovery
          </button>
          {evidence && (
            <details open>
              <summary>Untrusted original archive response</summary>
              <pre>{evidence}</pre>
            </details>
          )}
          <ul>
            {result.results.map((row) => (
              <li key={row.id}>
                {row.id}: {row.status}
                {row.reason ? ` — ${row.reason}` : ''}
              </li>
            ))}
          </ul>
          <p>
            Use Refresh India queue below, then independently inspect and review
            the retained editions. Quarantined originals remain available under
            attempts.
          </p>
        </>
      )}
    </section>
  );
}
