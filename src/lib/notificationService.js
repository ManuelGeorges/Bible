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

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    if (!savedMaster || !user) {
      await Preferences.set({ key: 'masterNotifications', value: 'false' });
      return;
    }

    await Preferences.set({ key: 'masterNotifications', value: 'true' });

    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      await Preferences.set({ key: 'dailyVerse', value: String(settings.dailyVerse) });
      await Preferences.set({ key: 'dailyVerseTime', value: settings.dailyVerseTime || '06:00' });
      
      await Preferences.set({ key: 'dailyQuestion', value: String(settings.dailyQuestion) });
      await Preferences.set({ key: 'dailyQuestionTime', value: settings.dailyQuestionTime || '18:00' });
      
      await Preferences.set({ key: 'studyPlans', value: String(settings.studyPlans) });
      await Preferences.set({ key: 'studyPlansTime', value: settings.studyPlansTime || '10:00' });

      await Preferences.set({ key: 'streakReminder', value: String(settings.streakReminder) });
      await Preferences.set({ key: 'appSuggestions', value: String(settings.appSuggestions) });
      await Preferences.set({ key: 'updateAlerts', value: String(settings.updateAlerts) });
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};