import { WhatsappSchedule } from './WhatsappSchedule';
import { useEffect, useRef, useState } from 'react';
import {
  WhatsappViewSchema,
  WhatsappVerificationSchema,
  WhatsappChoicesSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function WhatsappChannel() {
  const [value, setValue] = useState<ReturnType<
      typeof WhatsappViewSchema.parse
    > | null>(null),
    [choices, setChoices] = useState<ReturnType<
      typeof WhatsappChoicesSchema.parse
    > | null>(null),
    [verification, setVerification] = useState<ReturnType<
      typeof WhatsappVerificationSchema.parse
    > | null>(null),
    [phone, setPhone] = useState(''),
    [consent, setConsent] = useState(false),
    [item, setItem] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [signedOut, setSignedOut] = useState(false);
  const live = useRef(true),
    intent = useRef<{ key: string; id: string } | null>(null);
  async function load(after?: string) {
    const [state, list] = await Promise.all([
      json('/account/whatsapp'),
      json(
        '/account/whatsapp/choices' +
          (after ? '?after=' + encodeURIComponent(after) : ''),
      ),
    ]);
    if (live.current) {
      const parsed = WhatsappViewSchema.parse(state);
      setValue(parsed);
      setSignedOut(false);
      if (parsed.connection === 'verified') {
        setVerification(null);
        if (intent.current?.key.startsWith('verify:')) intent.current = null;
      }
      setChoices(WhatsappChoicesSchema.parse(list));
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (live.current) {
        if (cause instanceof RequestError && cause.status === 401) {
          setSignedOut(true);
          setValue(null);
          setChoices(null);
          setVerification(null);
          setPhone('');
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'WhatsApp settings unavailable.',
        );
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void run(() => load());
    return () => {
      live.current = false;
    };
  }, []);
  function requestId(key: string) {
    if (intent.current?.key !== key)
      intent.current = { key, id: crypto.randomUUID() };
    return intent.current.id;
  }
  return (
    <main
      className="panel source-workflow"
      aria-label="WhatsApp summaries"
      aria-busy={busy}
    >
      <h1>Read it on WhatsApp</h1>
      <p>
        Choose a public summary for your verified number. No holdings, goals,
        private feedback or account details are included. This form requests a
        single summary. Recurring delivery has separate consent below. Up to ten
        summary requests and ten new verification requests per day; wait one
        minute between verification requests.
      </p>
      {busy && <p role="status">Updating WhatsApp settings…</p>}
      {error && <p role="alert">{error}</p>}
      {signedOut && <a href="#account">Sign in to manage delivery</a>}
      <button disabled={busy} onClick={() => void run(() => load())}>
        Refresh WhatsApp status
      </button>
      {value && (
        <>
          <p>
            Channel: {value.enabled ? 'Available' : 'Not activated'} · Number:{' '}
            {value.maskedPhone ?? 'Not connected'} · {value.connection}
          </p>
          {!value.enabled ? (
            <p>
              Use Share in a public story for manual sharing. Offline mode
              cannot verify a recipient or promise external delivery.
            </p>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const response = WhatsappVerificationSchema.parse(
                      await json(
                        '/account/whatsapp/verify',
                        {
                          requestId: requestId('verify:' + phone),
                          phone,
                          consent,
                        },
                        'POST',
                      ),
                    );
                    if (live.current) setVerification(response);
                    await load();
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    Your WhatsApp number, including country code
                    <input
                      value={phone}
                      inputMode="tel"
                      pattern="[1-9][0-9]{7,14}"
                      placeholder="Country code and number, digits only"
                      required
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setConsent(false);
                        setVerification(null);
                        intent.current = null;
                      }}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={consent}
                      required
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I consent to receiving the public summaries I explicitly
                    request on WhatsApp. I can disconnect or send STOP at any
                    time.
                  </label>
                  <button disabled={!consent}>Verify my number</button>
                </fieldset>
              </form>
              {verification && (
                <p>
                  <a
                    href={verification.verificationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open WhatsApp and send verification
                  </a>{' '}
                  before {new Date(verification.expiresAt).toLocaleTimeString()}
                  . You choose whether to send; then refresh status here.
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await json(
                      '/account/whatsapp/deliveries',
                      { requestId: requestId('send:' + item), itemId: item },
                      'POST',
                    );
                    intent.current = null;
                    await load();
                  });
                }}
              >
                <fieldset disabled={busy || value.connection !== 'verified'}>
                  <label>
                    Reviewed public summary
                    <select
                      value={item}
                      onChange={(e) => {
                        setItem(e.target.value);
                        intent.current = null;
                      }}
                      required
                    >
                      <option value="">Choose a summary</option>
                      {choices?.items.map((row) => (
                        <option value={row.id} key={row.id}>
                          {row.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {choices?.items.find((row) => row.id === item) && (
                    <p>
                      {choices.items.find((row) => row.id === item)!.summary}{' '}
                      <a href={'#read/' + item}>Read evidence first</a>
                    </p>
                  )}
                  <button disabled={!item}>Request this summary</button>
                </fieldset>
              </form>
              {choices && !choices.items.length && (
                <p>No eligible reviewed summaries on this page.</p>
              )}
              {choices?.next && (
                <button
                  disabled={busy}
                  onClick={() => void run(() => load(choices.next!))}
                >
                  Next public summaries
                </button>
              )}
            </>
          )}
          <button
            disabled={busy || value.connection === 'none'}
            onClick={() =>
              void run(async () => {
                await json('/account/whatsapp', undefined, 'DELETE');
                setVerification(null);
                setPhone('');
                setConsent(false);
                await load();
              })
            }
          >
            Disconnect WhatsApp and cancel queued messages
          </button>
          <h2>Delivery history</h2>
          <p>
            Latest 100 requests. Accepted means provider receipt, not delivery.
            Uncertain sends are not retried automatically. A message already
            sent cannot be recalled.
          </p>
          {!value.jobs.length ? (
            <p>No requested messages.</p>
          ) : (
            <ol>
              {value.jobs.map((job) => (
                <li key={job.id}>
                  <a href={'#read/' + job.itemId}>Requested public item</a>
                  <p>
                    {job.status} · {job.detail}
                  </p>
                  {job.status === 'failed' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await json(
                            '/account/whatsapp/deliveries/' + job.id + '/retry',
                            {},
                            'POST',
                          );
                          await load();
                        })
                      }
                    >
                      Retry confirmed failed delivery
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <WhatsappSchedule />
      <a href="#today">Back to Today</a>
    </main>
  );
}
