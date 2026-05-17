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
import { getFirebaseRemoteConfig } from '../lib/firebase';
import { syncNotifications } from '../lib/notificationService';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem('theme')) {
      setTheme('system');
    }
  }, [setTheme]);

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'web' || platform === 'electron') return;

    const updateStatusBar = async () => {
      try {
        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        if (isDark) {
          // الدارك مود: أيقونات بيضاء
          await StatusBar.setStyle({ style: Style.Light });
          if (platform === 'android') {
            await StatusBar.setBackgroundColor({ color: '#0f172a' });
          }
        } else {
          // اللايت مود: أيقونات سوداء
          await StatusBar.setStyle({ style: Style.Dark });
          if (platform === 'android') {
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
        console.warn("AppUpdate is not available on this environment (likely Simulator).");
      }
    };

    const setupUIAndNotifications = async () => {
      try {
        await KeepAwake.keepAwake().catch(() => {});
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true }).catch(() => {});

        await LocalNotifications.removeAllListeners();
        await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          const url = notification.notification.extra?.url;
          if (url) router.push(url);
        });

        let pushPerms = await PushNotifications.checkPermissions();
        if (pushPerms.receive === 'prompt') pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          await PushNotifications.removeAllListeners();
          await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const url = notification.notification.data?.url;
            if (url) router.push(url);
          });
        }
      } catch (e) {
        console.error("UI/Notification Error:", e);
      }
    };

    const init = async () => {
      await handleAppUpdate();
      await setupUIAndNotifications();
      await syncNotifications();
    };

    init();

    return () => {
      LocalNotifications.removeAllListeners();
      PushNotifications.removeAllListeners();
    };
  }, [router]);

  return null;
}
