import { useEffect, useState } from 'react';
import './story-media.css';
const seen = new Set<string>();
export function StoryGestureHint({ kind }: { kind: 'stories' | 'reading' }) {
  const [open, setOpen] = useState(() => !seen.has(kind));
  useEffect(() => {
    seen.add(kind);
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 6500);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', key);
    };
  }, [kind, open]);
  if (!open) return null;
  return (
    <aside
      className="story-gesture-hint"
      aria-label="Reading gesture guide"
      role="note"
    >
      <span className={`gesture-demo gesture-demo-${kind}`} aria-hidden="true">
        ●
      </span>
      <p>
        {kind === 'stories'
          ? 'Swipe up or down to change stories.'
          : 'Swipe right for more like this, left for less.'}
        <br />
        Buttons work too.
      </p>
      <button onClick={() => setOpen(false)}>Got it</button>
    </aside>
  );
}
