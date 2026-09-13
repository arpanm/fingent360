import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './ui';
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const back = (event: Event) => {
      if (event.defaultPrevented) return;
      // Match native Back: a confirmation above a form handles navigation first.
      const top = [...document.querySelectorAll('dialog[open]')].at(-1);
      if (!ref.current?.open || top !== ref.current) return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener('f360-before-navigate', back);
    return () => window.removeEventListener('f360-before-navigate', back);
  }, []);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="reader-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close.current();
      }}
    >
      <div className="dialog-inner">
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
