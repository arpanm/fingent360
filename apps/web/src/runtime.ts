import { canNavigate, currentRoute, returnTo } from './navigation';
// Explicit feedback destinations must not inherit account/API URL rewriting.
export const networkFetch = window.fetch.bind(window);

interface NativeBridge {
  getConfig(): string;
  getBuildInfo?(): string;
  saveFile(filename: string, mime: string, base64: string): void;
  setConnection(mode: string, webUrl: string, apiUrl: string): void;
  captureFeedback?(): Promise<string>;
  feedbackRead?(): Promise<{
    revision: number;
    records: unknown[];
    config: { enabled: boolean; apiOrigin: string };
  }>;
  feedbackWrite?(
    expectedRevision: number,
    state: {
      records: unknown[];
      config: { enabled: boolean; apiOrigin: string };
    },
  ): Promise<{ revision: number }>;
  sendFeedback?(
    apiOrigin: string,
    method: 'POST' | 'GET' | 'DELETE',
    id: string | null,
    receiptToken: string | null,
    body: unknown,
  ): Promise<{ status: number; body: unknown }>;
}
declare global {
  interface Window {
    FingentAndroid?: NativeBridge;
    __fingentHandleBack?: () => boolean;
  }
}
export interface AppRuntime {
  mode: 'web' | 'offline' | 'connected';
  native: boolean;
  webUrl: string;
  apiUrl: string;
  snapshotDate: string | null;
  snapshotItems: number;
}
export const runtime: AppRuntime = {
  mode: 'web',
  native: false,
  webUrl: '',
  apiUrl: '',
  snapshotDate: null,
  snapshotItems: 0,
};
export function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw Error('Use an HTTPS origin without a path, query or credentials.');
  return url.origin;
}
export async function initializeRuntime() {
  const bridge = window.FingentAndroid;
  runtime.native = !!bridge;
  if (bridge) {
    const config: unknown = JSON.parse(bridge.getConfig());
    if (
      !config ||
      typeof config !== 'object' ||
      !('mode' in config) ||
      !['offline', 'connected'].includes(String(config.mode))
    )
      throw Error('Android connection configuration is invalid.');
    runtime.mode = config.mode as 'offline' | 'connected';
    if (runtime.mode === 'connected') {
      if (!('webUrl' in config) || !('apiUrl' in config))
        throw Error('Set both the web and API addresses in App settings.');
      runtime.webUrl = httpsOrigin(String(config.webUrl));
      runtime.apiUrl = httpsOrigin(String(config.apiUrl));
    }
  } else if (import.meta.env.VITE_APP_RUNTIME === 'offline')
    runtime.mode = 'offline';
  else if (import.meta.env.VITE_API_ORIGIN)
    runtime.apiUrl = httpsOrigin(import.meta.env.VITE_API_ORIGIN);
  if (runtime.mode === 'offline') {
    const offline = await import('./offline');
    await offline.initializeOffline();
    runtime.snapshotDate = offline.snapshotInfo.generatedAt;
    runtime.snapshotItems = offline.snapshotInfo.items;
    window.fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith('/api/v1/')
      ) {
        const request = new Request(
          input instanceof Request ? input : url,
          init,
        );
        return offline.offlineResponse(request);
      }
      return networkFetch(input, init);
    };
  } else if (runtime.apiUrl) {
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith('/api/v1/')
      )
        return networkFetch(input, init);
      const request = new Request(input instanceof Request ? input : url, init);
      return networkFetch(
        new Request(`${runtime.apiUrl}${url.pathname}${url.search}`, request),
        { credentials: 'include' },
      );
    };
  }
  if (bridge) {
    window.__fingentHandleBack = () => {
      const dialog = [
        ...document.querySelectorAll<HTMLDialogElement>('dialog[open]'),
      ].at(-1);
      if (dialog) {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true })))
          dialog.close();
        return true;
      }
      if (currentRoute() === 'today') {
        return !canNavigate();
      }
      returnTo('today');
      return true;
    };
    document.addEventListener('click', (event) => {
      const link = (
        event.target instanceof Element
          ? event.target.closest('a[download]')
          : null
      ) as HTMLAnchorElement | null;
      if (!link || event.defaultPrevented) return;
      event.preventDefault();
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      void networkFetch(url)
        .then(async (response) => {
          if (!response.ok) throw Error('The download could not be opened.');
          await saveDownload(
            await response.blob(),
            link.download || 'fingent360-download',
          );
        })
        .catch((error) =>
          window.dispatchEvent(
            new CustomEvent('f360-storage-error', { detail: String(error) }),
          ),
        );
    });
  }
}
export async function saveDownload(
  blob: Blob,
  filename: string,
  completedMessage = 'Export downloaded.',
): Promise<string> {
  const bridge = window.FingentAndroid;
  if (bridge) {
    if (blob.size > 12_000_000)
      throw Error(
        'This export is too large for the Android file picker. Export a smaller selection.',
      );
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]!);
      reader.onerror = () => reject(Error('Export could not be read.'));
      reader.readAsDataURL(blob);
    });
    bridge.saveFile(filename, blob.type || 'application/octet-stream', base64);
    return 'Choose where to save the export in the Android file picker.';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return completedMessage;
}
