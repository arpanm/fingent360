import { useState } from 'react';
import { PrivateAiHistorySchema } from '@fingent360/contracts';
import { json } from './net';
import { saveDownload } from './runtime';
export function PrivateAiHistory() {
  const [state, setState] = useState<ReturnType<
      typeof PrivateAiHistorySchema.parse
    > | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load(remove = false) {
    setBusy(true);
    setError('');
    try {
      setState(
        PrivateAiHistorySchema.parse(
          await json(
            '/account/ai-history',
            undefined,
            remove ? 'DELETE' : 'GET',
          ),
        ),
      );
      if (remove) setNotice('Saved request history deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError('');
    try {
      const fresh = PrivateAiHistorySchema.parse(
        await json('/account/ai-history'),
      );
      setState(fresh);
      setNotice(
        await saveDownload(
          new Blob([JSON.stringify(fresh, null, 2)], {
            type: 'application/json',
          }),
          'my-ai-history.json',
          'Private history downloaded.',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="My AI request history">
      <h3>My AI request history</h3>
      <p>
        Optional: keep up to 50 provider requests and answers for seven days.
        Only your account can read them. Enable My private AI request history in
        Purpose consent. Permission to share private context is separate. Query
        help works without either option. Server-stored request text is
        encrypted with server-managed keys. Downloads contain readable private
        text; store them carefully. This does not encrypt other account data or
        device files.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Load my AI history
      </button>
      {busy && <p role="status">Updating private history…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state && (
        <>
          <p>
            {state.enabled ? 'History enabled' : 'History not enabled'} ·{' '}
            {state.entries.length} retained requests
          </p>
          <button
            disabled={busy || !state.entries.length}
            onClick={() => void load(true)}
          >
            Delete my AI history
          </button>
          <button disabled={busy} onClick={() => void download()}>
            Download my AI history
          </button>
          {state.entries.map((row) => (
            <details key={row.id}>
              <summary>
                {row.provider} · {new Date(row.createdAt).toLocaleString()} ·{' '}
                {row.status}
              </summary>
              <p>
                Expires {new Date(row.expiresAt).toLocaleString()};{' '}
                {row.outcome}
              </p>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(row, null, 2)}
              </pre>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
