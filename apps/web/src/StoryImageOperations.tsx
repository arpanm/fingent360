import { useRef, useState } from 'react';
import { MediaAssetSchema, type MediaAsset } from '@fingent360/contracts';
import { json } from './net';
export function StoryImageOperations({
  asset,
  request = json,
  onUpdated,
}: {
  asset: MediaAsset;
  request?: typeof json;
  onUpdated: (asset: MediaAsset) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const attempt = useRef<string | null>(null);
  async function prepare() {
    setBusy(true);
    setError('');
    attempt.current ??= crypto.randomUUID();
    try {
      const next = MediaAssetSchema.parse(
        await request(
          `/ops/media/${encodeURIComponent(asset.itemId)}/image`,
          { requestId: attempt.current },
          'POST',
          AbortSignal.timeout(120000),
        ),
      );
      onUpdated(next);
      attempt.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image preparation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Story illustration">
      <h3>Story illustration</h3>
      <p>
        Prepare one conceptual image with the configured OpenAI or Gemini image
        model. Provider charges may apply. No private portfolio data is sent.
        Review the returned illustration before publishing it.
      </p>
      {asset.image && (
        <p>
          Image model: {asset.image.provider} / {asset.image.model} · Attempt{' '}
          {asset.image.attemptId}
        </p>
      )}
      <button disabled={busy} onClick={() => void prepare()}>
        {busy
          ? 'Preparing image…'
          : attempt.current
            ? 'Recover image attempt'
            : 'Prepare AI illustration'}
      </button>
      {error && <p role="alert">{error}</p>}
      {error && (
        <button
          disabled={busy}
          onClick={() => {
            attempt.current = null;
            void prepare();
          }}
        >
          Start a new image attempt
        </button>
      )}
      <p>
        Without an image provider, readers retain source text and the existing
        caption visual. Captions and generated images are not evidence
        photographs.
      </p>
    </section>
  );
}
