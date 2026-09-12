// Only neutral fallback assets belong in this cache. Never add application HTML,
// JavaScript bundles, API responses, account data, portfolio data or provider data.
const CACHE_PREFIX = 'fingent360-offline-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const STATIC_PATHS = ['/offline.html', '/icon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const path of STATIC_PATHS) {
        const response = await fetch(
          new Request(path, { cache: 'reload', credentials: 'omit' }),
        );
        if (!response.ok) throw new Error('Offline asset unavailable');
        await cache.put(path, response);
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Explicitly leave every API request, mutation and cross-origin request to the
  // network. An offline API request fails instead of returning HTML or old data.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(new Request(event.request, { cache: 'no-store' }));
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match('/offline.html')) ??
            new Response('Offline. Connect to access Fingent360.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
      })(),
    );
  }
});
