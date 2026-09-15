import { useState } from 'react';
import { EvalListSchema, EvalDetailSchema } from '@fingent360/contracts';
import { json } from './net';
import { saveDownload } from './runtime';
export function EvaluationLineage({
  request = json,
  initialSource = '',
}: {
  request?: typeof json;
  initialSource?: string;
}) {
  const [source, setSource] = useState(initialSource),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [list, setList] = useState<ReturnType<
      typeof EvalListSchema.parse
    > | null>(null),
    [detail, setDetail] = useState<ReturnType<
      typeof EvalDetailSchema.parse
    > | null>(null);
  async function search(before?: string) {
    setBusy(true);
    setError('');
    setDetail(null);
    try {
      const params = new URLSearchParams();
      if (source) params.set('sourceId', source);
      if (before) params.set('before', before);
      setList(
        EvalListSchema.parse(await request('/ops/evaluations?' + params)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Evaluation index unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function inspect(id: string) {
    setBusy(true);
    setError('');
    setDetail(null);
    try {
      setDetail(
        EvalDetailSchema.parse(
          await request('/ops/evaluations/' + encodeURIComponent(id)),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const fresh = EvalDetailSchema.parse(
        await request(
          '/ops/evaluations/' + encodeURIComponent(detail.sourceId),
        ),
      );
      setDetail(fresh);
      setNotice(
        await saveDownload(
          new Blob([JSON.stringify(fresh, null, 2)], {
            type: 'application/json',
          }),
          'research-evaluation.json',
          'Evaluation downloaded.',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function evidence() {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const value = await request(
        '/ops/evaluations/' + encodeURIComponent(detail.sourceId) + '/evidence',
      );
      setNotice(
        await saveDownload(
          new Blob([JSON.stringify(value, null, 2)], {
            type: 'application/json',
          }),
          'source-evidence.json',
          'Retained evidence downloaded.',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evidence unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Research evaluation">
      <h3>Evidence, generation and feedback</h3>
      <p>
        Inspect retained public research and the feedback linked to it. Private
        assistance is excluded from this operator corpus.
      </p>
      <label>
        Source item ID
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Optional exact source ID"
        />
      </label>
      <button disabled={busy} onClick={() => void search()}>
        Find evaluation records
      </button>
      {source && (
        <button disabled={busy} onClick={() => void inspect(source)}>
          Open source trace
        </button>
      )}
      {busy && <p role="status">Loading evaluation records…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {list && (
        <>
          <p>
            {list.items.length
              ? 'Saved public views'
              : 'No captured public views yet. Open a published story first.'}
          </p>
          <ul>
            {list.items.map((v, i) => (
              <li key={v.sourceId + v.capturedAt + i}>
                <button
                  disabled={busy}
                  onClick={() => void inspect(v.sourceId)}
                >
                  {v.sourceId} · edition {v.sourceVersion}
                </button>
              </li>
            ))}
          </ul>
          {list.nextBefore && (
            <button
              disabled={busy}
              onClick={() => void search(list.nextBefore!)}
            >
              Older captures
            </button>
          )}
        </>
      )}
      {detail && (
        <article>
          <h4>{detail.sourceId}</h4>
          <p>{detail.note}</p>
          <button disabled={busy} onClick={() => void download()}>
            Download current evaluation JSON
          </button>
          <a href={`#read/${detail.sourceId}`}>Open source reading</a>
          <button disabled={busy} onClick={() => void evidence()}>
            Download retained source evidence
          </button>
          <h4>Provider calls</h4>
          {detail.traces.map((t) => (
            <details key={t.id}>
              <summary>
                {t.kind} · {t.provider} · {t.status} · {t.startedAt}
              </summary>
              <p>
                Source edition {t.sourceVersion}; model {t.model}; {t.outcome}
              </p>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(t, null, 2)}
              </pre>
            </details>
          ))}
          <h4>Exact public view payloads</h4>
          {detail.views.map((v) => (
            <details key={v.id}>
              <summary>
                Edition {v.sourceVersion} · {v.capturedAt}
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(v.payload, null, 2)}
              </pre>
            </details>
          ))}
          <h4>Composed public views</h4>
          {detail.compositions.map((v) => (
            <details key={v.id}>
              <summary>
                Edition {v.item.version} · {v.capturedAt}
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(v, null, 2)}
              </pre>
            </details>
          ))}
          <h4>Linked user feedback</h4>
          {detail.feedback.map((f) => (
            <details key={f.id}>
              <summary>
                {f.status} · {f.receivedAt}
              </summary>
              <p>{f.text}</p>
              <p>
                Client-reported {f.view.kind}, edition {f.view.item.version}.
                Receipt {f.id}.
              </p>
            </details>
          ))}
          <h4>Validated event extraction outcomes</h4>
          {detail.eventAttempts.map((a) => (
            <details key={a.requestId}>
              <summary>
                {a.outcome} · {a.requestId}
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(a, null, 2)}
              </pre>
            </details>
          ))}
          <h4>Image generation receipts</h4>
          {detail.imageAttempts.map((a) => (
            <p key={a.id}>
              {a.provider}/{a.model} · {a.status} · {a.id}
            </p>
          ))}
          <p>Raw source hashes: {detail.sourceHashes.join(', ') || 'None'}</p>
        </article>
      )}
    </section>
  );
}
