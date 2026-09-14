import { useEffect, useRef, useState } from 'react';
import {
  BeaHistorySchema,
  BeaAttemptPageSchema,
  BeaRetainedSchema,
  BeaValidationSchema,
  BeaStageSchema,
  type BeaValidation,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function BeaQuarantine({
  request,
  onUnauthorized,
  onBack,
  onReview,
}: {
  request: typeof json;
  onUnauthorized: () => void;
  onBack: () => void;
  onReview: () => Promise<void>;
}) {
  const [page, setPage] = useState<ReturnType<
      typeof BeaAttemptPageSchema.parse
    > | null>(null),
    [selected, setSelected] = useState(''),
    [body, setBody] = useState<string | null>(null),
    [validation, setValidation] = useState<BeaValidation | null>(null),
    [receipt, setReceipt] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      path: string;
      body: unknown;
      kind: 'validate' | 'stage';
    } | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof BeaHistorySchema.parse
  > | null>(null);
  const live = useRef(false),
    epoch = useRef(0),
    denied = useRef(false);
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      denied.current = true;
      epoch.current++;
      setPage(null);
      setHistory(null);
      setBody(null);
      setValidation(null);
      setPending(null);
      setReceipt('');
      setSelected('');
      onUnauthorized();
    } else if (live.current)
      setError(e instanceof Error ? e.message : 'Recovery unavailable.');
  }
  async function load(after?: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    setError('');
    try {
      const value = BeaAttemptPageSchema.parse(
        await request(
          `/ops/discovery/bea-attempts${after ? `?after=${after}` : ''}`,
        ),
      );
      if (live.current && !denied.current && ticket === epoch.current)
        setPage(value);
    } catch (e) {
      fail(e);
    } finally {
      if (live.current && ticket === epoch.current) setBusy(false);
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
  async function evidence(id: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = BeaRetainedSchema.parse(
        await request(`/ops/discovery/bea-attempts/${id}/evidence`),
      );
      if (live.current && !denied.current && ticket === epoch.current)
        setBody(value.body);
    } catch (e) {
      fail(e);
    } finally {
      if (live.current && ticket === epoch.current) setBusy(false);
    }
  }
  async function readHistory(after?: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = BeaHistorySchema.parse(
        await request(
          `/ops/discovery/bea-attempts/${selected}/history${after ? `?after=${after}` : ''}`,
        ),
      );
      if (live.current && !denied.current && ticket === epoch.current)
        setHistory(value);
    } catch (e) {
      fail(e);
    } finally {
      if (live.current && ticket === epoch.current) setBusy(false);
    }
  }
  async function openValidation(id: string) {
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = BeaValidationSchema.parse(
        await request(`/ops/discovery/bea-validations/${id}`),
      );
      if (live.current && !denied.current && ticket === epoch.current) {
        setValidation(value);
        setReceipt('Historical validation; staging checks current heads.');
      }
    } catch (e) {
      fail(e);
    } finally {
      if (live.current && ticket === epoch.current) setBusy(false);
    }
  }
  async function act(action: NonNullable<typeof pending>) {
    const ticket = ++epoch.current;
    setBusy(true);
    setPending(action);
    setError('');
    try {
      const value = await request(action.path, action.body, 'POST');
      if (!live.current || denied.current || ticket !== epoch.current) return;
      if (action.kind === 'validate') {
        setValidation(BeaValidationSchema.parse(value));
        setReceipt(
          'Historical validation receipt. Stage will recheck all captured source heads.',
        );
      } else {
        const saved = BeaStageSchema.parse(value);
        setValidation(null);
        setReceipt(
          `Draft staging saved at ${saved.stagedAt}: ${saved.items.filter((i) => i.changed).length} changed editions. Nothing was published.`,
        );
      }
      setPending(null);
    } catch (e) {
      if (e instanceof RequestError && [400, 404, 409].includes(e.status)) {
        setPending(null);
        setValidation(null);
      }
      fail(e);
    } finally {
      if (live.current && ticket === epoch.current) setBusy(false);
    }
  }
  return (
    <section aria-label="BEA retained response recovery" data-feedback-private>
      <h2>BEA retained response recovery</h2>
      <p>
        Revalidate complete stored RSS without contacting the provider. Staging
        creates drafts only; publication requires source review.
      </p>
      <button onClick={onBack}>Back to Operations</button>
      {busy && <p role="status">Loading recovery records…</p>}
      {error && <p role="alert">{error}</p>}
      {receipt && <p role="status">{receipt}</p>}
      {receipt.startsWith('Draft staging saved') && (
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onReview()
              .catch(fail)
              .finally(() => {
                if (live.current) setBusy(false);
              });
          }}
        >
          Open staged drafts for review
        </button>
      )}
      {pending && !busy && (
        <>
          <p>
            The response is uncertain. Retry the identical request to recover
            its historical receipt.
          </p>
          <button onClick={() => void act(pending)}>
            Retry same recovery request
          </button>
          <button
            onClick={() => {
              setPending(null);
              setValidation(null);
            }}
          >
            Dismiss retry
          </button>
        </>
      )}
      <button disabled={busy || !!pending} onClick={() => void load()}>
        Reload attempts
      </button>
      {body !== null ? (
        <>
          <h3>Protected retained RSS</h3>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {body}
          </pre>
          <button onClick={() => setBody(null)}>Back to attempt</button>
        </>
      ) : (
        <>
          {page && (
            <>
              <p>{page.legacy}</p>
              {page.attempts.length === 0 && (
                <p>
                  No linked BEA attempts yet. Existing source runs are not
                  retroactively linked.
                </p>
              )}
              {page.attempts.map((a) => (
                <article key={a.id}>
                  <h3>BEA attempt {a.startedAt}</h3>
                  <p>{a.id}</p>
                  <ol>
                    {a.events.map((e) => (
                      <li key={e.id}>
                        {e.kind} · {e.at} · {e.message}
                        {e.hash && (
                          <p>
                            Hash {e.hash} · {e.bytes} bytes · originally
                            retrieved {e.retrievedAt}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <button
                    disabled={busy || !!pending}
                    onClick={() => {
                      setSelected(a.id);
                      setHistory(null);
                      setValidation(null);
                      setReceipt('');
                    }}
                  >
                    Inspect attempt
                  </button>
                  {selected === a.id && (
                    <div>
                      <button
                        disabled={busy || !!pending}
                        onClick={() => void readHistory()}
                      >
                        Saved recovery history
                      </button>
                      <button
                        disabled={
                          busy ||
                          !!pending ||
                          !a.events.some((e) => e.kind === 'retained')
                        }
                        onClick={() => void evidence(a.id)}
                      >
                        Inspect retained response
                      </button>
                      <button
                        disabled={
                          busy ||
                          !!pending ||
                          !a.events.some((e) => e.kind === 'retained')
                        }
                        onClick={() =>
                          void act({
                            kind: 'validate',
                            path: `/ops/discovery/bea-attempts/${a.id}/revalidate`,
                            body: { requestId: crypto.randomUUID() },
                          })
                        }
                      >
                        Revalidate stored response
                      </button>
                      {!a.events.some((e) => e.kind === 'retained') && (
                        <p>
                          No complete verified response is linked. Revalidation
                          is unavailable.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
              {page.next && (
                <button
                  disabled={busy || !!pending}
                  onClick={() => void load(page.next!)}
                >
                  More attempts
                </button>
              )}
            </>
          )}
          {history && (
            <section aria-label="Recovery history">
              <h3>Saved recovery history</h3>
              {history.entries.length === 0 && <p>No saved revalidations.</p>}
              {history.entries.map((entry) => (
                <article key={entry.id}>
                  <p>
                    {entry.at} · {entry.outcome}
                  </p>
                  {entry.staged && (
                    <p>
                      Staged {entry.staged.stagedAt} ·{' '}
                      {entry.staged.items.length} candidate records
                    </p>
                  )}
                  <button
                    disabled={busy || !!pending}
                    onClick={() => void openValidation(entry.id)}
                  >
                    Open validation {entry.id}
                  </button>
                </article>
              ))}
              {history.next && (
                <button
                  disabled={busy}
                  onClick={() => void readHistory(history.next!)}
                >
                  More recovery history
                </button>
              )}
              <button disabled={busy} onClick={() => setHistory(null)}>
                Close recovery history
              </button>
            </section>
          )}
          {validation && (
            <section aria-label="Review BEA candidates">
              <h3>Review candidates</h3>
              <p>
                {validation.outcome}: {validation.message}
              </p>
              <p>
                Parser {validation.parser} · validated {validation.validatedAt}{' '}
                · original hash {validation.hash}
              </p>
              {validation.candidates.map((c) => (
                <details key={c.item.id}>
                  <summary>{c.item.title}</summary>
                  <p>
                    Current baseline:{' '}
                    {c.baseline
                      ? `edition ${c.baseline.version} · ${c.baseline.status}`
                      : 'No stored edition'}
                  </p>
                  <p>Prior title: {c.baseline?.title ?? 'Not present'}</p>
                  <p>
                    Candidate: {c.item.title} · published {c.item.publishedAt} ·
                    retrieved {c.item.source.retrievedAt}
                  </p>
                  <pre
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {JSON.stringify(
                      { before: c.baseline, after: c.item },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
              <button
                disabled={
                  busy || !!pending || validation.outcome !== 'accepted'
                }
                onClick={() =>
                  void act({
                    kind: 'stage',
                    path: '/ops/discovery/bea-staging',
                    body: {
                      requestId: crypto.randomUUID(),
                      validationId: validation.requestId,
                      fingerprint: validation.fingerprint,
                    },
                  })
                }
              >
                Stage reviewed drafts
              </button>
              <button disabled={busy} onClick={() => setValidation(null)}>
                Cancel candidate review
              </button>
            </section>
          )}
        </>
      )}
    </section>
  );
}
