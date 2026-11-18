// Ironlog service worker.
// - Offline: keeps a copy of the app so it opens without internet.
//   scripts/precache.mjs fills in VERSION and FILES after `expo export`.
// - Notifications: brings Ironlog to the front when the rest-timer notification is tapped.
const VERSION = 'dev';
const FILES = [];

const CACHE = `ironlog-${VERSION}`;
const BASE = new URL('./', self.location).pathname; // "/ironlog/"
const INDEX = `${BASE}index.html`;
// Built files with a content hash in their name never change, so a copy from the
// previous version can be reused instead of downloading it again.
const HASHED = /[.-][0-9a-f]{16,}\./;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (VERSION !== 'dev') {
        const cache = await caches.open(CACHE);
        const urls = [INDEX, ...FILES.map((f) => BASE + f)];
        const save = async (url) => {
          const old = HASHED.test(url) ? await caches.match(url) : undefined;
          if (old) return cache.put(url, old);
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res.ok) await cache.put(url, res);
          } catch {
            // Offline during the update: this file is fetched later when needed.
          }
        };
        for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(save));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('ironlog-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', (event) => {
  if (VERSION === 'dev') return; // never get in the way of the dev server
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname === `${BASE}sw.js`) return;

  if (req.mode === 'navigate') {
    // The page itself: newest version when online, the saved copy when not
    // (or when the connection is so slow that it would hang).
    event.respondWith(
      (async () => {
        try {
          const res = await Promise.race([fetch(req), timeout(4000)]);
          if (res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(INDEX, res.clone());
          }
          return res;
        } catch {
          return (await caches.match(INDEX)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Scripts, fonts, pictures: saved copy first, otherwise download and keep it.
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && !url.pathname.startsWith(`${BASE}splash/`)) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      if (windows.length) return windows[0].focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});
