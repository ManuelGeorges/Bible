'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import { AppReview } from '@capawesome/capacitor-app-review';
import { fetchAndActivate, getNumber } from 'firebase/remote-config';
import { remoteConfig } from '../lib/firebase';
import { syncNotifications } from '../lib/notificationService';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hasSetup = useRef(false);

  // جعل الثيم الافتراضي هو النظام عند أول تحميل
  useEffect(() => {
    if (!localStorage.getItem('theme')) {
      setTheme('system');
    }
  }, [setTheme]);

  // حل مشكلة الـ StatusBar وتناسق الخلفية مع الأيقونات
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateStatusBar = async () => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          // التحقق مما إذا كان النظام أو الاختيار الحالي هو "Dark"
          const isDark = 
            theme === 'dark' || 
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          
          if (isDark) {
            // أيقونات بيضاء على خلفية غامقة
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#0f172a' });
          } else {
            // أيقونات سوداء على خلفية بيضاء
            await StatusBar.setStyle({ style: Style.Light });
            await StatusBar.setBackgroundColor({ color: '#ffffff' });
          }
        }
      } catch (e) {
        console.error("StatusBar Error:", e);
      }
    };

    updateStatusBar();
  }, [theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || hasSetup.current) return;
    hasSetup.current = true;

    const handleAppUpdate = async () => {
      try {
        if (!remoteConfig) return;
        remoteConfig.settings.minimumFetchIntervalMillis = 600000;
        await fetchAndActivate(remoteConfig).catch(() => {});
        
        const minRequiredVersion = getNumber(remoteConfig, 'min_required_version') || 0;
        const appInfo = await App.getInfo();
        const currentVersionCode = parseInt(appInfo.build);

        await AppUpdate.addListener('onFlexibleUpdateStateChanged', async (state) => {
          if (state.installStatus === 11) {
            await AppUpdate.completeFlexibleUpdate();
          }
        });

        const updateInfo = await AppUpdate.getAppUpdateInfo().catch(() => null);
        
        if (updateInfo) {
          if (updateInfo.installStatus === 11) {
            await AppUpdate.completeFlexibleUpdate();
            return;
          }
          if (updateInfo.updateAvailability === 2) {
            if (currentVersionCode < minRequiredVersion) {
              await AppUpdate.performImmediateUpdate();
            } else {
              if (updateInfo.installStatus !== 1) {
                await AppUpdate.startFlexibleUpdate();
              }
            }
          }
        }
      } catch (e) {
        console.error("Update Error:", e);
      }
    };

    const setupUIAndNotifications = async () => {
      try {
        await KeepAwake.keepAwake().catch(() => {});
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true }).catch(() => {});

        await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          const url = notification.notification.extra?.url;
          if (url) router.push(url);
        });

        let pushPerms = await PushNotifications.checkPermissions();
        if (pushPerms.receive === 'prompt') pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const url = notification.notification.data?.url;
            if (url) router.push(url);
          });
        }
      } catch (e) {
        console.error("UI/Notification Error:", e);
      }
    };

    const handleReviewLogic = () => {
      const interval = setInterval(async () => {
        const totalSeconds = parseInt(localStorage.getItem('total_usage_seconds') || '0');
        const newTotal = totalSeconds + 30;
        localStorage.setItem('total_usage_seconds', newTotal.toString());

        const alreadyAsked = localStorage.getItem('review_asked') === 'true';
        
        if (newTotal >= 1800 && !alreadyAsked) {
          try {
            await AppReview.requestReview();
            localStorage.setItem('review_asked', 'true');
            clearInterval(interval);
          } catch (e) {
            console.error("Review Error:", e);
          }
        }
      }, 30000);

      return interval;
    };

    const init = async () => {
      await handleAppUpdate();
      await setupUIAndNotifications();
      await syncNotifications();
    };

    init();
    const reviewInterval = handleReviewLogic();

    return () => {
      clearInterval(reviewInterval);
      LocalNotifications.removeAllListeners();
      PushNotifications.removeAllListeners();
    };
  }, [router]);

  return null;
}