import { useEffect, useState } from 'react';
import {
  RecoveryCreatedSchema,
  RecoveryStatusSchema,
  RecoveryResultSchema,
} from '@fingent360/contracts';
import { json } from './net';
import { runtime, saveDownload } from './runtime';
import './recovery.css';
import { useDraftGuard } from './useDraftGuard';
import { announceSessionChange } from './session';
export function RecoverySettings() {
  const [authenticator, setAuthenticator] = useState('');
  const [status, setStatus] = useState<ReturnType<
      typeof RecoveryStatusSchema.parse
    > | null>(null),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(false),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [retry, setRetry] = useState(0);
  useDraftGuard(
    !!code,
    'Have you saved your recovery code privately? Leaving hides the only displayed copy.',
  );
  useEffect(() => {
    let active = true;
    void json('/account/recovery')
      .then((v) => {
        if (active) setStatus(RecoveryStatusSchema.parse(v));
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Recovery settings unavailable.',
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="card recovery-settings" aria-label="Recovery code">
      <h3>Keep a way back into your account</h3>
      <p>
        A recovery code can reset a forgotten password. Keep it somewhere
        private, separately from your password. It cannot restore deleted device
        storage.
      </p>
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            className="text-link"
            onClick={() => {
              setError('');
              setRetry((n) => n + 1);
            }}
          >
            Reload recovery settings
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {status && (
        <p>
          {status.configured
            ? 'A recovery code is configured. Creating another immediately invalidates the old one.'
            : 'No active recovery code. Create one while you can sign in.'}
        </p>
      )}
      {code ? (
        <div className="recovery-secret">
          <p>
            <strong>This code is shown only now.</strong> Save it privately
            before closing this page.
          </p>
          <output aria-label="Your new recovery code" data-feedback-private>
            {code}
          </output>
          <div className="page-actions">
            <button
              onClick={() =>
                void saveDownload(
                  new Blob(
                    [
                      `Fingent360 recovery code\n${code}\nKeep private. Applies only to this ${runtime.mode === 'offline' ? 'device account' : 'server account'}.\n`,
                    ],
                    { type: 'text/plain' },
                  ),
                  'fingent360-recovery-code.txt',
                  'Recovery code saved.',
                )
                  .then(setMessage)
                  .catch(() =>
                    setError(
                      'Could not save the code. Copy it manually before closing.',
                    ),
                  )
              }
            >
              Save recovery code
            </button>
            <button
              className="secondary"
              onClick={() => {
                setCode('');
                setMessage(
                  'Code hidden. Your private saved copy is the only way to use it.',
                );
              }}
            >
              I saved my recovery code
            </button>
          </div>
        </div>
      ) : (
        <details>
          <summary>
            {status?.configured
              ? 'Rotate recovery code'
              : 'Create a recovery code'}
          </summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              setMessage('');
              try {
                const result = RecoveryCreatedSchema.parse(
                  await json(
                    '/account/recovery/code',
                    {
                      currentPassword: password,
                      confirm,
                      ...(authenticator
                        ? { authenticatorCode: authenticator }
                        : {}),
                    },
                    'POST',
                  ),
                );
                setCode(result.code);
                setStatus({ configured: true, createdAt: result.createdAt });
                setPassword('');
                setAuthenticator('');
                setConfirm(false);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Recovery code could not be created.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy || !status}>
              <p>
                Recovery resets your password, authenticator and all sessions.
                Keep the saved code private and offline.
              </p>
              {runtime.mode !== 'offline' && (
                <label>
                  Authenticator code for recovery (if enabled)
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={authenticator}
                    onChange={(event) => setAuthenticator(event.target.value)}
                  />
                </label>
              )}
              <label>
                Current password for recovery
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                I will save this code privately. Any earlier recovery code will
                stop working.
              </label>
              <button disabled={!confirm || !password}>
                {busy ? 'Creating code…' : 'Generate recovery code'}
              </button>
            </fieldset>
          </form>
        </details>
      )}
    </section>
  );
}
export function Recovery() {
  const [username, setUsername] = useState(''),
    [code, setCode] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [complete, setComplete] = useState(false);
  return (
    <section className="recovery-page">
      <header className="page-header">
        <p className="page-kicker">ACCOUNT ACCESS</p>
        <h1>Reset your password</h1>
        <p className="page-description">
          Use the recovery code you previously saved for this{' '}
          {runtime.mode === 'offline' ? 'device account' : 'server account'}. We
          do not send recovery emails.
        </p>
      </header>
      {complete ? (
        <div className="panel">
          <h2>Password reset</h2>
          <p>
            All sessions for this account have ended and any server
            authenticator was disabled. Your saved data is still there. Sign in
            with the new password, then create a new recovery code.
          </p>
          <a className="button" href="#account">
            Sign in with new password
          </a>
        </div>
      ) : (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setError('');
            if (password !== confirmation) {
              setError('New passwords do not match.');
              return;
            }
            setBusy(true);
            try {
              RecoveryResultSchema.parse(
                await json(
                  '/account/recovery/reset',
                  { username, code, newPassword: password },
                  'POST',
                ),
              );
              setCode('');
              setPassword('');
              setConfirmation('');
              setComplete(true);
              announceSessionChange();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'Recovery could not be completed.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Account username
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Saved recovery code
              <textarea
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                required
                maxLength={100}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button>{busy ? 'Resetting password…' : 'Reset password'}</button>
          </fieldset>
        </form>
      )}
      <p>
        If you did not save a recovery code, this flow cannot recover the
        account. A local code does not unlock an online account or restore
        erased app data.
      </p>
      <a href="#account">Back to sign in</a>
    </section>
  );
}
