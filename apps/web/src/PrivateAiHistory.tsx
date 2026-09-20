import { useEffect, useRef, useState } from 'react';
import { PrivateAiHistorySchema } from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
export function PrivateAiHistory() {
  const [state, setState] = useState<ReturnType<
      typeof PrivateAiHistorySchema.parse
    > | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loadedAt, setLoadedAt] = useState('');
  const live = useRef(false),
    generation = useRef(0),
    denied = useRef(false);
  function clearPrivate(message: string) {
    generation.current++;
    denied.current = true;
    setState(null);
    setLoadedAt('');
    setNotice('');
    setBusy(false);
    setError(message);
  }
  useEffect(() => {
    live.current = true;
    const changed = () =>
      clearPrivate(
        'Your session changed. Reload this privacy page before accessing history.',
      );
    window.addEventListener('f360-session-changed', changed);
    return () => {
      live.current = false;
      generation.current++;
      window.removeEventListener('f360-session-changed', changed);
    };
  }, []);
  const current = (ticket: number) =>
    live.current && !denied.current && generation.current === ticket;
  function fail(cause: unknown, ticket: number, fallback: string) {
    if (!live.current) return;
    // Any live authentication denial invalidates retained private data, even
    // if an older request delivered it after another request superseded it.
    if (cause instanceof RequestError && cause.status === 401)
      clearPrivate(
        'Please sign in to continue. Reload this privacy page after signing in.',
      );
    else if (current(ticket))
      setError(cause instanceof Error ? cause.message : fallback);
  }
  async function load(remove = false) {
    if (!live.current || denied.current) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const fresh = PrivateAiHistorySchema.parse(
        await json('/account/ai-history', undefined, remove ? 'DELETE' : 'GET'),
      );
      if (!current(ticket)) return;
      setState(fresh);
      setLoadedAt(new Date().toLocaleString());
      if (remove) setNotice('Saved request history deleted.');
    } catch (e) {
      fail(e, ticket, 'History unavailable.');
    } finally {
      if (current(ticket)) setBusy(false);
    }
  }
  async function download() {
    if (!live.current || denied.current) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const fresh = PrivateAiHistorySchema.parse(
        await json('/account/ai-history'),
      );
      if (!current(ticket)) return;
      setState(fresh);
      setLoadedAt(new Date().toLocaleString());
      const message = await saveDownload(
        new Blob([JSON.stringify(fresh, null, 2)], {
          type: 'application/json',
        }),
        'my-ai-history.json',
        'Private history downloaded.',
      );
      if (current(ticket)) setNotice(message);
    } catch (e) {
      fail(e, ticket, 'Export unavailable.');
    } finally {
      if (current(ticket)) setBusy(false);
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
      <button disabled={busy || denied.current} onClick={() => void load()}>
        Load my AI history
      </button>
      {denied.current && (
        <button onClick={() => window.location.reload()}>
          Reload privacy page
        </button>
      )}
      {busy && <p role="status">Updating private history…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state && loadedAt && (
        <p>
          Last loaded {loadedAt}.{' '}
          {error && 'Showing the last successful snapshot.'}
        </p>
      )}
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
