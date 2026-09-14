import { useEffect, useRef, useState } from 'react';
import { saveDownload } from './runtime';
import { MediaAssetSchema, type MediaAsset } from '@fingent360/contracts';
export function MediaSummary({
  itemId,
  itemVersion,
}: {
  itemId: string;
  itemVersion: number;
}) {
  const [asset, setAsset] = useState<MediaAsset | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [playing, setPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [recording, setRecording] = useState(false),
    [notice, setNotice] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const canceled = useRef(false);
  useEffect(() => {
    let active = true;
    canceled.current = false;
    setLoading(true);
    setAsset(null);
    setError('');
    setPlaying(false);
    setElapsed(0);
    void fetch(`/api/v1/discovery/items/${encodeURIComponent(itemId)}/media`, {
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok)
          throw new Error(
            'Visual summary could not load. You can still read the source below.',
          );
        const value = MediaAssetSchema.parse(await response.json());
        if (
          value.itemId !== itemId ||
          value.itemVersion !== itemVersion ||
          value.status !== 'published'
        )
          throw new Error(
            'This visual belongs to another source edition. Refresh reading.',
          );
        return value;
      })
      .then((value) => {
        if (active) setAsset(value);
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error ? failure.message : 'Visual unavailable.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      canceled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    };
  }, [itemId, itemVersion]);
  useEffect(() => {
    if (!playing || !asset) return;
    const start = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const time = Math.min(asset.durationMs, performance.now() - start);
      setElapsed(time);
      if (time >= asset.durationMs) setPlaying(false);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, asset]);
  async function download() {
    if (!asset || recording) return;
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 640;
    if (!('MediaRecorder' in window) || !canvas.captureStream) {
      setNotice(
        'This browser cannot export a video clip. The visual and transcript remain available.',
      );
      return;
    }
    const mime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) {
      setNotice(
        'WebM export is unavailable in this browser. Try a supported desktop browser.',
      );
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setRecording(true);
    setNotice('Creating your source-caption clip. Keep this page open.');
    let stream: MediaStream | null = null;
    let frame = 0;
    try {
      stream = canvas.captureStream(12);
      const writer = new MediaRecorder(stream, { mimeType: mime });
      recorder.current = writer;
      const chunks: BlobPart[] = [];
      writer.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise<void>((resolve, reject) => {
        writer.onstop = () => resolve();
        writer.onerror = () => reject(new Error('Video recording failed.'));
      });
      const draw = (time: number) => {
        ctx.fillStyle = '#103d35';
        ctx.fillRect(0, 0, 960, 640);
        ctx.fillStyle = '#d0e59a';
        ctx.font = '18px sans-serif';
        ctx.fillText('FINGENT360 · SOURCE-BASED CAPTION CLIP', 40, 55);
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px sans-serif';
        const text =
          asset.captions.find((c) => time >= c.startMs && time < c.endMs)
            ?.text ?? asset.title;
        const words = text
          .split(/\s+/)
          .flatMap((word) =>
            word.length > 40 ? (word.match(/.{1,40}/g) ?? [word]) : [word],
          );
        let line = '',
          y = 155;
        for (const word of words) {
          if (ctx.measureText(line + ' ' + word).width > 865 && line) {
            ctx.fillText(line, 40, y, 870);
            y += 44;
            line = word;
          } else line += (line ? ' ' : '') + word;
        }
        ctx.fillText(line, 40, y, 870);
        ctx.fillStyle = '#d0e59a';
        ctx.font = '16px sans-serif';
        ctx.fillText(
          `Source item ${asset.itemId} · edition ${asset.itemVersion}`,
          40,
          532,
          880,
        );
        ctx.fillText(asset.sourceUrl, 40, 564, 880);
        ctx.fillText(
          'Illustration, not a document photograph. No audio track.',
          40,
          602,
          880,
        );
      };
      draw(0);
      writer.start();
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (writer.state !== 'recording') {
            resolve();
            return;
          }
          const time = performance.now() - start;
          draw(time);
          if (time >= asset.durationMs) {
            writer.stop();
            resolve();
          } else frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      });
      await stopped;
      if (chunks.length && !canceled.current) {
        setNotice(
          await saveDownload(
            new Blob(chunks, { type: mime }),
            `${asset.itemId}-v${asset.itemVersion}.webm`,
            'Video clip downloaded. It contains source captions without audio.',
          ),
        );
      }
    } catch {
      setNotice(
        'Video export failed. The source transcript remains available.',
      );
    } finally {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setRecording(false);
    }
  }
  if (loading) return <p className="muted">Loading visual…</p>;
  if (error) return <p role="status">{error}</p>;
  if (!asset) return null;
  const caption =
    asset.captions.find((c) => elapsed >= c.startMs && elapsed < c.endMs)
      ?.text ?? asset.captions.at(-1)!.text;
  return (
    <section
      className="media-summary"
      aria-label="Reviewed visual summary"
      style={{ minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`}
        alt={`Source-based visual summary: ${asset.title}`}
        width={960}
        height={640}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
      <p className="data-note">
        {asset.label} Based on source edition {asset.itemVersion}.
      </p>
      <p className="media-caption" aria-live={playing ? 'off' : 'polite'}>
        {caption}
      </p>
      <div className="button-row">
        <button
          className="secondary"
          onClick={() => {
            if (elapsed >= asset.durationMs) setElapsed(0);
            setPlaying(!playing);
          }}
        >
          {playing ? 'Pause captions' : 'Play captions'}
        </button>
        <button
          className="secondary"
          disabled={recording}
          onClick={() => void download()}
        >
          {recording ? 'Creating clip…' : 'Download caption video'}
        </button>
      </div>
      <p className="muted">
        Play a short visual summary, read the transcript, or keep a captioned
        clip.
      </p>
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>Read full caption transcript</summary>
        <ol>
          {asset.captions.map((c) => (
            <li key={c.startMs}>{c.text}</li>
          ))}
        </ol>
        <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
          Original source
        </a>
      </details>
    </section>
  );
}
