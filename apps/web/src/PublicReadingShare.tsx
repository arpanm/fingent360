import { useState } from 'react';
import { publicReadingLink } from '@fingent360/contracts';
import { runtime } from './runtime';

export function PublicReadingShare({ id }: { id: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  let link: string | null = null;
  try {
    if (runtime.mode !== 'offline')
      link = publicReadingLink(runtime.webUrl || window.location.origin, id);
  } catch {
    /* Never substitute a local, private-context or device URL. */
  }
  if (!link)
    return (
      <p>
        A public app link is not available in this local edition. Open Evidence
        to view the original source.
      </p>
    );
  const shareUrl = link;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Public link copied.');
    } catch {
      setMessage('Copy is unavailable. Select and copy the public link below.');
    }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const bridge = window.FingentAndroid;
      if (runtime.native && bridge?.sharePublicLink) {
        await bridge.sharePublicLink(shareUrl);
        setMessage(
          'Share chooser opened. Complete or cancel sharing in your selected app.',
        );
      } else if (navigator.share) {
        await navigator.share({
          title: 'Fingent360 public reading',
          url: shareUrl,
        });
        setMessage('Link handed to your selected share destination.');
      } else setMessage('Sharing is unavailable here. Use Copy link instead.');
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : 'Sharing is unavailable. You can still copy the public link.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Share public reading">
      <p>
        Only the public reading link is shared. Your account, saved items and
        private plans are excluded.
      </p>
      <button disabled={busy} onClick={() => void share()}>
        Share public link
      </button>
      <button disabled={busy} onClick={() => void copy()}>
        Copy link
      </button>
      <label>
        Public reading link
        <input
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
