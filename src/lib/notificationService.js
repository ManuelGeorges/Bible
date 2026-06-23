import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getAuth } from "firebase/auth";

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // تسجيل آخر موعد فتح للتطبيق
    await Preferences.set({
      key: 'last_open_date',
      value: new Date().toString().substring(0, 10),
    });

    // التأكد من الصلاحيات
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requestResult = await LocalNotifications.requestPermissions();
      if (requestResult.display !== 'granted') return;
    }

    // مزامنة حالة التفعيل الرئيسية
    const savedMaster = localStorage.getItem('masterNotifications') !== 'false'; // افتراضي true
    await Preferences.set({ key: 'masterNotifications', value: String(savedMaster) });

    // مزامنة اللغة
    const currentLang = localStorage.getItem('app_lang') || 'ar';
    await Preferences.set({ key: 'language', value: currentLang });

    // مزامنة الإعدادات التفصيلية
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
    }

    // مزامنة الستريك (Streak)
    const currentStreak = localStorage.getItem('userStreak') || '0';
    await Preferences.set({ key: 'userStreak', value: String(currentStreak) });

    // استدعاء التحديث في أندرويد مع تمرير اللغة
    if (window.AgiosScannerNative?.updateSettings) {
        window.AgiosScannerNative.updateSettings(
            savedSettings || "{}",
            savedMaster,
            currentLang
        );
    } else if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};