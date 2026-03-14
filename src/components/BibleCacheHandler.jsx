"use client";
import { useEffect } from 'react';

export default function BibleCacheHandler() {
  useEffect(() => {
    const autoDownloadEverything = async () => {
      if (!('caches' in window)) return;

      // 1. تحميل كل الروابط الموجودة في الصفحة الحالية تلقائياً (الصفحات)
      const allLinks = Array.from(document.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.startsWith('/') && !href.includes(':'));

      // 2. محاولة استنتاج ملفات الـ JSON (لو عندك قائمة بها أو روابطها في الكود)
      // هنا سنقوم بعمل fetch لكل الروابط والملفات المكتشفة
      const assetsToCache = [...new Set([...allLinks, '/data/bookNames.json', '/data/bibles/ar_svd.json'])];

      assetsToCache.forEach(async (path) => {
        try {
          // اطلب الملف/الصفحة في الخلفية، الـ Service Worker سيقوم بحفظها تلقائياً
          await fetch(path, { priority: 'low' });
        } catch (e) {
          // تجاهل الأخطاء للملفات غير الموجودة
        }
      });

      console.log("البرنامج يقوم الآن بمزامنة كافة الملفات والبيانات للعمل أوفلاين...");
    };

    // انتظر قليلاً بعد التحميل لعدم التأثير على سرعة البداية
    const timer = setTimeout(autoDownloadEverything, 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}