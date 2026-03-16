const CACHE_NAME = 'agios-next-v1';
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
  '/StudyPlans/1',
  '/StudyPlans/2',
  '/StudyPlans/3',
  '/more',
  '/settings',
  '/points',
  '/about',
  '/contact',
  '/versions',
  '/data/bookNames.json',
  '/data/bibles/ar_svd.json',
  '/StudyPlansData.json',
  '/questionsData.js',
  '/dailyVerses.json',
  '/dailyQuestions.json',
  '/images/Agios.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ESSENTIAL_ASSETS.map((url) => {
          return fetch(url).then((response) => {
            if (response.ok) return cache.put(url, response);
          }).catch(() => null);
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/api/') ||
    url.origin.includes('google') ||
    url.origin.includes('firebase') ||
    url.pathname.startsWith('/_next/static/webpack/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});