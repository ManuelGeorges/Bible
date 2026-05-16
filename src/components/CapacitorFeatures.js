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
import { fetchAndActivate, getNumber } from 'firebase/remote-config';
import { getFirebaseRemoteConfig } from '../lib/firebase';
import { syncNotifications } from '../lib/notificationService';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem('theme')) {
      setTheme('system');
    }
  }, [setTheme]);

  // تحديث الـ StatusBar بناءً على الـ resolvedTheme لضمان الدقة
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'web' || platform === 'electron') return;

    const updateStatusBar = async () => {
      try {
        // resolvedTheme ستكون إما 'dark' أو 'light' دائماً
        const isDark = resolvedTheme === 'dark';

        if (isDark) {
          // في الـ Dark Mode: الأيقونات بيضاء (Style.Light)
          await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
          if (platform === 'android') {
            await StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
          }
        } else {
          // في الـ Light Mode: الأيقونات سوداء (Style.Dark)
          await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          if (platform === 'android') {
            await StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("StatusBar style update failed:", e);
      }
    };

    updateStatusBar();
  }, [resolvedTheme]); // الاعتماد على resolvedTheme هو السر هنا

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'web' || platform === 'electron' || hasSetup.current) return;
    hasSetup.current = true;

    const handleAppUpdate = async () => {
      if (process.env.NODE_ENV === 'development') return;

      try {
        const remoteConfig = await getFirebaseRemoteConfig();
        if (!remoteConfig) return;

        await fetchAndActivate(remoteConfig).catch(() => {});
        const minRequiredVersion = getNumber(remoteConfig, 'min_required_version') || 0;

        const appInfo = await App.getInfo();
        const currentVersionCode = parseInt(appInfo.build || '0') || 0;

        const updateInfo = await AppUpdate.getAppUpdateInfo().catch(() => null);
        
        if (updateInfo) {
          if (updateInfo.installStatus === 11) {
            await AppUpdate.completeFlexibleUpdate().catch(() => {});
            return;
          }
          if (updateInfo.updateAvailability === 2) {
            if (currentVersionCode < minRequiredVersion) {
              await AppUpdate.performImmediateUpdate().catch(() => {});
            } else {
              if (updateInfo.installStatus !== 1) {
                await AppUpdate.startFlexibleUpdate().catch(() => {});
              }
            }
          }
        }
      } catch (e) {}
    };

    const setupUIAndNotifications = async () => {
      try {
        KeepAwake.keepAwake().catch(() => {});
        FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true }).catch(() => {});

        await LocalNotifications.removeAllListeners().catch(() => {});
        await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          const url = notification.notification.extra?.url;
          if (url) router.push(url);
        }).catch(() => {});

        let pushPerms = await PushNotifications.checkPermissions().catch(() => ({ receive: 'denied' }));
        if (pushPerms.receive === 'prompt') {
          pushPerms = await PushNotifications.requestPermissions().catch(() => ({ receive: 'denied' }));
        }

        if (pushPerms.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          await PushNotifications.removeAllListeners().catch(() => {});
          await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const url = notification.notification.data?.url;
            if (url) router.push(url);
          }).catch(() => {});
        }
      } catch (e) {}
    };

    const init = async () => {
      await Promise.allSettled([
        handleAppUpdate(),
        setupUIAndNotifications(),
        syncNotifications()
      ]);
    };

    init();

    return () => {
      LocalNotifications.removeAllListeners().catch(() => {});
      PushNotifications.removeAllListeners().catch(() => {});
    };
  }, [router]);

  return null;
}
