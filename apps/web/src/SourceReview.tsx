import { useEffect, useRef, useState } from 'react';
import {
  DiscoveryOperationsSchema,
  SourceReviewComparisonSchema,
  DiscoveryEvidenceSchema,
  FeedItemSchema,
  type SourceReviewComparison,
} from '@fingent360/contracts';
import { Dialog } from './Dialog';
import { json, RequestError } from './net';
export function SourceReview({
  id,
  version,
  request,
  onClose,
  onDenied,
  onSaved,
}: {
  id: string;
  version: number;
  request: typeof json;
  onClose: () => void;
  onDenied: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<SourceReviewComparison | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(''),
    [evidence, setEvidence] = useState<string | null>(null),
    [receipt, setReceipt] = useState('');
  const live = useRef(false),
    generation = useRef(0),
    denied = useRef(false),
    controller = useRef<AbortController | null>(null);
  function failure(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && e.status === 401) {
      denied.current = true;
      generation.current++;
      setData(null);
      setEvidence(null);
      setNote('');
      setReceipt('');
      onDenied();
      return;
    }
    if (live.current)
      setError(
        e instanceof Error ? e.message : 'Review unavailable. Retry loading.',
      );
  }
  async function load(fresh = false) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const ticket = ++generation.current;
    setBusy(true);
    setData(null);
    setEvidence(null);
    setError('');
    try {
      let expected = version;
      if (fresh) {
        const items = DiscoveryOperationsSchema.parse(
          await request('/ops/discovery/items', undefined, 'GET', c.signal),
        );
        const head = items.items.find((i) => i.id === id);
        if (!head) throw Error('Item no longer exists.');
        expected = head.version;
      }
      const result = SourceReviewComparisonSchema.parse(
        await request(
          `/ops/discovery/items/${id}/comparison?expectedVersion=${expected}`,
          undefined,
          'GET',
          c.signal,
        ),
      );
      if (result.head.id !== id || result.head.version !== expected)
        throw Error('The review does not match the requested head. Reload.');
      if (live.current && !denied.current && ticket === generation.current)
        setData(result);
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) failure(e);
      else if (ticket === generation.current) failure(e);
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
      controller.current?.abort();
    };
  }, []);
  async function inspect(v: number) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = DiscoveryEvidenceSchema.parse(
        await request(`/ops/discovery/items/${id}/evidence?version=${v}`),
      );
      if (live.current && !denied.current && ticket === generation.current)
        setEvidence(result.body);
    } catch (e) {
      failure(e);
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  async function publish(status: 'published' | 'withdrawn') {
    if (!data) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = FeedItemSchema.parse(
        await request(
          `/ops/discovery/items/${id}`,
          { expectedVersion: data.head.version, status, correctionNote: note },
          'PUT',
        ),
      );
      if (live.current && !denied.current && ticket === generation.current) {
        setData(null);
        setReceipt(`Saved ${result.status} edition ${result.version}.`);
        onSaved();
      }
    } catch (e) {
      if (live.current) setData(null);
      failure(e);
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  return (
    <Dialog title="Review publication" onClose={onClose}>
      <section data-feedback-private>
        {busy && <p role="status">Loading protected review…</p>}
        {error && <p role="alert">{error}</p>}
        {receipt && (
          <p role="status">
            {receipt} This is the saved result, not a fresh head check.
          </p>
        )}
        {!busy && !data && !receipt && (
          <button onClick={() => void load(true)}>Reload current review</button>
        )}
        {evidence !== null ? (
          <>
            <h3>Retained evidence</h3>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {evidence}
            </pre>
            <button onClick={() => setEvidence(null)}>
              Back to comparison
            </button>
          </>
        ) : (
          data && (
            <>
              <h3>{data.head.title}</h3>
              <p>
                Current head: edition {data.head.version} · {data.head.status}.
                Checked {data.checkedAt}.
              </p>
              <p>
                {data.previous
                  ? `Prior public-state edition: ${data.previous.version} · ${data.previous.status}. This is the nearest earlier published or withdrawn state, not necessarily a published article.`
                  : 'No prior public-state edition. This is a first publication review.'}
              </p>
              <p>
                Retained withdrawn originals are protected operator records. No
                market impact is inferred.
              </p>
              {data.differences.map((d) => (
                <details key={d.field} open={d.changed}>
                  <summary>
                    {d.field} · {d.changed ? 'Changed' : 'Unchanged'}
                  </summary>
                  <dl>
                    <dt>Prior public state</dt>
                    <dd
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {d.before ?? 'Not present'}
                    </dd>
                    <dt>Current head</dt>
                    <dd
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {d.after}
                    </dd>
                  </dl>
                </details>
              ))}
              <div className="page-actions">
                <button
                  disabled={busy}
                  onClick={() => void inspect(data.head.version)}
                >
                  Current retained evidence
                </button>
                {data.previous && (
                  <button
                    disabled={busy}
                    onClick={() => void inspect(data.previous!.version)}
                  >
                    Prior retained evidence
                  </button>
                )}
              </div>
              <label htmlFor="source-review-note">Review note</label>
              <textarea
                id="source-review-note"
                maxLength={2000}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="page-actions">
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => void publish('published')}
                >
                  Publish reviewed edition
                </button>
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => void publish('withdrawn')}
                >
                  Withdraw item
                </button>
              </div>
            </>
          )
        )}
      </section>
    </Dialog>
  );
}
