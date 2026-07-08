// Sahyatri service worker — app-shell caching with sensible freshness rules.
const VERSION = 'sahyatri-v1';
const SHELL = ['/offline.html', '/logo.svg', '/favicon.svg', '/fonts/Ancorli.ttf', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Live data must never be stale: API always goes to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Pages: network-first, offline fallback.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Static assets (hashed _next files, fonts, brand SVGs, icons): cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') ||
      url.pathname.startsWith('/icons/') || url.pathname.endsWith('.svg')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
  }
});
