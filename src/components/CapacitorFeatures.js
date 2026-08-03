'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Toast } from '@capacitor/toast';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import { AppReview } from '@capawesome/capacitor-app-review';
import { fetchAndActivate, getNumber } from 'firebase/remote-config';
import { getFirebaseRemoteConfig } from '../lib/firebase';
import { syncNotifications } from '../lib/notificationService';
import { useLanguage } from '../app/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { initBackgroundSync } from '../lib/SyncService';

export default function CapacitorFeatures() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const hasSetup = useRef(false);
  const lastBackPress = useRef(0);
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

  // تحديث الإشعارات عند تغيير اللغة
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'web' || platform === 'electron') return;

    // تمرير اللغة الحالية لضمان تحديث الإشعارات فوراً باللغة الصحيحة
    syncNotifications(language).catch(() => {});
  }, [language]);

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
      // التعامل مع زر الرجوع
      App.addListener('backButton', async ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          const now = Date.now();
          // إذا كانت الضغطة الثانية في أقل من ثانيتين
          if (now - lastBackPress.current < 2000) {
            App.exitApp();
          } else {
            lastBackPress.current = now;
            await Toast.show({
              text: language === 'ar' ? 'اضغط مرة أخرى للخروج' : 'Press back again to exit',
              duration: 'short',
            });
          }
        }
      });

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

        // عند وصول إشعار والتطبيق مفتوح (هام لـ iOS)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const url = notification.notification.data?.url;
          handleNavigation(url);
        });
      }

      // تهيئة المزامنة عند الخروج
      initBackgroundSync();
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
        // تم نقل syncNotifications إلى useEffect منفصل مع تبعية اللغة
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
  }, [router, language]);

  return (
    <AnimatePresence>
      {showUpdateModal && (
        <div className="update-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="update-modal"
          >
            <div className="update-icon-container">
              <RefreshCw size={40} className="animate-spin" style={{ animationDuration: '3s' }} />
            </div>

            <h2 className="update-title">تحديث جديد متاح!</h2>
            <p className="update-text">
              تم تحميل التحديث بنجاح. هل تود إعادة تشغيل التطبيق الآن لتجربة الميزات الجديدة؟
            </p>

            <div className="update-actions">
              <button
                onClick={async () => {
                  setShowUpdateModal(false);
                  try {
                    await AppUpdate.completeFlexibleUpdate();
                  } catch (e) {
                    console.error("Complete Update Error:", e);
                  }
                }}
                className="update-btn-primary clickable flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                تحديث الآن
              </button>

              <button
                onClick={() => setShowUpdateModal(false)}
                className="update-btn-secondary clickable"
              >
                ليس الآن، لاحقاً
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
