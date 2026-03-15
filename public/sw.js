const CACHE_NAME = 'alpha-v1';
const OFFLINE_URL = '/offline';

const ESSENTIAL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/bible',
  '/maps',
  '/search',
  '/competitions',
  '/favourites',
  '/intro',
  '/login',
  '/signup',
  '/profile',
  '/studyPlans',
  '/more',
  '/studyPlans/1',
  '/studyPlans/2',
  '/studyPlans/3',
  '/settings',
  '/points',
  '/about',
  '/contact',
  '/versions',
  '/data/bookNames.json',
  '/data/bibles/ar_svd.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL, '/favicon.ico', '/manifest.json']);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          ESSENTIAL_ASSETS.map((url, index) => {
            return new Promise((resolve) => setTimeout(resolve, index * 150))
              .then(() => fetch(url, { cache: 'reload' }))
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              }).catch(() => null);
          })
        );
      });
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
        const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?)$/) || 
                         url.pathname.includes('_next/static');

        if (isStatic && cachedResponse) {
          return cachedResponse;
        }

        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            if (cachedResponse) return cachedResponse;
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });

        return cachedResponse || fetchPromise;
      });
    })
  );
});