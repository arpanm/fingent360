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
        'Inbox settings unavailable. Sign in and check database migrations.',
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
        Mute hides an indicator from your inbox without deleting observations or
        read receipts. Unmuting restores it with its previous read status. These
        settings do not send external notifications.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.preferences.length === 0 && (
        <p>Follow an indicator to configure its inbox setting.</p>
      )}
      {data?.preferences.map((item) => {
        const name =
          item.indicator === 'NY.GDP.MKTP.KD.ZG'
            ? 'GDP growth'
            : 'Consumer inflation';
        return (
          <div key={item.indicator}>
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
