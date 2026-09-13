import { useEffect, useId, useRef, useState } from 'react';
import { FeedItemSchema, type FeedItem } from '@fingent360/contracts';
import './term-preview.css';
export function TermLink({ id, onOpen }: { id: string; onOpen?: () => void }) {
  const [position, setPosition] = useState({ left: 16, top: 80 });
  const description = useId(),
    [open, setOpen] = useState(false),
    [item, setItem] = useState<FeedItem | null>(null),
    [error, setError] = useState('');
  const root = useRef<HTMLSpanElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    request = useRef<AbortController | null>(null),
    sequence = useRef(0);
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    request.current?.abort();
    sequence.current++;
    setOpen(false);
  };
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = ++sequence.current;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const rect = root.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          left: Math.max(
            16,
            Math.min(
              rect.left,
              innerWidth - Math.min(320, innerWidth - 32) - 16,
            ),
          ),
          top: Math.max(16, Math.min(rect.bottom, innerHeight - 280)),
        });
      setOpen(true);
      setItem(null);
      setError('');
      void fetch(`/api/v1/discovery/items/${encodeURIComponent(id)}`, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(
              'Term preview unavailable. Open the term to check its status.',
            );
          const value = FeedItemSchema.parse(await response.json());
          if (value.status !== 'published')
            throw new Error('This term has been withdrawn.');
          if (current === sequence.current) setItem(value);
        })
        .catch((failure) => {
          if (current === sequence.current && !controller.signal.aborted)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Term preview unavailable.',
            );
        });
    }, 250);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
      sequence.current++;
    },
    [id],
  );
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [open]);
  const label = id.replace(/^term-/, '').replaceAll('-', ' ');
  const props = {
    className: 'term-link',
    'aria-describedby': open ? description : undefined,
    onFocus: () => {
      if (root.current?.querySelector(':focus-visible')) show();
    },
    onClick: () => {
      close();
      onOpen?.();
    },
  };
  return (
    <span
      className="term-preview-root"
      ref={root}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show();
      }}
      onPointerLeave={() => {
        if (!root.current?.contains(document.activeElement)) close();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          close();
      }}
    >
      {onOpen ? (
        <button type="button" {...props}>
          {label}
        </button>
      ) : (
        <a href={`#read/${id}`} {...props}>
          {label}
        </a>
      )}
      {open && (
        <span
          className="term-preview"
          id={description}
          role="tooltip"
          style={{ left: position.left, top: position.top }}
        >
          <strong>
            {item?.title ?? (error ? 'Preview unavailable' : 'Loading term…')}
          </strong>
          {item ? (
            <>
              <span>{item.summary}</span>
              <small>
                {item.effectiveLabel} · {item.source.name}
              </small>
            </>
          ) : (
            error && <span>{error}</span>
          )}
          <small>Open for full context.</small>
        </span>
      )}
    </span>
  );
}
