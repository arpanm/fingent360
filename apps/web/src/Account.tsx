import { announceSessionChange } from './session';
import { useEffect, useState } from 'react';
import { AlertPreferences } from './AlertPreferences';
import { accountDestination } from './AccountGate';
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
  if (
    ['/register', '/login', '/logout'].includes(path) ||
    (path === '' && method === 'DELETE')
  ) {
    announceSessionChange();
  }
  return payload;
}
export function Account() {
  const next = accountDestination(window.location.hash);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signup, setSignup] = useState(
    () =>
      new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(
        'mode',
      ) === 'create',
  );
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
      <header className="page-header">
        <p className="page-kicker">Your workspace</p>
        <h1 id="account-title">
          {user
            ? 'Your account and watchlist'
            : 'A place for your financial plans'}
        </h1>
        <p className="page-description">
          {user
            ? 'Choose what to follow, review updates and manage your account.'
            : 'Save your goals, track your holdings and follow the economic changes that matter to you.'}
        </p>
        {user && (
          <div className="page-actions">
            <a href="#my-goals">My goals</a>
            <a href="#holdings">My holdings</a>
            <a href="#privacy">Privacy and sessions</a>
          </div>
        )}
      </header>
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
          <div
            className="segmented-control"
            role="group"
            aria-label="Account access"
          >
            <button
              type="button"
              aria-pressed={!signup}
              disabled={busy}
              onClick={() => {
                setSignup(false);
                setError('');
                setPassword('');
              }}
            >
              Use an existing account
            </button>
            <button
              type="button"
              aria-pressed={signup}
              disabled={busy}
              onClick={() => {
                setSignup(true);
                setError('');
                setPassword('');
              }}
            >
              Create a new account
            </button>
          </div>
          <h3>{signup ? 'Create an account' : 'Welcome back'}</h3>
          <p>
            {signup
              ? 'Start with a username and a password. Your saved information stays in your account.'
              : 'Sign in to pick up where you left off.'}
          </p>
          {next && (
            <p className="badge">
              Continue to{' '}
              {next === 'my-goals'
                ? 'your goals'
                : next === 'holdings'
                  ? 'your holdings'
                  : next}{' '}
              after signing in.
            </p>
          )}
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
                if (result.user && next) {
                  window.location.hash = next;
                  return;
                }
                await load();
                setMessage(signup ? 'Account created.' : 'Signed in.');
              });
            }}
          >
            <fieldset disabled={busy} className="form-grid">
              <legend>Account credentials</legend>
              <label className="field">
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
              <label className="field">
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
                  I agree to store my account details, watchlist, inbox
                  preferences and reading history until I delete my account.
                </label>
              )}
              <button type="submit">
                {signup ? 'Create account' : 'Sign in'}
              </button>
            </fieldset>
          </form>
          <details>
            <summary>What information is saved?</summary>
            <p>
              Your username, a protected password hash, sign-in sessions,
              watchlist, inbox preferences and read acknowledgments are stored
              on this server. Goals and holdings request separate storage
              consent when you save them. Consent version: account-storage-v1.
              You can download your information or delete your account from
              settings.
            </p>
          </details>
          <p>
            Keep your password somewhere safe. Password recovery is not yet
            available; no email address is required.
          </p>
        </div>
      )}
      {user && (
        <>
          <div className="card section-heading">
            <div>
              <h3>Signed in as {user.username}</h3>
              <p>
                Member since {new Date(user.createdAt).toLocaleDateString()}.
              </p>
            </div>
            <div className="page-actions">
              {next && (
                <a className="button-link" href={`#${next}`}>
                  Continue to {next === 'my-goals' ? 'your goals' : next}
                </a>
              )}
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
          </div>
          <div className="account-workspace-grid">
            <div>
              <section className="panel">
                <div className="section-heading">
                  <h3>Choose your watchlist</h3>
                  <p>
                    Follow an indicator to keep its latest update close at hand.
                  </p>
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
                              : selection.filter(
                                  (key) => key !== source.indicator,
                                ),
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
                          await api(
                            '/watchlist',
                            { indicators: selection },
                            'PUT',
                          ),
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
              </section>
              <section aria-label="Saved watchlist" className="panel">
                <h3>Your saved indicators</h3>
                {saved.length === 0 && (
                  <div className="empty-state">
                    <p>No indicators selected yet.</p>
                    <p>
                      Choose an indicator above and save your watchlist to start
                      following it.
                    </p>
                  </div>
                )}
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
                            ? `${Number(latest.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}% · annual observation for ${latest.year}`
                            : 'No figures are available yet. Check source details for the latest availability.'}
                        </p>
                        <p>{source.explanation}</p>
                        <p>
                          Last source check:{' '}
                          {source.lastSuccessAt
                            ? new Date(source.lastSuccessAt).toLocaleString()
                            : 'Not yet checked'}
                          .{' '}
                          {source.freshness === 'refresh_due'
                            ? 'Refresh due.'
                            : ''}
                        </p>
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
            </div>
            <section aria-label="Observation inbox" className="panel">
              <h3>Observation inbox</h3>
              <p>
                Review the latest updates to the indicators you follow. Mark
                each one as read when you have finished; revised figures will
                appear as new updates.
              </p>
              {inbox.length === 0 && (
                <div className="empty-state">
                  <p>No observations available for your followed indicators.</p>
                  <p>
                    Updates will appear here when new source data is available.
                    You can review current source information from the overview.
                  </p>
                  <a href="#overview">Explore the overview</a>
                </div>
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
                      : `${Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`}{' '}
                    · {item.read ? 'Acknowledged' : 'Unread'}
                  </p>
                  <p>
                    Retrieved: {new Date(item.retrievedAt).toLocaleString()}.
                    Check the source status for freshness.
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
          </div>
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
