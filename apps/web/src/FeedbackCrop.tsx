import { useRef, useState, type PointerEvent } from 'react';
import type { FeedbackImage } from '@fingent360/contracts';
import { Dialog } from './Dialog';
import {
  finishCapture,
  fullCapture,
  type CaptureArea,
} from './feedback-capture';

export function FeedbackCrop({
  source,
  onUse,
  onCancel,
  onRetake,
}: {
  source: string;
  onUse: (image: FeedbackImage) => void;
  onCancel: () => void;
  onRetake: () => void;
}) {
  const [area, setArea] = useState<CaptureArea>(fullCapture),
    [covers, setCovers] = useState<CaptureArea[]>([]);
  const [covering, setCovering] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [drawing, setDrawing] = useState<CaptureArea | null>(null);
  const start = useRef<{
    x: number;
    y: number;
    corner: string | null;
    area: CaptureArea;
  } | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  function point(event: PointerEvent) {
    const bounds = preview.current!.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100),
      ),
    };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || busy) return;
    const position = point(event),
      corner = (event.target as HTMLElement).dataset.corner ?? null;
    start.current = { ...position, corner, area };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!corner) setDrawing({ ...position, width: 0, height: 0 });
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin) return;
    const position = point(event);
    if (origin.corner && !covering) {
      const old = origin.area;
      const left = origin.corner.includes('w')
        ? Math.min(position.x, old.x + old.width - 2)
        : old.x;
      const top = origin.corner.includes('n')
        ? Math.min(position.y, old.y + old.height - 2)
        : old.y;
      const right = origin.corner.includes('e')
        ? Math.max(position.x, old.x + 2)
        : old.x + old.width;
      const bottom = origin.corner.includes('s')
        ? Math.max(position.y, old.y + 2)
        : old.y + old.height;
      setArea({ x: left, y: top, width: right - left, height: bottom - top });
    } else
      setDrawing({
        x: Math.min(origin.x, position.x),
        y: Math.min(origin.y, position.y),
        width: Math.abs(position.x - origin.x),
        height: Math.abs(position.y - origin.y),
      });
  }
  function up() {
    if (drawing && drawing.width >= 2 && drawing.height >= 2) {
      if (covering) setCovers((previous) => [...previous, drawing]);
      else setArea(drawing);
    }
    start.current = null;
    setDrawing(null);
  }
  const style = (value: CaptureArea) => ({
    left: `${value.x}%`,
    top: `${value.y}%`,
    width: `${value.width}%`,
    height: `${value.height}%`,
  });
  async function use() {
    setBusy(true);
    setError('');
    try {
      onUse(await finishCapture(source, area, covers));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Capture could not be prepared.',
      );
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Select area to capture"
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="feedback-crop" data-feedback-exclude>
        <p>
          {covering
            ? 'Drag across anything you want to hide.'
            : 'Drag to select an area, or move the corner handles.'}{' '}
          Form fields are already hidden.
        </p>
        <div
          ref={preview}
          className="feedback-crop-image"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            setDrawing(null);
          }}
        >
          <img src={source} alt="App screenshot to crop" draggable={false} />
          <div className="feedback-crop-selection" style={style(area)}>
            {['nw', 'ne', 'sw', 'se'].map((corner) => (
              <span
                key={corner}
                className={`crop-handle ${corner}`}
                data-corner={corner}
              />
            ))}
          </div>
          {covers.map((cover, index) => (
            <span key={index} className="feedback-cover" style={style(cover)} />
          ))}
          {drawing && (
            <span
              className={covering ? 'feedback-cover' : 'feedback-crop-outline'}
              style={style(drawing)}
            />
          )}
        </div>
        <div className="feedback-tools">
          <button
            className="secondary"
            type="button"
            onClick={() => setArea(fullCapture)}
          >
            Full screen
          </button>
          <button
            className="secondary"
            type="button"
            aria-pressed={covering}
            onClick={() => setCovering(!covering)}
          >
            Cover private details
          </button>
          {covers.length > 0 && (
            <button
              className="text-button"
              type="button"
              onClick={() => setCovers((previous) => previous.slice(0, -1))}
            >
              Undo cover
            </button>
          )}
        </div>
        <details className="feedback-crop-precise">
          <summary>Adjust crop with keyboard</summary>
          {(['x', 'y', 'width', 'height'] as const).map((key, index) => (
            <label key={key}>
              {['Left edge', 'Top edge', 'Crop width', 'Crop height'][index]}
              <input
                type="range"
                min={key === 'x' || key === 'y' ? 0 : 2}
                max={
                  key === 'x'
                    ? 100 - area.width
                    : key === 'y'
                      ? 100 - area.height
                      : key === 'width'
                        ? 100 - area.x
                        : 100 - area.y
                }
                step="1"
                value={area[key]}
                onChange={(event) =>
                  setArea((previous) => ({
                    ...previous,
                    [key]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </details>
        <p className="feedback-hint">
          Only the selected image will be attached. Cover names or financial
          details you do not want to share.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="feedback-actions">
          <button type="button" disabled={busy} onClick={() => void use()}>
            {busy ? 'Preparing…' : 'Use screenshot'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onRetake}
          >
            Retake
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
}
