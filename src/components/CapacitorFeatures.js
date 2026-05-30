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
import toast from 'react-hot-toast';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hasSetup = useRef(false);

  // دالة موحدة للتعامل مع التوجيه من الإشعارات أو الروابط
  const handleNavigation = (path) => {
    if (!path) return;

    try {
      // إذا كان رابطاً كاملاً يبدأ بـ http، نفتحه في المتصفح، وإلا نوجه داخلياً
      if (path.startsWith('http')) {
        window.open(path, '_blank');
      } else {
        // التأكد من أن المسار يبدأ بـ /
        const targetPath = path.startsWith('/') ? path : `/${path}`;
        router.push(targetPath);
      }
    } catch (e) {
      console.error("Navigation Error:", e);
    }
  };

  // رسالة تنبيه بوجود تحديث جاهز للتثبيت
  const showUpdatePrompt = () => {
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4 border-2 border-indigo-500/20`}
          dir="rtl"
        >
          <div className="flex-1">
            <div className="flex items-start">
              <div className="ml-3 flex-1">
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  تحديث جديد جاهز! ✨
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  تم تحميل التحديث بنجاح. هل تود إعادة تشغيل التطبيق الآن لتجربة الميزات الجديدة؟
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    await AppUpdate.completeFlexibleUpdate();
                  } catch (e) {
                    console.error("Complete Update Error:", e);
                  }
                }}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                تحديث الآن
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                ليس الآن
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'bottom-center' }
    );
  };

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
        if (platform === 'android') {
          const isDark = 
            theme === 'dark' || 
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          
          if (isDark) {
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#0f172a' });
          } else {
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
    const platform = Capacitor.getPlatform();
    if (platform === 'web' || platform === 'electron' || hasSetup.current) return;
    hasSetup.current = true;

    // 1. تسجيل مستمعات الإشعارات والروابط والتحديثات
    const setupListeners = async () => {
      // روابط Deep Links
      App.addListener('appUrlOpen', (data) => {
        const path = data.url.split('://')[1];
        if (path) handleNavigation(path);
      });

      // الإشعارات المحلية
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const url = notification.notification.extra?.url;
        handleNavigation(url);
      });

      // مراقبة حالة التحديث Flexible Update
      AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
        if (state.installStatus === 11) { // 11 = DOWNLOADED
          showUpdatePrompt();
        }
      });

      // إشعارات الـ Push
      let pushPerms = await PushNotifications.checkPermissions().catch(() => ({ receive: 'prompt' }));
      if (pushPerms.receive === 'prompt') pushPerms = await PushNotifications.requestPermissions().catch(() => ({ receive: 'denied' }));

      if (pushPerms.receive === 'granted') {
        await PushNotifications.register().catch(() => {});

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const url = notification.notification.data?.url;
          handleNavigation(url);
        });
      }
    };

    const handleAppUpdate = async () => {
      try {
        const remoteConfig = await getFirebaseRemoteConfig().catch(() => null);
        if (!remoteConfig) return;
        remoteConfig.settings.minimumFetchIntervalMillis = 600000;
        await fetchAndActivate(remoteConfig).catch(() => {});
        
        const minRequiredVersion = getNumber(remoteConfig, 'min_required_version') || 0;
        const appInfo = await App.getInfo().catch(() => ({ build: '0' }));
        const currentVersionCode = parseInt(appInfo.build || '0') || 0;

        const updateInfo = await AppUpdate.getAppUpdateInfo().catch(() => null);
        
        if (updateInfo) {
          // إذا كان التحديث محملاً مسبقاً وجاهزاً
          if (updateInfo.installStatus === 11) {
            showUpdatePrompt();
            return;
          }

          if (updateInfo.updateAvailability === 2) { // 2 = UPDATE_AVAILABLE
            if (currentVersionCode < minRequiredVersion) {
              // تحديث إجباري للنسخ القديمة جداً
              await AppUpdate.performImmediateUpdate().catch(() => {});
            } else {
              // تحديث مرن في الخلفية للنسخ الحديثة
              if (updateInfo.installStatus !== 1) { // 1 = PENDING
                await AppUpdate.startFlexibleUpdate().catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        console.error("Update Logic Error:", e);
      }
    };

    const init = async () => {
      try {
        await KeepAwake.keepAwake().catch(() => {});
        await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true }).catch(() => {});

        await setupListeners();
        await handleAppUpdate();
        await syncNotifications().catch(() => {});
      } catch (e) {
        console.error("Init Error:", e);
      }
    };

    init();

    // منطق تقييم التطبيق
    const interval = setInterval(async () => {
      const totalSeconds = parseInt(localStorage.getItem('total_usage_seconds') || '0');
      const newTotal = totalSeconds + 30;
      localStorage.setItem('total_usage_seconds', newTotal.toString());

      if (newTotal >= 1800 && localStorage.getItem('review_asked') !== 'true') {
        try {
          await AppReview.requestReview();
          localStorage.setItem('review_asked', 'true');
        } catch (e) {}
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      try {
        App.removeAllListeners();
        LocalNotifications.removeAllListeners();
        PushNotifications.removeAllListeners();
        // إزالة مستمع التحديثات عند التدمير
        AppUpdate.removeAllListeners();
      } catch (e) {}
    };
  }, [router]);

  return null;
}