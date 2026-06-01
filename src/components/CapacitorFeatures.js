'use client';
import { useEffect, useRef, useState } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hasSetup = useRef(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // دالة موحدة للتعامل مع التوجيه من الإشعارات أو الروابط
  const handleNavigation = (path) => {
    if (!path) return;

    try {
      if (path.startsWith('http')) {
        window.open(path, '_blank');
      } else {
        const targetPath = path.startsWith('/') ? path : `/${path}`;
        router.push(targetPath);
      }
    } catch (e) {
      console.error("Navigation Error:", e);
    }
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

    const setupListeners = async () => {
      App.addListener('appUrlOpen', (data) => {
        const path = data.url.split('://')[1];
        if (path) handleNavigation(path);
      });

      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const url = notification.notification.extra?.url;
        handleNavigation(url);
      });

      AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
        if (state.installStatus === 11) { // 11 = DOWNLOADED
          setShowUpdateModal(true);
        }
      });

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
          if (updateInfo.installStatus === 11) {
            setShowUpdateModal(true);
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
        AppUpdate.removeAllListeners();
      } catch (e) {}
    };
  }, [router]);

  return (
    <AnimatePresence>
      {showUpdateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden border border-indigo-500/20"
            dir="rtl"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 border border-indigo-200 dark:border-indigo-800">
                <RefreshCw size={40} className="text-indigo-600 dark:text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                تحديث جديد جاهز! ✨
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                تم تحميل التحديث بنجاح. هل تود إعادة تشغيل التطبيق الآن لتجربة الميزات الجديدة؟
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    setShowUpdateModal(false);
                    try {
                      await AppUpdate.completeFlexibleUpdate();
                    } catch (e) {
                      console.error("Complete Update Error:", e);
                    }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  تحديث الآن
                </button>

                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="w-full py-3 text-slate-500 dark:text-slate-400 font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  ليس الآن، لاحقاً
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
