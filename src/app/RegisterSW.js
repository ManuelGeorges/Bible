"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    if ("serviceWorker" in navigator) {
      // ضفنا رقم نسخة (timestamp) عشان نجبر المتصفح يحمل الملف من السيرفر مش الكاش
      const swUrl = `/sw.js?v=${new Date().getTime()}`;

      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          // دي بتخلي الـ Service Worker يتحدث في الخلفية أول ما تفتح الأبلكيشن
          reg.update(); 

          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // لو فيه تحديث جديد، بننبه المستخدم أو بنعمل ريلود
                  console.log("New content is available; please refresh.");
                  window.location.reload();
                }
              };
            }
          };
        })
        .catch((err) => console.log("Service Worker Failed", err));
        
      // حركة إضافية: لو الـ SW قديم، اجبره يعمل تحديث كل ما الصفحة تتفتح
      navigator.serviceWorker.ready.then((reg) => {
        reg.update();
      });
    }
  }, []);

  return null;
}