// Munrox Service Worker — Offline PWA Support
const CACHE_NAME = 'munrox-v1';

const APP_SHELL = [
  '/munrox/',
  '/munrox/index.html',
  '/munrox/manifest.json',
  '/munrox/icon-192.png',
  '/munrox/icon-512.png',
];

const CDN_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// Install: pre-cache app shell and CDN assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(APP_SHELL).catch(() => {});
      CDN_RESOURCES.forEach(url => {
        fetch(url, { mode: 'cors' })
          .then(res => { if (res.ok) cache.put(url, res); })
          .catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app files, network-first for API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Anthropic API calls (Sketch-to-Quote)
  if (url.hostname.includes('anthropic.com') || url.hostname.includes('api.')) {
    return;
  }

  // Network-first for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/munrox/index.html');
        }
      });
    })
  );
});
