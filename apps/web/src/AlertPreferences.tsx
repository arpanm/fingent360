import { useEffect, useRef, useState } from 'react';
import { StaleAccountRead, type AccountRequest } from './account-request';
import {
  AlertPreferencesSchema,
  AccountActionSchema,
  type AlertPreferences as AlertPreferencesData,
} from '@fingent360/contracts';
export function AlertPreferences({
  onChanged,
  request,
}: {
  onChanged?: () => Promise<void>;
  request: AccountRequest;
}) {
  const [data, setData] = useState<AlertPreferencesData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(false),
    reads = useRef(0),
    writing = useRef(false);
  async function reload() {
    const ticket = ++reads.current;
    const result = AlertPreferencesSchema.parse(
      await request('/alert-preferences'),
    );
    if (live.current && ticket === reads.current) setData(result);
  }
  useEffect(() => {
    live.current = true;
    void reload().catch((error: unknown) => {
      if (live.current && !(error instanceof StaleAccountRead))
        setError('Inbox settings unavailable.');
    });
    return () => {
      live.current = false;
      reads.current++;
    };
  }, [request]);
  async function toggle(indicator: string, muted: boolean) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      AccountActionSchema.parse(
        await request('/alert-preferences', { indicator, muted }, 'PUT'),
      );
      if (!live.current) return;
      // The saved preference already changed material evaluation even if the following GET fails.
      setData((old) =>
        old
          ? {
              preferences: old.preferences.map((p) =>
                p.indicator === indicator ? { ...p, muted } : p,
              ),
            }
          : old,
      );
      await onChanged?.();
      await reload();
    } catch (failure) {
      if (live.current && !(failure instanceof StaleAccountRead))
        setError(
          failure instanceof Error
            ? failure.message
            : 'Inbox settings unavailable.',
        );
    } finally {
      writing.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="card" aria-label="Inbox preferences">
      <h3>Inbox preferences</h3>
      <p>
        Choose which updates appear in your inbox. Muting keeps your watchlist
        and reading history; unmute whenever you want to see updates again.
        Material-change rules pause while muted. Unmuting starts a fresh
        baseline without a backlog.
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
