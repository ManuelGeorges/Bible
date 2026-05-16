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

    // خطوة 3: طلب الإذن بشكل صريح لـ iOS وأندرويد 13+
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requestResult = await LocalNotifications.requestPermissions();
      if (requestResult.display !== 'granted') return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';

    // مزامنة حالة التنبيهات العامة (Master Toggle)
    await Preferences.set({ key: 'masterNotifications', value: String(savedMaster) });

    if (!savedMaster || !user) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      // إبلاغ النظام الأصلي بالتحديث
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
      // حفظ النسخة الكاملة لكي يقرأها الـ Swift في iOS
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
      
      const settings = JSON.parse(savedSettings);
      // حفظ المفاتيح الفردية لكي يقرأها الجافا في أندرويد
      await Preferences.set({ key: 'dailyVerse', value: String(settings.verse ?? true) });
      await Preferences.set({ key: 'dailyVerseTime', value: settings.verseTime || '06:00' });
      await Preferences.set({ key: 'dailyQuestion', value: String(settings.question ?? true) });
      await Preferences.set({ key: 'dailyQuestionTime', value: settings.questionTime || '18:00' });
      await Preferences.set({ key: 'studyPlans', value: String(settings.studyPlans ?? true) });
      await Preferences.set({ key: 'studyPlansTime', value: settings.studyPlansTime || '10:00' });
      await Preferences.set({ key: 'streakReminder', value: String(settings.streak ?? true) });
      await Preferences.set({ key: 'streakReminderTime', value: settings.streakTime || '21:00' });
      await Preferences.set({ key: 'appSuggestions', value: String(settings.appSuggestions ?? true) });
      await Preferences.set({ key: 'appSuggestionsTime', value: settings.appSuggestionsTime || '12:00' });
    }

    // إطلاق عملية إعادة جدولة التنبيهات في الكود الأصلي (iOS/Android)
    if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};