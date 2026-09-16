import { useEffect, useState } from 'react';
import { MfaEnrollmentSchema, MfaStatusSchema } from '@fingent360/contracts';
import { runtime } from './runtime';
import { useDraftGuard } from './useDraftGuard';

export function MfaSettings() {
  const [status, setStatus] = useState<ReturnType<
    typeof MfaStatusSchema.parse
  > | null>(null);
  const [enrollment, setEnrollment] = useState<ReturnType<
    typeof MfaEnrollmentSchema.parse
  > | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useDraftGuard(
    !!enrollment,
    'Authenticator enrollment is not finished. Leaving hides this setup key.',
  );
  async function api(path = '', body?: unknown) {
    const response = await fetch(`/api/v1/account/mfa${path}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(20000),
    });
    const value: unknown = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        setEnrollment(null);
        setPassword('');
        setCode('');
      }
      throw Error(
        typeof value === 'object' && value && 'message' in value
          ? String(value.message)
          : 'Authenticator request failed. Retry.',
      );
    }
    return value;
  }
  useEffect(() => {
    if (runtime.mode === 'offline') return;
    let active = true;
    void api()
      .then((data) => {
        if (active) {
          setStatus(MfaStatusSchema.parse(data));
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load authenticator settings.',
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  async function change(action: 'setup' | 'confirm' | 'disable') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const value = await api(`/${action}`, {
        password,
        ...(action === 'setup' ? {} : { code }),
      });
      if (action === 'setup') setEnrollment(MfaEnrollmentSchema.parse(value));
      else {
        setStatus(MfaStatusSchema.parse(value));
        setEnrollment(null);
        setPassword('');
        setCode('');
        setMessage(
          action === 'confirm'
            ? 'Authenticator enabled. Other sessions were signed out. Wait for a new code before using it again.'
            : 'Authenticator disabled. Other sessions were signed out.',
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Change failed. Retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Authenticator security">
      <h3>Authenticator security</h3>
      {runtime.mode === 'offline' ? (
        <p>
          Connect to your server to protect a server account with an
          authenticator. Device-only data is not a server account.
        </p>
      ) : (
        <>
          <p>
            Use a six-digit code from your authenticator app at sign-in. First
            create and save a recovery code above: using it resets your
            password, authenticator and sessions.
          </p>
          {error && (
            <p role="alert">
              {error}{' '}
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Reload authenticator settings
              </button>
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {!status ? (
            <p>Loading authenticator settings…</p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void change(
                  enrollment ? 'confirm' : status.enabled ? 'disable' : 'setup',
                );
              }}
            >
              <p>
                {status.enabled
                  ? 'Authenticator is enabled.'
                  : 'Authenticator is not enabled.'}
              </p>
              <fieldset disabled={busy}>
                <legend>
                  {enrollment
                    ? 'Confirm authenticator'
                    : status.enabled
                      ? 'Disable authenticator'
                      : 'Set up authenticator'}
                </legend>
                <label>
                  Current password
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {enrollment && (
                  <>
                    <p>
                      In your authenticator, add a time-based account named
                      Fingent360 and enter this setup key. Keep it private.
                    </p>
                    <label>
                      Authenticator setup key
                      <input
                        readOnly
                        value={enrollment.secret}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    </label>
                    <p>
                      Setup expires{' '}
                      {new Date(enrollment.expiresAt).toLocaleTimeString()}.
                    </p>
                  </>
                )}
                {(enrollment || status.enabled) && (
                  <label>
                    Authenticator code
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  </label>
                )}
                <button>
                  {busy
                    ? 'Saving…'
                    : enrollment
                      ? 'Confirm authenticator'
                      : status.enabled
                        ? 'Disable authenticator'
                        : 'Set up authenticator'}
                </button>
                {enrollment && (
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollment(null);
                      setCode('');
                    }}
                  >
                    Cancel setup
                  </button>
                )}
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
