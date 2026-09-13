import { useEffect, useRef } from 'react';

/** Keep in-memory form state private; ask before the router disposes a dirty form. */
export function useDraftGuard(dirty: boolean, message: string) {
  const state = useRef({ dirty, message });
  state.current = { dirty, message };
  useEffect(() => {
    const navigate = (event: Event) => {
      if (event.defaultPrevented || !state.current.dirty) return;
      if (!window.confirm(state.current.message)) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('f360-before-navigate', navigate);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('f360-before-navigate', navigate);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
}
