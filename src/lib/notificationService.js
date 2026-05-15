import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getAuth } from "firebase/auth";

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Preferences.set({
      key: 'last_open_date',
      value: new Date().toString().substring(0, 10),
    });

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    const auth = getAuth();
    const user = auth.currentUser;
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';

    if (!savedMaster || !user) {
      await Preferences.set({ key: 'masterNotifications', value: 'false' });
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      return;
    }

    await Preferences.set({ key: 'masterNotifications', value: 'true' });

    // مزامنة الستريك ليقرأه كود الأندرويد
    const currentStreak = localStorage.getItem('userStreak');
    if (currentStreak) {
      await Preferences.set({ key: 'userStreak', value: String(currentStreak) });
    }

    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
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

      await Preferences.set({ key: 'updateAlerts', value: String(settings.updateAlerts ?? true) });
    }

    // مزامنة ملخص الخطط الدراسية للجافا
    const studySummary = localStorage.getItem('studyPlansSummary');
    if (studySummary) {
        await Preferences.set({ key: 'studyPlansSummary', value: studySummary });
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};