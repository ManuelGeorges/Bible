
const CACHE_NAME = 'alpha-v1';
const OFFLINE_URL = '/offline';

const ESSENTIAL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/data/bookNames.json',
  '/data/bibles/ar_svd.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ESSENTIAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('webpack') ||
    url.pathname.startsWith('/api/') ||
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});