import { useEffect, useState } from 'react';
import { httpsOrigin, runtime } from './runtime';

export function DeviceStatus() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const error = (event: Event) =>
      setMessage(String((event as CustomEvent).detail));
    const native = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          action: string;
          outcome: string;
          message: string;
        }>
      ).detail;
      setMessage(
        detail?.message ||
          (detail?.outcome === 'saved'
            ? 'File saved.'
            : 'Android action finished.'),
      );
    };
    window.addEventListener('f360-storage-error', error);
    window.addEventListener('f360-native-result', native);
    return () => {
      window.removeEventListener('f360-storage-error', error);
      window.removeEventListener('f360-native-result', native);
    };
  }, []);
  return (
    <>
      {runtime.mode === 'offline' && (
        <aside className="device-status" aria-label="On-device mode">
          <span>
            <strong>On this device</strong> · Research snapshot{' '}
            {runtime.snapshotDate?.slice(0, 10)}
          </span>
          <a href="#app-settings">Details & settings</a>
        </aside>
      )}
      {message && (
        <p role="status" className="device-notice">
          {message}
          <button
            className="text-button"
            onClick={() => setMessage('')}
            aria-label="Dismiss device message"
          >
            Dismiss
          </button>
        </p>
      )}
    </>
  );
}
export function AppSettings() {
  const [mode, setMode] = useState(
    runtime.mode === 'connected' ? 'connected' : 'offline',
  );
  const [web, setWeb] = useState(runtime.webUrl);
  const [api, setApi] = useState(runtime.apiUrl);
  const [error, setError] = useState('');
  function apply() {
    setError('');
    try {
      const bridge = window.FingentAndroid;
      if (!bridge)
        throw Error('Connection switching is available in the Android app.');
      bridge.setConnection(
        mode,
        mode === 'connected' ? httpsOrigin(web) : '',
        mode === 'connected' ? httpsOrigin(api) : '',
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Connection settings could not be applied.',
      );
    }
  }
  return (
    <section className="app-settings">
      <p className="page-kicker">YOUR APP</p>
      <h1>A workspace that travels with you.</h1>
      <div className="device-card">
        <h2>
          {runtime.mode === 'offline'
            ? 'Saved on this device'
            : 'Connected workspace'}
        </h2>
        {runtime.mode === 'offline' ? (
          <>
            <p>
              Your accounts, goals, holdings, saved reading, preferences and
              learning activity stay in this app’s device storage. You can close
              the app and return without a server or an internet connection.
            </p>
            <dl>
              <dt>Public research snapshot</dt>
              <dd>
                {runtime.snapshotDate
                  ? new Date(runtime.snapshotDate).toLocaleString()
                  : 'Unavailable'}{' '}
                · {runtime.snapshotItems} published items
              </dd>
              <dt>Private data</dt>
              <dd>
                Starts empty. Account and financial records stay on this device.
              </dd>
            </dl>
            <p>
              Research is a dated snapshot, not a live feed. Source links need
              internet. Refreshes, server operations and cloud AI require a
              connected deployment. Suggestions search the bundled glossary and,
              with your permission, your saved goals.
            </p>
            <p>
              Reading reminders appear when you open or use the app after their
              due time. They do not send background push notifications. Poll
              results describe this account’s local response.
            </p>
            <p>
              This test build uses Android app storage and a local password
              check, not a cloud identity or encrypted vault. Protect your phone
              with its screen lock. Uninstalling or clearing app storage deletes
              device data; export important records from Privacy first. In-place
              updates with the same signing key preserve storage.
            </p>
          </>
        ) : (
          <p>
            This workspace uses its configured API. An internet connection and a
            server account are required. Device-mode accounts remain separate.
          </p>
        )}
        <a href="#privacy">Export my account data</a>
      </div>
      {window.FingentAndroid && (
        <form
          className="device-card"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <h2>Connection</h2>
          <p>
            Start with device mode. When your CDN and API are deployed, enter
            their HTTPS origins here. Android will ask you to confirm before
            switching.
          </p>
          <label>
            Workspace mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="offline">On this device · no server</option>
              <option value="connected">Connected · CDN and API</option>
            </select>
          </label>
          {mode === 'connected' && (
            <>
              <label>
                Web app URL
                <input
                  type="url"
                  required
                  value={web}
                  onChange={(event) => setWeb(event.target.value)}
                  placeholder="https://app.example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
              <label>
                API URL
                <input
                  type="url"
                  required
                  value={api}
                  onChange={(event) => setApi(event.target.value)}
                  placeholder="https://api.example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
              <p>
                The deployed web app must include Fingent360’s Android runtime
                support. Use subdomains of the same site and credentialed CORS
                on the API. Local data is not uploaded or merged when switching.
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button type="submit">Apply connection settings</button>
        </form>
      )}
      <div className="device-card">
        <h2>Send useful feedback</h2>
        <a className="button" href="#feedback">
          Your feedback & delivery settings
        </a>
        <p>
          Share the screen name, the steps you took, what you expected and what
          happened. Include whether you were in device or connected mode. A
          screenshot or voice note helps with layout and gesture issues. Use the
          floating finger button to capture this app, crop or cover details, and
          type or record your feedback. Submitted feedback stays queued on this
          device until you enable its server destination and it is received.
        </p>
        <p>
          You choose what to share. Account exports can contain private
          financial information.
        </p>
        {window.FingentAndroid?.getBuildInfo && (
          <details>
            <summary>Build details</summary>
            <pre className="build-details">
              {window.FingentAndroid.getBuildInfo()}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
}
