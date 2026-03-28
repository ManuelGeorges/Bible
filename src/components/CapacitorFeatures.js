"use client";
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';
import { KeepAwake } from '@capacitor-community/keep-awake';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme } = useTheme();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || hasSetup.current) return;
    hasSetup.current = true;

    const setupNativeFeatures = async () => {
      try {
        await KeepAwake.keepAwake();
        
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true });

        const currentTheme = theme || localStorage.getItem('theme') || 'system';
        const isDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        try {
          await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
          await StatusBar.setBackgroundColor({ color: isDark ? '#0f172a' : '#ffffff' });
        } catch (e) {}

        let localPerms = await LocalNotifications.checkPermissions();
        if (localPerms.display === 'prompt') {
          localPerms = await LocalNotifications.requestPermissions();
        }

        if (localPerms.display === 'granted') {
          const savedNotifs = localStorage.getItem('notificationSettings');
          const settings = savedNotifs ? JSON.parse(savedNotifs) : { 
            dailyVerse: true, dailyVerseTime: '06:00',
            dailyQuestion: true, dailyQuestionTime: '18:00',
            studyPlans: true, studyPlansTime: '10:00'
          };

          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
          }

          const toSchedule = [];
          const resV = await fetch('/data/dailyVerses.json');
          const verses = await resV.json();
          const resQ = await fetch('/data/dailyQuestions.json');
          const questions = await resQ.json();

          for (let i = 0; i < 30; i++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + i);
            const m = targetDate.getMonth() + 1;
            const d = targetDate.getDate();

            const vData = verses.find(v => v.month === m && v.day === d) || verses[0];
            const qData = questions.find(q => q.month === m && q.day === d) || questions[0];

            if (settings.dailyVerse) {
              const [vh, vmin] = settings.dailyVerseTime.split(':').map(Number);
              const vDate = new Date(targetDate);
              vDate.setHours(vh, vmin, 0, 0);
              if (vDate > new Date()) {
                toSchedule.push({
                  title: "آية اليوم ✨",
                  body: `${vData.verse} ${vData.reference}`,
                  id: 100 + i,
                  smallIcon: "ic_stat_ic_notification",
                  schedule: { at: vDate },
                  extra: { url: "/" }
                });
              }
            }

            if (settings.dailyQuestion) {
              const [qh, qmin] = settings.dailyQuestionTime.split(':').map(Number);
              const qDate = new Date(targetDate);
              qDate.setHours(qh, qmin, 0, 0);
              if (qDate > new Date()) {
                toSchedule.push({
                  title: "سؤال اليوم 💡",
                  body: qData.question,
                  id: 200 + i,
                  smallIcon: "ic_stat_ic_notification",
                  schedule: { at: qDate },
                  extra: { url: "/competitions" }
                });
              }
            }
          }

          if (settings.studyPlans) {
            const [sh, smin] = settings.studyPlansTime.split(':').map(Number);
            toSchedule.push({
              title: "وقت القراءة 📖",
              body: "هل أتممت وردك اليومي من الكتاب المقدس؟",
              id: 1,
              smallIcon: "ic_stat_ic_notification",
              schedule: { on: { hour: sh, minute: smin }, repeats: true },
              extra: { url: "/studyPlans" }
            });
          }

          if (toSchedule.length > 0) {
            await LocalNotifications.schedule({ notifications: toSchedule });
          }
        }

        await PushNotifications.addListener('registration', (token) => {
          console.log('Push Token:', token.value);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const url = notification.notification.data.url;
          if (url) router.push(url);
        });

        let pushPerms = await PushNotifications.checkPermissions();
        if (pushPerms.receive === 'prompt') {
          pushPerms = await PushNotifications.requestPermissions();
        }
        
        if (pushPerms.receive === 'granted') {
          await PushNotifications.register();
        }

      } catch (error) {
        console.error('Native features error:', error);
      }
    };

    setupNativeFeatures();
  }, [router, theme]);

  return null;
}