'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import { fetchAndActivate, getNumber } from 'firebase/remote-config';
import { remoteConfig } from '../lib/firebase';
import { syncNotifications } from '../lib/notificationService';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme } = useTheme();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || hasSetup.current) return;
    hasSetup.current = true;

    const handleAppUpdate = async () => {
      try {
        if (!remoteConfig) return;
        remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
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
        if (updateInfo && updateInfo.updateAvailability === 2) {
          if (currentVersionCode < minRequiredVersion) {
            await AppUpdate.performImmediateUpdate();
          } else {
            await AppUpdate.startFlexibleUpdate();
          }
        }
      } catch (e) {
        console.error("Update Error:", e);
      }
    };

    const setupUIAndPush = async () => {
      try {
        await KeepAwake.keepAwake().catch(() => {});
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true }).catch(() => {});

        const currentTheme = theme || localStorage.getItem('theme') || 'system';
        const isDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
          await StatusBar.setBackgroundColor({ color: isDark ? '#0f172a' : '#ffffff' }).catch(() => {});
        }

        let pushPerms = await PushNotifications.checkPermissions();
        if (pushPerms.receive === 'prompt') pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const url = notification.notification.data.url;
            if (url) router.push(url);
          });
        }
      } catch (e) {
        console.error("UI/Push Error:", e);
      }
    };

    const init = async () => {
      await handleAppUpdate();
      await setupUIAndPush();
      await syncNotifications();
    };

    init();
  }, [router, theme]);

  return null;
}