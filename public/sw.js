const CACHE_NAME = 'agios-data-cache-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // استهداف ملفات الـ JSON والبيانات تحديداً
  if (url.pathname.endsWith('.json') || url.pathname.includes('/data/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            // خزن النسخة الجديدة دايماً وأنت أونلاين
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => {
            // لو أوفلاين، هاتها من الكاش
            return cache.match(event.request);
          });
      })
    );
    return;
  }

  // كود المعالجة العادي لبقية الموقع
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request);
    })
  );
});