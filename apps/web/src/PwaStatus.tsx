import { useEffect, useState } from 'react';
import { runtime } from './runtime';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function PwaStatus() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (runtime.native || runtime.mode === 'offline') return;
    const capture = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    const installed = () => {
      setInstall(null);
      setMessage(
        'Fingent360 was installed. Account and market data still require a connection.',
      );
    };
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          setMessage(
            'Offline fallback is unavailable in this browser. The online app remains available.',
          );
        });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', disconnected);
    };
  }, []);
  async function installApp() {
    const event = install;
    if (!event) return;
    setInstall(null);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(
        choice.outcome === 'accepted'
          ? 'Installation requested. Your browser will confirm completion.'
          : 'Installation dismissed. You can continue in this browser.',
      );
    } catch {
      setMessage(
        'Installation could not start. Use your browser’s install controls if available.',
      );
    }
  }
  if (runtime.native || runtime.mode === 'offline') return null;
  return (
    <aside aria-label="Connection and installation">
      {offline && (
        <p role="status">
          You are offline. Visible information may be out of date; reconnect
          before relying on account or market data.
        </p>
      )}
      {message && <p>{message}</p>}
      {install && (
        <button className="secondary" onClick={() => void installApp()}>
          Install Fingent360
        </button>
      )}
    </aside>
  );
}
