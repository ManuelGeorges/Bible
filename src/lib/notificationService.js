import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getAuth } from "firebase/auth";

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. تسجيل آخر موعد فتح للتطبيق
    await Preferences.set({
      key: 'last_open_date',
      value: new Date().toString().substring(0, 10),
    });

    // 2. طلب صلاحيات التنبيهات المحلية (Local)
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 3. إعداد Push Notifications (iOS/Android)
    await setupPushNotifications();

    const auth = getAuth();
    const user = auth.currentUser;
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';

    await Preferences.set({ key: 'masterNotifications', value: String(savedMaster) });

    if (!savedMaster) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      if (window.AgiosScannerNative?.refreshAlarms) window.AgiosScannerNative.refreshAlarms();
      return;
    }

    // تحديث التنبيهات المجدولة محلياً
    if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

    // مزامنة الستريك والإعدادات
    const currentStreak = localStorage.getItem('userStreak');
    if (currentStreak) {
      await Preferences.set({ key: 'userStreak', value: String(currentStreak) });
    }

    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};

const setupPushNotifications = async () => {
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.warn("User denied Push Notification permissions");
    return;
  }

  // تسجيل الجهاز للحصول على Token
  await PushNotifications.register();

  // الاستماع لحدث التسجيل الناجح
  await PushNotifications.addListener('registration', (token) => {
    console.log('Push Token:', token.value);
    // TODO: هنا يجب إرسال الـ Token إلى Firebase Firestore أو API الخاص بك
    // لربط المستخدم بالإشعارات من جهة السيرفر.
    saveTokenToFirestore(token.value);
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push Registration Error:', error);
  });

  // الاستماع للإشعارات المستلمة أثناء فتح التطبيق
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push Received:', notification);
  });

  // الاستماع للضغط على الإشعار
  await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push Action:', notification);
  });
};

const saveTokenToFirestore = async (token) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    try {
      // يمكنك تخزين التوكن في حقل داخل مستند المستخدم
      // const userRef = doc(db, 'users', user.uid);
      // await updateDoc(userRef, { fcmToken: token });
    } catch (e) {
      console.error("Error saving token:", e);
    }
  }
};
