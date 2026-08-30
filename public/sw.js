// Talisman Progressive Service Worker
//
// ⚠ BUMP CACHE_NAME ON EVERY RELEASE. The activate handler deletes every cache
// whose key is not the current one, so the version string is the ONLY thing
// that evicts stale assets. It sat on v3 across many changes.
//
// ⚠ THIS FILE IS THE ONLY SELF-HEALING PATH. The browser always revalidates
// sw.js itself, but everything it caches is served cache-first. So a fix that
// lives in the page bundle can never reach a client whose worker is serving the
// old bundle: the fix is inside the thing being replaced. Anything that has to
// undo a bad worker has to be written HERE.
const CACHE_NAME = 'talisman-moba-cache-v4';

/*
 * On localhost, do not exist.
 *
 * Next's dev chunk URLs are not content hashed, so cache-first serving means an
 * edit to a component simply never appears: the browser keeps running the old
 * code and it reads as the change not working. This worker removes itself and
 * takes its caches with it, which is what un-sticks a developer who already has
 * one installed.
 */
const IS_DEV =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.local');
const PRECACHE_URLS = [
  '/',
  '/play',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.ico',
];

if (IS_DEV) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        // reload so the page comes back on a live, uncached bundle
        clients.forEach((c) => c.navigate(c.url));
      })(),
    );
  });
  // no fetch handler in dev: every request goes straight to the network
} else {

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Navigation requests: Network first fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/play') || caches.match('/'))
    );
    return;
  }

  // Static assets: Cache-first fallback to network with background caching
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.url.includes('/models/') ||
            event.request.url.includes('/_next/') ||
            event.request.url.endsWith('.glb') ||
            event.request.url.endsWith('.svg') ||
            event.request.url.endsWith('.png') ||
            event.request.url.endsWith('.json'))
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback
    })
  );
});

}
