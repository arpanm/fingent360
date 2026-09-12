import { useEffect, useState } from 'react';
import {
  AlertPreferencesSchema,
  type AlertPreferences as AlertPreferencesData,
} from '@fingent360/contracts';
export function AlertPreferences({
  onChanged,
}: {
  onChanged?: () => Promise<void>;
}) {
  const [data, setData] = useState<AlertPreferencesData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function reload() {
    const response = await fetch('/api/v1/account/alert-preferences', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        'Inbox settings are temporarily unavailable. Try again shortly.',
      );
    setData(AlertPreferencesSchema.parse(await response.json()));
  }
  useEffect(() => {
    void reload().catch(() => setError('Inbox settings unavailable.'));
  }, []);
  async function toggle(indicator: string, muted: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/account/alert-preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator, muted }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          'Could not save the inbox setting. Reload your watchlist and retry.',
        );
      await reload();
      await onChanged?.();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Inbox settings unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card" aria-label="Inbox preferences">
      <h3>Inbox preferences</h3>
      <p>
        Choose which updates appear in your inbox. Muting keeps your watchlist
        and reading history; unmute whenever you want to see updates again.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => {
              setError('');
              void reload().catch(() =>
                setError('Inbox settings unavailable.'),
              );
            }}
          >
            Retry inbox settings
          </button>
        </div>
      )}
      {!data && !error && <p>Loading inbox preferences…</p>}
      {data?.preferences.length === 0 && (
        <p>Follow an indicator to configure its inbox setting.</p>
      )}
      {data?.preferences.map((item) => {
        const name =
          item.indicator === 'NY.GDP.MKTP.KD.ZG'
            ? 'GDP growth'
            : 'Consumer inflation';
        return (
          <div className="section-heading" key={item.indicator}>
            <p>
              {name}: {item.muted ? 'Muted' : 'Enabled'}
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void toggle(item.indicator, !item.muted)}
            >
              {item.muted ? 'Unmute' : 'Mute'} {name}
            </button>
          </div>
        );
      })}
    </section>
  );
}
