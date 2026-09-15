import { useState } from 'react';
import {
  AutoPublicationPoliciesSchema,
  AutoPublicationPolicySchema,
} from '@fingent360/contracts';
import { json } from './net';
export function ResearchAutoPublication({
  request = json,
}: {
  request?: typeof json;
}) {
  const [state, setState] = useState<ReturnType<
      typeof AutoPublicationPoliciesSchema.parse
    > | null>(null),
    [source, setSource] = useState('fed'),
    [enabled, setEnabled] = useState(true),
    [reviewed, setReviewed] = useState(false),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    setBusy(true);
    setError('');
    try {
      setState(
        AutoPublicationPoliciesSchema.parse(
          await request('/ops/research-auto/policies'),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Policies unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function propose() {
    setBusy(true);
    setError('');
    try {
      const current = state?.policies.find(
        (p) => p.sourceId === source && p.state === 'active',
      );
      const value = AutoPublicationPolicySchema.parse(
        await request(
          '/ops/research-auto/policies',
          {
            requestId: crypto.randomUUID(),
            sourceId: source,
            expectedVersion: current?.version ?? 0,
            enabled,
            rightsReviewed: reviewed,
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            note,
          },
          'POST',
        ),
      );
      setNotice(
        `Policy ${value.id} awaits approval. It covers existing and future eligible drafts for seven days.`,
      );
      setState(
        AutoPublicationPoliciesSchema.parse(
          await request('/ops/research-auto/policies'),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Policy could not be proposed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve(id: string) {
    setBusy(true);
    setError('');
    try {
      await request(
        '/ops/research-auto/policies/' + id + '/approve',
        {},
        'POST',
      );
      setState(
        AutoPublicationPoliciesSchema.parse(
          await request('/ops/research-auto/policies'),
        ),
      );
      setNotice('Policy approved. The next enabled source capture applies it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setBusy(false);
    }
  }
  const selected = state?.eligibleSources.find((s) => s.id === source);
  return (
    <section aria-label="Automatic news publication">
      <h3>Automatically add official stories</h3>
      <p>
        Approve a limited source policy once to publish eligible official news
        after capture, including existing source drafts. Other drafts still
        require individual review. No LLM-generated claims are automatically
        published. Policies expire, and changed rights or named operator
        permissions stop publication.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Load publication policies
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Updating publication policies…</p>}
      {state && (
        <>
          <label>
            Official source
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setReviewed(false);
              }}
            >
              {state.eligibleSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p>
              {selected.rights}{' '}
              <a href={selected.termsUrl} target="_blank" rel="noreferrer">
                Review source terms
              </a>
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable automatic publication under this policy
          </label>
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I reviewed the source rights and existing/future draft publication
            scope
          </label>
          <label>
            Review note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            disabled={busy || !reviewed || note.trim().length < 20}
            onClick={() => void propose()}
          >
            Propose seven-day policy
          </button>
          <p>
            Named mode requires another publisher to approve. Bootstrap mode
            uses the existing administrator approval flow. Pause source capture
            to stop future runs; an already started run may finish; propose a
            disabled policy to retire publication permission.
          </p>
          {state.policies.map((p) => (
            <article key={p.id}>
              <h4>
                {p.sourceId} · version {p.version}
              </h4>
              <p>
                {p.state} · {p.enabled ? 'enabled' : 'disabled'} · expires{' '}
                {new Date(p.expiresAt).toLocaleString()}
              </p>
              <p>{p.note}</p>
              {p.state === 'pending' && (
                <button disabled={busy} onClick={() => void approve(p.id)}>
                  Approve policy {p.id}
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
