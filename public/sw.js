const CACHE_NAME = 'agios-v3'; // غيرت الاسم عشان نضمن تحديث الكاش
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
  '/studyPlans/1',
  '/studyPlans/2',
  '/studyPlans/3',
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, '/favicon.ico']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    )).then(() => {
      // الـ Crawler بيبدأ هنا بمجرد التنشيط
      return caches.open(CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          ESSENTIAL_ASSETS.map((url) => 
            fetch(url, { priority: 'low' }) // أولوية منخفضة عشان م يأثرش على سرعة الصفحة الحالية
              .then((res) => {
                if (res.ok) cache.put(url, res);
              })
              .catch(() => null)
          )
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
    url.pathname.startsWith('/api/') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // استراتيجية: لو في الكاش هاته، لو مش فيه روح للنت، ولو النت مقطوع روح لصفحة الأوفلاين
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        })
        .catch(async () => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
          }
          return new Response(null, { status: 404 });
        });

      return cachedResponse || fetchPromise;
    })
  );
});