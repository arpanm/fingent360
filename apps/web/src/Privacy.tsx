import { useEffect, useState } from 'react';
import {
  CurrentAccountSchema,
  PrivacyExportSchema,
  SessionsSchema,
  RevocationSchema,
  type PrivacySession,
} from '@fingent360/contracts';
async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/v1/account${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(20000),
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data === 'object' && data && 'message' in data
        ? String(data.message)
        : 'Privacy request failed.',
    );
  return data;
}
export function Privacy() {
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState<PrivacySession[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    const account = CurrentAccountSchema.parse(await api(''));
    setSignedIn(Boolean(account.user));
    setSessions(
      account.user
        ? SessionsSchema.parse(await api('/privacy/sessions')).sessions
        : [],
    );
    setLoaded(true);
  }
  useEffect(() => {
    void load().catch((error: unknown) => {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to load privacy settings.',
      );
      setLoaded(true);
    });
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Privacy request failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Privacy and sessions</h2>
      <p>
        Download your saved account data and end access from other sessions.
      </p>
      {error && <div role="alert">{error}</div>}
      <p role="status">{busy ? 'Working…' : message}</p>
      {!loaded && <p>Checking your session…</p>}
      {loaded && !signedIn && (
        <p>
          <a href="#account">Sign in to manage your privacy</a>
        </p>
      )}
      <button
        disabled={busy}
        className="secondary"
        onClick={() => void action(load)}
      >
        Refresh privacy settings
      </button>
      {signedIn && (
        <>
          <section className="card" aria-label="Account export">
            <h3>Download your account data</h3>
            <p>
              The JSON file includes your account, watchlist, acknowledgment
              history, alert preferences, goals, holdings history/import
              previews and safe session details. It excludes passwords, session
              credentials and the separate virtual exercise. Keep downloaded
              personal data somewhere private.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const exported = PrivacyExportSchema.parse(
                    await api('/privacy/export'),
                  );
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(exported, null, 2)], {
                      type: 'application/json',
                    }),
                  );
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'fingent360-account.json';
                  document.body.append(link);
                  link.click();
                  link.remove();
                  // Delay revocation until the browser has begun consuming the download.
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setMessage('Account export downloaded.');
                })
              }
            >
              Download account JSON
            </button>
          </section>
          <section className="card" aria-label="Active sessions">
            <h3>Active sessions</h3>
            <p>
              Sessions expire after seven days. Identifiers below are not
              sign-in credentials. Device names and location are not collected.
            </p>
            <button
              disabled={busy || !sessions.some((session) => !session.current)}
              onClick={() =>
                void action(async () => {
                  const result = RevocationSchema.parse(
                    await api('/privacy/sessions/revoke-others', {}),
                  );
                  await load();
                  setMessage(`${result.revoked} other sessions ended.`);
                })
              }
            >
              End all other sessions
            </button>
            {sessions.map((session) => (
              <article key={session.id}>
                <h4>
                  {session.current
                    ? 'This session'
                    : `Other session ${session.id.slice(0, 8)}`}
                </h4>
                <p>
                  Started {new Date(session.createdAt).toLocaleString()}.
                  Expires {new Date(session.expiresAt).toLocaleString()}.
                </p>
                {!session.current && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        RevocationSchema.parse(
                          await api('/privacy/sessions/revoke', {
                            sessionId: session.id,
                          }),
                        );
                        await load();
                        setMessage('Other session ended.');
                      })
                    }
                  >
                    End session {session.id.slice(0, 8)}
                  </button>
                )}
              </article>
            ))}
            <a href="#account">
              Sign out of this session or delete your account
            </a>
          </section>
        </>
      )}
    </section>
  );
}
