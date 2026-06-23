import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // تسجيل موعد الفتح
    await Preferences.set({
      key: 'last_open_date',
      value: new Date().toString().substring(0, 10),
    });

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 1. مزامنة اللغة (مهم جداً للترجمة)
    const currentLang = localStorage.getItem('language') || localStorage.getItem('app_lang') || 'ar';
    await Preferences.set({ key: 'language', value: currentLang });

    // 2. مزامنة الحالة العامة
    const savedMaster = localStorage.getItem('masterNotifications') !== 'false';
    await Preferences.set({ key: 'masterNotifications', value: String(savedMaster) });

    // 3. مزامنة الإعدادات التفصيلية (الأوقات)
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
    }

    // 4. مزامنة الستريك
    const currentStreak = localStorage.getItem('userStreak') || '0';
    await Preferences.set({ key: 'userStreak', value: String(currentStreak) });

    // 5. مزامنة الخطط الدراسية (هذا ما كان ينقصك)
    const studySummary = localStorage.getItem('studyPlansSummary');
    if (studySummary) {
      await Preferences.set({ key: 'studyPlansSummary', value: studySummary });
    }

    // تحديث المنبهات في أندرويد فوراً باللغة والبيانات الجديدة
    if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};