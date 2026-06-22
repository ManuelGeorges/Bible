"use client";
import { useEffect } from 'react';

export default function BibleCacheHandler() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('caches' in window)) return;

    const visited = new Set();
    const CACHE_NAME = 'agios-v1';
    const MAX_PAGES = 200;
    const MAX_DEPTH = 5;

    const deepCrawl = async (url, depth = 0) => {
      if (visited.has(url) || visited.size > MAX_PAGES || depth > MAX_DEPTH) return;
      if (!url.startsWith(window.location.origin) || url.includes('#')) return;

      visited.add(url);

      try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(url, { priority: 'low' });
        
        if (!response.ok) return;
        await cache.put(url, response.clone());

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/html')) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const assets = [
            ...Array.from(doc.querySelectorAll('a')).map(el => el.href),
            ...Array.from(doc.querySelectorAll('img')).map(el => el.src),
            ...Array.from(doc.querySelectorAll('link[rel*="icon"]')).map(el => el.href),
            ...Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(el => el.href),
            ...Array.from(doc.querySelectorAll('script[src]')).map(el => el.src),
          ];

          const urlObj = new URL(url);
          if (urlObj.pathname !== '/') {
             assets.push(`${window.location.origin}/_next/data/latest${urlObj.pathname}.json`);
             assets.push(`${window.location.origin}/_next/data/build-id${urlObj.pathname}.json`);
          }

          const cleanAssets = [...new Set(assets)]
            .map(a => {
              try { return new URL(a, window.location.origin).href; } catch(e) { return null; }
            })
            .filter(a => a && a.startsWith(window.location.origin));

          for (const asset of cleanAssets) {
            const isPage = !asset.match(/\.(jpg|jpeg|png|gif|css|js|json|ico)$/i);
            
            if (isPage) {
              await new Promise(res => setTimeout(res, 300));
              await deepCrawl(asset, depth + 1);
            } else {
              const fileCache = await caches.open(CACHE_NAME);
              fetch(asset, { priority: 'low' }).then(res => {
                if (res.ok) fileCache.put(asset, res);
              }).catch(() => {});
            }
          }
        }
      } catch (e) {}
    };

    const startTotalScraping = async () => {
      await new Promise(res => setTimeout(res, 3000));
      
      // تم تحديث القائمة لإزالة ملفات الترجمة التي نُقلت إلى src/data
      // لأنها الآن تُحمل ديناميكياً عبر Webpack وليس عبر fetch مباشر من public
      const staticEssentials = [
        '/data/bookNames.json',
        '/data/dailyVerses.json',
        '/favicon.ico',
        '/manifest.json'
      ];

      const cache = await caches.open(CACHE_NAME);

      for (const file of staticEssentials) {
        try {
          const response = await fetch(file, { 
            priority: 'high',
            cache: 'reload'
          });
          if (response.ok) {
            await cache.put(file, response);
          }
        } catch (err) {}
        await new Promise(res => setTimeout(res, 200));
      }

      deepCrawl(window.location.origin);
    };

    if (document.readyState === 'complete') {
      startTotalScraping();
    } else {
      window.addEventListener('load', startTotalScraping);
    }
  }, []);

  return null;
}
