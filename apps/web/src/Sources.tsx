import { useEffect, useState } from 'react';
import {
  SourceInputSchema,
  SourceListSchema,
  SourceRecordSchema,
  type SourceInput,
  type SourceRecord,
} from '@fingent360/contracts';
const empty: SourceInput = {
  name: '',
  category: '',
  sourceUrl: '',
  termsUrl: '',
  rightsStatus: 'unreviewed',
  constraints: '',
  reviewEvidence: '',
  reviewedAt: null,
  published: false,
};
async function request(path: string, key = '', data?: unknown, method = 'GET') {
  const response = await fetch(`/api/v1/sources${path}`, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body && 'message' in body
        ? String(body.message)
        : 'Source request failed.',
    );
  return body;
}
export function Sources() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [key, setKey] = useState('');
  const [operator, setOperator] = useState(false);
  const [form, setForm] = useState<SourceInput>(empty);
  const [editing, setEditing] = useState<SourceRecord | null>(null);
  const [history, setHistory] = useState<SourceRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void request('')
      .then((body) => {
        if (active) setSources(SourceListSchema.parse(body));
      })
      .catch(() => {
        if (active) setError('Source registry unavailable.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Source operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload(asOperator: boolean) {
    setSources(
      SourceListSchema.parse(
        await request(asOperator ? '/operator' : '', asOperator ? key : ''),
      ),
    );
  }
  return (
    <section className="macro" aria-labelledby="sources-title">
      <h2 id="sources-title">Source registry</h2>
      <p>
        Published metadata describes operator-reviewed source rights and
        constraints. Approval here does not activate an adapter or establish
        production readiness. No provider data is fetched by this registry.
      </p>
      <details className="card">
        <summary>Source registry operator controls</summary>
        <label>
          Registry operator key
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </label>
        <button
          disabled={busy || !key}
          onClick={() =>
            void action(async () => {
              await reload(true);
              setOperator(true);
            })
          }
        >
          Load operator registry
        </button>
        <button
          disabled={busy}
          className="secondary"
          onClick={() =>
            void action(async () => {
              setKey('');
              setOperator(false);
              setEditing(null);
              setHistory([]);
              setForm(empty);
              setSources([]);
              await reload(false);
            })
          }
        >
          Forget registry key
        </button>
        <p>
          The key stays in page memory. Review evidence must contain no secrets
          or personal data; approved published metadata is public.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? 'Working…' : notice}</p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void action(() => reload(operator))}
      >
        Reload registry
      </button>
      {operator && (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              const parsed = SourceInputSchema.safeParse(form);
              if (!parsed.success)
                throw new Error(
                  parsed.error.issues.map((issue) => issue.message).join(' '),
                );
              const saved = SourceRecordSchema.parse(
                await request(
                  editing ? `/${editing.id}` : '',
                  key,
                  editing
                    ? { expectedRevision: editing.revision, data: parsed.data }
                    : parsed.data,
                  editing ? 'PUT' : 'POST',
                ),
              );
              setEditing(saved);
              setForm(saved.data);
              await reload(true);
              setNotice(`Saved source revision ${saved.revision}.`);
            });
          }}
        >
          <h3>
            {editing
              ? `Edit source revision ${editing.revision}`
              : 'Add source metadata'}
          </h3>
          {(
            [
              'name',
              'category',
              'sourceUrl',
              'termsUrl',
              'constraints',
              'reviewEvidence',
            ] as const
          ).map((field) => (
            <label key={field}>
              {
                {
                  name: 'Source name',
                  category: 'Source category',
                  sourceUrl: 'Source URL',
                  termsUrl: 'Terms URL',
                  constraints: 'Usage constraints',
                  reviewEvidence: 'Review evidence',
                }[field]
              }
              <textarea
                required={field !== 'reviewEvidence'}
                value={form[field]}
                onChange={(event) =>
                  setForm({ ...form, [field]: event.target.value })
                }
              />
            </label>
          ))}
          <label>
            Rights status
            <select
              value={form.rightsStatus}
              onChange={(event) =>
                setForm({
                  ...form,
                  rightsStatus: event.target
                    .value as SourceInput['rightsStatus'],
                })
              }
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="restricted">Restricted</option>
              <option value="approved">Approved</option>
            </select>
          </label>
          <label>
            Review time (UTC ISO)
            <input
              placeholder="2026-09-12T12:00:00.000Z"
              value={form.reviewedAt ?? ''}
              onChange={(event) =>
                setForm({ ...form, reviewedAt: event.target.value || null })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) =>
                setForm({ ...form, published: event.target.checked })
              }
            />
            Publish approved metadata
          </label>
          <button disabled={busy}>Save source metadata</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setHistory([]);
            }}
          >
            New source
          </button>
        </form>
      )}
      {sources.length === 0 && (
        <p>No {operator ? 'registered' : 'approved published'} sources yet.</p>
      )}
      <div className="macro-grid">
        {sources.map((source) => (
          <article
            className="card"
            key={source.id}
            aria-label={source.data.name}
          >
            <h3>{source.data.name}</h3>
            <p>
              {source.data.category} · {source.data.rightsStatus} · revision{' '}
              {source.revision}
            </p>
            <p>{source.data.constraints}</p>
            <p>
              Review evidence: {source.data.reviewEvidence || 'Not reviewed'}
            </p>
            <p>
              Reviewed: {source.data.reviewedAt ?? 'Not reviewed'} · Recorded:{' '}
              {source.recordedAt}
            </p>
            <a href={source.data.sourceUrl} target="_blank" rel="noreferrer">
              Provider source
            </a>{' '}
            ·{' '}
            <a href={source.data.termsUrl} target="_blank" rel="noreferrer">
              Provider terms
            </a>
            {operator && (
              <>
                <p>{source.data.published ? 'Published' : 'Private draft'}</p>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(source);
                    setForm(source.data);
                    setHistory([]);
                  }}
                >
                  Edit {source.data.name}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () =>
                      setHistory(
                        SourceListSchema.parse(
                          await request(`/${source.id}/history`, key),
                        ),
                      ),
                    )
                  }
                >
                  History {source.data.name}
                </button>
              </>
            )}
          </article>
        ))}
      </div>
      {history.length > 0 && (
        <section className="card" aria-label="Source revision history">
          <h3>Source revision history</h3>
          {history.map((source) => (
            <div key={source.revision}>
              <h4>
                Revision {source.revision}: {source.data.name}
              </h4>
              <p>
                {source.recordedAt} · {source.data.rightsStatus} ·{' '}
                {source.data.published ? 'Published' : 'Private draft'}
              </p>
              <p>{source.data.constraints}</p>
              <p>{source.data.reviewEvidence}</p>
              <p>Reviewed: {source.data.reviewedAt ?? 'Not reviewed'}</p>
              <p>
                {source.data.sourceUrl} · {source.data.termsUrl} ·{' '}
                {source.data.category}
              </p>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
