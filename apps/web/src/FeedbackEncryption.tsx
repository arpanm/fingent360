import { useState } from 'react';
import { FeedbackEncryptionResultSchema } from '@fingent360/contracts';
import { json } from './net';
export function FeedbackEncryption() {
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  return (
    <section aria-label="Feedback encryption maintenance">
      <h2>Protect retained feedback</h2>
      <p>
        New reports are encrypted before storage. Upgrade legacy reports and
        rotate older keys in batches of up to 50. Keep previous server keys
        until all retained reports are upgraded or expired.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed || busy) return;
          setBusy(true);
          setNotice('');
          void json('/ops/feedback/encryption', { confirm: true })
            .then((value) => {
              const result = FeedbackEncryptionResultSchema.parse(value);
              setNotice(
                `${result.processed} reports upgraded. ${result.remaining} remain. Report bodies were not opened in this screen.`,
              );
              setConfirmed(false);
            })
            .catch(() =>
              setNotice(
                'Encryption maintenance is unavailable. Check server keys and retry; this batch was not partially committed.',
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I confirm this bounded encryption maintenance.
        </label>
        <button disabled={!confirmed || busy}>
          Upgrade next feedback batch
        </button>
      </form>
      {busy && <p role="status">Upgrading retained reports…</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
