import { LocalNotifications } from '@capacitor/local-notifications';

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getAuth } from "firebase/auth";
@@ -7,18 +8,21 @@ export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // تسجيل آخر موعد فتح للتطبيق
    await Preferences.set({
      key: 'last_open_date',
      value: new Date().toString().substring(0, 10),
    });


    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requestResult = await LocalNotifications.requestPermissions();
      if (requestResult.display !== 'granted') return;
    }




    const auth = getAuth();
    const user = auth.currentUser;
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';
@@ -34,29 +38,75 @@ export const syncNotifications = async () => {
      return;
    }

    // إذا لم يكن هناك مستخدم، لا نمسح التنبيهات بل نكتفي بتحديث الأساسيات (آية اليوم)
    if (!user) {
        if (window.AgiosScannerNative?.refreshAlarms) window.AgiosScannerNative.refreshAlarms();
        return;
    }

    // مزامنة الستريك
    const currentStreak = localStorage.getItem('userStreak');
    if (currentStreak) {
      await Preferences.set({ key: 'userStreak', value: String(currentStreak) });
    }

    // مزامنة الإعدادات التفصيلية
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
    }

    if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};