const CACHE_NAME = 'agios-v4';
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
  '/dailyQuestions.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL, '/favicon.ico']);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/api/') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firebase') ||
    url.origin.includes('googletagmanager')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      if (url.pathname.endsWith('.json') || url.pathname === '/') {
        return fetch(event.request).catch(() => cachedResponse);
      }

      return cachedResponse || fetchPromise || caches.match(OFFLINE_URL);
    })
  );
});