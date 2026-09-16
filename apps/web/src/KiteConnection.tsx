import { useEffect, useState } from 'react';
import {
  KiteConnectionStatusSchema,
  KiteStartResultSchema,
  KitePreviewResultSchema,
  KiteRevokedSchema,
  KiteExportSchema,
  type HoldingsPreview,
} from '@fingent360/contracts';
import { runtime, saveDownload } from './runtime';
import {
  brokerBridge,
  armBrokerReturn,
  clearBrokerReturn,
} from './broker-native';
async function api(path = '', body?: unknown) {
  const response = await fetch(
    '/api/v1/account/broker-connections/kite' + path,
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    },
  );
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Broker connection unavailable. Retry.',
    );
  return value;
}
export function KiteConnection({
  expectedVersion,
  disabled,
  onPreview,
}: {
  expectedVersion: number;
  disabled: boolean;
  onPreview: (preview: HoldingsPreview) => void;
}) {
  const [status, setStatus] = useState<ReturnType<
      typeof KiteConnectionStatusSchema.parse
    > | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [login, setLogin] = useState(''),
    [returned, setReturned] = useState<{
      state: string;
      requestToken: string;
    } | null>(null);
  const load = async () => {
    setStatus(KiteConnectionStatusSchema.parse(await api()));
  };
  useEffect(() => {
    if (runtime.mode === 'offline') return;
    let active = true;
    api()
      .then((value) => {
        if (active) setStatus(KiteConnectionStatusSchema.parse(value));
      })
      .catch(() => {
        if (active)
          setMessage('Broker connection status could not load. Retry status.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const receive = async () => {
      if (!brokerBridge()?.takeKiteCallback || runtime.mode === 'offline')
        return;
      try {
        const value = await brokerBridge()?.takeKiteCallback?.();
        if (
          active &&
          value &&
          /^[a-f0-9]{64}$/.test(value.state) &&
          /^[A-Za-z0-9_-]{8,256}$/.test(value.requestToken)
        )
          setReturned(value);
      } catch {
        if (active)
          setMessage(
            'Broker return could not be read. Start a new connection.',
          );
      }
    };
    void receive();
    window.addEventListener('f360-kite-ready', receive);
    window.addEventListener('focus', receive);
    window.addEventListener('f360-broker-ready', receive);
    return () => {
      active = false;
      window.removeEventListener('f360-kite-ready', receive);
      window.removeEventListener('focus', receive);
      window.removeEventListener('f360-broker-ready', receive);
      void clearBrokerReturn('kite').catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!returned) return;
    const timer = window.setTimeout(() => {
      setReturned(null);
      setMessage('Broker return expired. Prepare a new connection.');
    }, 600000);
    return () => window.clearTimeout(timer);
  }, [returned]);
  if (runtime.mode === 'offline')
    return (
      <section aria-label="Connect Zerodha">
        <h3>Connect Zerodha</h3>
        <p>
          Broker authorization needs connected mode and an activated server.
          Device-only mode keeps file imports available.
        </p>
      </section>
    );
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Broker request failed. Retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Connect Zerodha">
      <h3>Connect Zerodha</h3>
      <p>{status?.message || 'Load connection status to continue.'}</p>
      <p>
        State: {status?.state || 'loading'}
        {status?.expiresAt
          ? ` · Expires ${new Date(status.expiresAt).toLocaleString()}`
          : ''}
      </p>
      <button type="button" disabled={busy} onClick={() => void action(load)}>
        Refresh broker status
      </button>
      {status?.enabled && (
        <>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to connect my Zerodha account and store an encrypted
            holdings capture for this import. Confirmed records remain until I
            delete them.
          </label>
          <p>
            Authorize only on Zerodha’s site. Fingent360 never asks for your
            broker password or OTP. Our connector reads holdings; broker-issued
            API tokens can have broader permissions.
          </p>
          <button
            type="button"
            disabled={
              busy || disabled || !consent || status.state === 'connected'
            }
            onClick={() =>
              void action(async () => {
                const result = KiteStartResultSchema.parse(
                  await api('/start', { consent: true }),
                );
                const url = new URL(result.loginUrl);
                if (
                  url.origin !== 'https://kite.zerodha.com' ||
                  url.pathname !== '/connect/login'
                )
                  throw new Error(
                    'Unexpected broker authorization destination.',
                  );
                await armBrokerReturn('kite', url);
                setReturned(null);
                setLogin(url.href);
                await load();
              })
            }
          >
            Prepare Zerodha connection
          </button>
          {returned && (
            <p>
              Authorization returned to this device.{' '}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const value = returned;
                    setReturned(null);
                    await api('/complete', {
                      state: value.state,
                      request_token: value.requestToken,
                    });
                    setLogin('');
                    setMessage(
                      'Broker connected. Review holdings before saving.',
                    );
                    await load();
                  })
                }
              >
                Complete returned authorization
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReturned(null);
                  void clearBrokerReturn('kite').catch(() => {});
                }}
              >
                Discard returned authorization
              </button>
            </p>
          )}
          {login && (
            <p>
              <a href={login} target="_blank" rel="noreferrer">
                Continue on Zerodha
              </a>{' '}
              · Complete authorization, return here and refresh status.
            </p>
          )}
          <button
            type="button"
            disabled={
              busy || disabled || !consent || status.state !== 'connected'
            }
            onClick={() =>
              void action(async () => {
                const result = KitePreviewResultSchema.parse(
                  await api('/preview', {
                    expectedVersion,
                    storageConsent: true,
                  }),
                );
                onPreview(result.preview);
                setMessage(
                  result.capture.warning +
                    ' Review the changes below, then explicitly confirm.',
                );
                await load();
              })
            }
          >
            Fetch and review broker holdings
          </button>
          <button
            type="button"
            disabled={busy || !status || status.state === 'disconnected'}
            onClick={() =>
              void action(async () => {
                await clearBrokerReturn('kite');
                const result = KiteRevokedSchema.parse(
                  await api('/revoke', { confirm: true }),
                );
                setLogin('');
                setReturned(null);
                setMessage(result.message);
                await load();
              })
            }
          >
            Revoke broker connection
          </button>
        </>
      )}
      <button
        type="button"
        disabled={busy || !status || status.state === 'disconnected'}
        onClick={() =>
          void action(async () => {
            const exported = KiteExportSchema.parse(await api('/export'));
            await saveDownload(
              new Blob([JSON.stringify(exported, null, 2)], {
                type: 'application/json',
              }),
              'fingent360-broker-export.json',
            );
            setMessage('Broker capture export prepared without tokens.');
          })
        }
      >
        Export broker captures
      </button>
      <button
        type="button"
        disabled={busy || !status || status.state === 'disconnected'}
        onClick={() =>
          void action(async () => {
            if (
              !window.confirm(
                'Delete broker captures and revoke this connection? Confirmed holdings remain until you remove them in Holdings.',
              )
            )
              return;
            await clearBrokerReturn('kite');
            setReturned(null);
            await api('/delete', { confirm: true });
            setLogin('');
            setMessage('Broker captures deleted. Confirmed holdings remain.');
            await load();
          })
        }
      >
        Delete broker captures
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
