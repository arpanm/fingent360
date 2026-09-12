import { useEffect, useState } from 'react';
import { AlertPreferences } from './AlertPreferences';
import {
  InboxSchema,
  type InboxItem,
  AccountActionSchema,
  CurrentAccountSchema,
  MacroDashboardSchema,
  WatchlistSchema,
  type Account as UserAccount,
  type MacroDashboard,
  type MacroIndicator,
} from '@fingent360/contracts';
async function api(
  path = '',
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<unknown> {
  const response = await fetch(`/api/v1/account${path}`, {
    method,
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(20000),
  });
  const payload: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Account request failed.',
    );
  return payload;
}
export function Account() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [selection, setSelection] = useState<MacroIndicator[]>([]);
  const [saved, setSaved] = useState<MacroIndicator[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [macro, setMacro] = useState<MacroDashboard | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  async function load(active: () => boolean = () => true) {
    const current = CurrentAccountSchema.parse(await api());
    if (!active()) return;
    setUser(current.user);
    setLoaded(true);
    if (current.user) {
      const list = WatchlistSchema.parse(await api('/watchlist'));
      if (!active()) return;
      setSelection(list.indicators);
      setSaved(list.indicators);
      const messages = InboxSchema.parse(await api('/inbox'));
      if (!active()) return;
      setInbox(messages.items);
      const response = await fetch('/api/v1/macro', {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          'Your account is loaded, but macro data is unavailable. Retry shortly.',
        );
      const dashboard = MacroDashboardSchema.parse(await response.json());
      if (active()) setMacro(dashboard);
    } else {
      setSelection([]);
      setSaved([]);
      setMacro(null);
      setInbox([]);
    }
  }
  useEffect(() => {
    let active = true;
    void load(() => active).catch((error: unknown) => {
      if (active) {
        setError(
          error instanceof Error ? error.message : 'Account unavailable',
        );
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account" aria-labelledby="account-title">
      <h2 id="account-title">Your account and watchlist</h2>
      <p>
        Save the real economic indicators you follow. Your selections belong to
        your signed-in account and persist across sessions.
      </p>
      <p aria-live="polite">{busy ? 'Working…' : message}</p>
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void action(load)}>
            Reload account
          </button>
        </div>
      )}
      {!loaded && <p>Checking your session…</p>}
      {loaded && !user && (
        <div className="card">
          <h3>{signup ? 'Create an account' : 'Sign in'}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                const result = CurrentAccountSchema.parse(
                  await api(signup ? '/register' : '/login', {
                    username,
                    password,
                    ...(signup ? { consent } : {}),
                  }),
                );
                setUser(result.user);
                setPassword('');
                await load();
                setMessage(signup ? 'Account created.' : 'Signed in.');
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>Account credentials</legend>
              <label>
                Username
                <input
                  autoComplete="username"
                  value={username}
                  minLength={3}
                  maxLength={32}
                  required
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  value={password}
                  minLength={12}
                  maxLength={128}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p>
                Usernames use 3–32 letters, digits, underscores or hyphens,
                starting with a letter. Passwords need 12–128 characters.
              </p>
              {signup && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    required
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  I agree to store my username, password hash, sessions,
                  watchlist, inbox preferences and observation acknowledgments
                  on this server until I delete my account. Consent version:
                  account-storage-v1.
                </label>
              )}
              <button type="submit">
                {signup ? 'Create account' : 'Sign in'}
              </button>
            </fieldset>
          </form>
          <button
            className="secondary"
            onClick={() => {
              setSignup(!signup);
              setError('');
              setPassword('');
            }}
          >
            {signup ? 'Use an existing account' : 'Create a new account'}
          </button>
          <p>
            No email is collected. Password recovery is not available in this
            local version.
          </p>
        </div>
      )}
      {user && (
        <>
          <div className="card">
            <h3>Signed in as {user.username}</h3>
            <p>
              Storage consent: {user.consentVersion}. Account created:{' '}
              {user.createdAt.slice(0, 10)}.
            </p>
            <button
              disabled={busy}
              className="secondary"
              onClick={() =>
                void action(async () => {
                  AccountActionSchema.parse(await api('/logout', {}));
                  setUser(null);
                  setSelection([]);
                  setSaved([]);
                  setMacro(null);
                  setInbox([]);
                  setSignup(false);
                  setMessage('Signed out.');
                })
              }
            >
              Sign out
            </button>
          </div>
          <fieldset disabled={busy || !macro}>
            <legend>Indicators to follow</legend>
            {macro?.sources.map((source) => (
              <label key={source.indicator} className="check-label">
                <input
                  type="checkbox"
                  checked={selection.includes(source.indicator)}
                  onChange={(event) =>
                    setSelection(
                      event.target.checked
                        ? [...selection, source.indicator]
                        : selection.filter((key) => key !== source.indicator),
                    )
                  }
                />
                {source.title}
              </label>
            ))}
            <button
              onClick={() =>
                void action(async () => {
                  const result = WatchlistSchema.parse(
                    await api('/watchlist', { indicators: selection }, 'PUT'),
                  );
                  setSaved(result.indicators);
                  setSelection(result.indicators);
                  setInbox(InboxSchema.parse(await api('/inbox')).items);
                  setMessage('Watchlist saved.');
                })
              }
            >
              Save watchlist
            </button>
          </fieldset>
          <section aria-label="Saved watchlist">
            <h3>Your saved indicators</h3>
            {saved.length === 0 && <p>No indicators selected yet.</p>}
            {macro?.sources
              .filter((source) => saved.includes(source.indicator))
              .map((source) => {
                const latest = source.observations.find(
                  (value) => value.value !== null,
                );
                return (
                  <article className="card" key={source.indicator}>
                    <h4>{source.title}</h4>
                    <p>
                      {latest
                        ? `${latest.value}% · annual observation for ${latest.year}`
                        : 'No reported values stored. An operator can refresh this source from Real economic data.'}
                    </p>
                    <p>{source.explanation}</p>
                    <p>
                      Last source check: {source.lastSuccessAt ?? 'Never'}.{' '}
                      {source.freshness === 'refresh_due' ? 'Refresh due.' : ''}
                    </p>
                    {source.latestRun?.status === 'failed' && (
                      <p>
                        Latest refresh failed; these are previously accepted
                        data.
                      </p>
                    )}
                    <a href="#macro">View source evidence and history</a>
                  </article>
                );
              })}
          </section>
          <AlertPreferences
            key={saved.join(',')}
            onChanged={async () =>
              setInbox(InboxSchema.parse(await api('/inbox')).items)
            }
          />
          <section aria-label="Observation inbox">
            <h3>Observation inbox</h3>
            <p>
              Latest reported values for followed indicators, not a
              breaking-news feed. A changed observation revision requires a new
              acknowledgment.
            </p>
            {inbox.length === 0 && (
              <p>No observations available for your followed indicators.</p>
            )}
            {inbox.map((item) => (
              <article className="card" key={item.observationId}>
                <h4>
                  {macro?.sources.find((s) => s.indicator === item.indicator)
                    ?.title ?? item.indicator}
                </h4>
                <p>
                  {item.kind === 'correction'
                    ? 'Revised observation'
                    : 'Reported observation'}{' '}
                  · {item.year} · revision {item.revision}
                </p>
                <p>
                  {item.value === null
                    ? 'Value withdrawn / unavailable'
                    : `${item.value}%`}{' '}
                  · {item.read ? 'Acknowledged' : 'Unread'}
                </p>
                <p>
                  Retrieved: {item.retrievedAt}. Check the source status above
                  for freshness.
                </p>
                <a href="#macro">Review source and revision history</a>
                <br />
                <button
                  disabled={busy || item.read}
                  onClick={() =>
                    void action(async () => {
                      AccountActionSchema.parse(
                        await api('/inbox/acknowledge', {
                          observationId: item.observationId,
                        }),
                      );
                      setInbox(InboxSchema.parse(await api('/inbox')).items);
                      setMessage('Observation acknowledged.');
                    })
                  }
                >
                  Acknowledge observation
                </button>
              </article>
            ))}
          </section>
          <details className="card">
            <summary>Delete your account</summary>
            <p>
              Deletion removes your account, sessions, watchlist, inbox
              preferences, saved goals, holdings, their revisions and
              observation acknowledgments. Public source data and the separate
              virtual exercise are unaffected.
            </p>
            <label>
              Confirm current password
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
            <button
              disabled={busy || deletePassword.length < 12}
              onClick={() =>
                void action(async () => {
                  AccountActionSchema.parse(
                    await api('', { password: deletePassword }, 'DELETE'),
                  );
                  setDeletePassword('');
                  setUser(null);
                  setSelection([]);
                  setSaved([]);
                  setMacro(null);
                  setInbox([]);
                  setSignup(false);
                  setMessage('Account and private watchlist deleted.');
                })
              }
            >
              Permanently delete account
            </button>
          </details>
        </>
      )}
    </section>
  );
}
