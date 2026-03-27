"use client";
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';

export default function CapacitorFeatures() {
  const router = useRouter();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || hasSetup.current) return;
    hasSetup.current = true;

    const setupNativeFeatures = async () => {
      try {
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true });

        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#191d34' });

        const localPerms = await LocalNotifications.requestPermissions();
        
        if (localPerms.display === 'granted') {
          const isEnabled = localStorage.getItem('dailyReminder') !== 'false';

          if (isEnabled) {
            const response = await fetch('/data/dailyVerses/ar.json');
            const allVerses = await response.json();
            const today = new Date();
            const m = today.getMonth() + 1;
            const d = today.getDate();
            const todayVerse = allVerses.find(v => v.month === m && v.day === d) || allVerses[0];

            await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });

            await LocalNotifications.schedule({
              notifications: [
                {
                  title: "وقت القراءة",
                  body: "هل قمت بقراءتك اليومية؟",
                  id: 1,
                  smallIcon: "ic_stat_ic_notification",
                  schedule: { on: { hour: 10, minute: 0 }, repeats: true },
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
                  schedule: { at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
                  extra: { url: "/" }
                }
              ]
            });
          }
        }

        let pushPerms = await PushNotifications.checkPermissions();
        if (pushPerms.receive === 'prompt') {
          pushPerms = await PushNotifications.requestPermissions();
        }

        if (pushPerms.receive === 'granted') {
          await PushNotifications.register();
        }

        await PushNotifications.addListener('registration', (token) => {
          console.log('Push token:', token.value);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = action.notification.data?.url;
          if (url) router.push(url);
        });

        await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
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