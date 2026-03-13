const CACHE_NAME = 'agios-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clientsClaim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. تجاهل ملفات التطوير والتحليلات تماماً عشان السرعة
  if (
    url.pathname.includes('_next/webpack-hmr') ||
    url.hostname.includes('google-analytics') ||
    !event.request.url.startsWith('http')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 2. لو الحاجة في الكاش، رجعها فوراً (سرعة صاروخية)
      if (cachedResponse) return cachedResponse;

      // 3. لو مش في الكاش، روح هاتها من النت
      return fetch(event.request)
        .then((networkResponse) => {
          // خزن نسخة لو الطلب ناجح ومن نوع GET
          if (networkResponse.status === 200 && event.request.method === 'GET') {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          // 4. الحل السحري للأوفلاين: لو مفيش نت، رجع الـ Home page بدل ما "تعلق"
          if (event.request.mode === 'navigate' || url.search.includes('_rsc')) {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});