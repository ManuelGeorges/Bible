"use client";
import { useEffect, useRef } from 'react'; // ضفنا useRef
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export default function CapacitorFeatures() {
  const router = useRouter();
  const hasSetup = useRef(false); // حماية عشان الكود ميتكررش مرتين ورا بعض

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || hasSetup.current) return;
    hasSetup.current = true;

    const setupNativeFeatures = async () => {
      try {
        // 1. تظبيط الستاتس بار
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0f172a' });

        // 2. طلب صلاحيات الإشعارات المحلية
        const perms = await LocalNotifications.requestPermissions();
        if (perms.display !== 'granted') return;

        const isEnabled = localStorage.getItem('dailyReminder') !== 'false';

        if (isEnabled) {
          const response = await fetch('/data/dailyVerses/ar.json');
          const allVerses = await response.json();
          const today = new Date();
          const m = today.getMonth() + 1;
          const d = today.getDate();
          const todayVerse = allVerses.find(v => v.month === m && v.day === d) || allVerses[0];

          // مسح القديم قبل جدولة الجديد
          await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });

          await LocalNotifications.schedule({
            notifications: [
              {
                title: "وقت القراءة",
                body: "هل قمت بقراءتك اليومية؟",
                id: 1,
                // التصحيح: شيلنا كلمة drawable
                smallIcon: "ic_stat_ic_notification", 
                schedule: { on: { hour: 10, minute: 0 }, repeats: true }, // شيلنا allowWhileIdle مؤقتاً للتجربة
                extra: { url: "/StudyPlans" }
              },
              {
                title: "آية اليوم ✨",
                body: todayVerse.verse,
                id: 2,
                smallIcon: "ic_stat_ic_notification",
                schedule: { on: { hour: 6, minute: 0 }, repeats: true },
                extra: { url: "/" }
              },
              {
                title: "افتقدناك!",
                body: "لم نرك منذ 3 أيام، ما رأيك في قراءة سريعة؟",
                id: 3,
                smallIcon: "ic_stat_ic_notification",
                // التأكد إن الوقت في المستقبل
                schedule: { at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
                extra: { url: "/" }
              }
            ]
          });
        }

        // 3. Push Notifications (اختياري لو مش محتاجه دلوقتي)
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'granted') {
           await PushNotifications.register();
        }

        // المستمعين (Listeners)
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          const url = action.notification.extra?.url;
          if (url) router.push(url);
        });

      } catch (error) {
        console.error('Native features error:', error);
      }
    };

    setupNativeFeatures();
  }, [router]);

  return null;
}