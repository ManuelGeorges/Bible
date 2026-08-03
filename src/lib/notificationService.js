import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const REENGAGEMENT_NOTIFS = {
    ar: [
        { id: 3003, days: 3, title: "نفتقدك! ✨", body: "مرت 3 أيام لم تفتح فيها آجيوس. هل نلقي نظرة على كلمة اليوم؟" },
        { id: 3007, days: 7, title: "أين أنت؟ 🕊️", body: "مضى أسبوع كامل! خصص دقائق قليلة لغذاء روحك." },
        { id: 3014, days: 14, title: "اشتقنا إليك 📖", body: "أسبوعان مرا بسرعة. الكتاب المقدس ينتظرك." },
        { id: 3030, days: 30, title: "رسالة خاصة لك ❤️", body: "شهر كامل غياب.. الرب يبارك حياتك، عد إلينا لنقرأ سوياً." }
    ],
    en: [
        { id: 3003, days: 3, title: "We miss you! ✨", body: "It's been 3 days since you last opened Agios. Shall we look at today's verse?" },
        { id: 3007, days: 7, title: "Where are you? 🕊️", body: "A whole week has passed! Take a few minutes for your spiritual nourishment." },
        { id: 3014, days: 14, title: "We've missed you 📖", body: "Two weeks went by so fast. The Bible is waiting for you." },
        { id: 3030, days: 30, title: "A special message for you ❤️", body: "A whole month of absence.. God bless your life, come back to read together." }
    ],
    fr: [
        { id: 3003, days: 3, title: "Vous nous manquez ! ✨", body: "Cela fait 3 jours que vous n'avez pas ouvert Agios. Regardons le verset du jour ?" },
        { id: 3007, days: 7, title: "Où êtes-vous ? 🕊️", body: "Une semaine entière s'est écoulée ! Prenez quelques minutes pour votre ressourcement." },
        { id: 3014, days: 14, title: "Vous nous avez manqué 📖", body: "Deux semaines sont passées si vite. La Bible vous attend." },
        { id: 3030, days: 30, title: "Un message spécial pour vous ❤️", body: "Un mois d'absence.. Que Dieu bénisse votre vie, revenez lire avec nous." }
    ],
    de: [
        { id: 3003, days: 3, title: "Wir vermissen dich! ✨", body: "Es ist 3 Tage her, seit du Agios das letzte Mal geöffnet hast. Sollen wir uns den heutigen Vers ansehen?" },
        { id: 3007, days: 7, title: "Wo bist du? 🕊️", body: "Eine ganze Woche ist vergangen! Nimm dir ein paar Minuten für deine geistliche Nahrung." },
        { id: 3014, days: 14, title: "Wir haben dich vermisst 📖", body: "Zwei Wochen vergingen wie im Flug. Die Bibel wartet auf dich." },
        { id: 3030, days: 30, title: "Eine besondere Nachricht für dich ❤️", body: "Ein ganzer Monat Abwesenheit.. Gott segne dein Leben, komm zurück zum gemeinsamen Lesen." }
    ]
};

export const scheduleReengagementNotifications = async (lang = 'ar') => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        // 1. Get pending notifications to identify which ones to cancel
        const pending = await LocalNotifications.getPending();
        const idsToCancel = pending.notifications
            .filter(n => n.id >= 3000 && n.id <= 3030)
            .map(n => n.id);

        if (idsToCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: idsToCancel.map(id => ({ id })) });
        }

        // 2. Schedule new notifications
        const messages = REENGAGEMENT_NOTIFS[lang] || REENGAGEMENT_NOTIFS.ar;
        const DAY_MS = 24 * 60 * 60 * 1000;

        await LocalNotifications.schedule({
            notifications: messages.map(m => ({
                id: m.id,
                title: m.title,
                body: m.body,
                schedule: { at: new Date(Date.now() + m.days * DAY_MS) },
                sound: 'default',
                extra: { url: '/' }
            }))
        });
        console.log("Re-engagement notifications scheduled for lang:", lang);
    } catch (e) {
        console.error("Error scheduling re-engagement notifications:", e);
    }
};

export const syncNotifications = async (passedLang = null) => {
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

    // 1. مزامنة اللغة
    // نستخدم اللغة الممرة أو المخزنة في Preferences أولاً لأنها أدق على iOS
    let currentLang = passedLang;
    if (!currentLang) {
        const { value } = await Preferences.get({ key: 'language' });
        currentLang = value || localStorage.getItem('language') || localStorage.getItem('app_lang') || 'ar';
    }

    await Preferences.set({ key: 'language', value: currentLang });

    // جدولة إشعارات إعادة التفاعل باللغة الصحيحة
    await scheduleReengagementNotifications(currentLang);

    // 2. مزامنة الحالة العامة
    const savedMaster = localStorage.getItem('masterNotifications') !== 'false';
    await Preferences.set({ key: 'masterNotifications', value: String(savedMaster) });

    // 3. مزامنة الإعدادات التفصيلية
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      await Preferences.set({ key: 'notificationSettings', value: savedSettings });
    }

    // 4. مزامنة الستريك
    const currentStreak = localStorage.getItem('userStreak') || '0';
    await Preferences.set({ key: 'userStreak', value: String(currentStreak) });

    // 5. مزامنة الخطط الدراسية
    const studySummary = localStorage.getItem('studyPlansSummary');
    if (studySummary) {
      await Preferences.set({ key: 'studyPlansSummary', value: studySummary });
    }

    // تحديث المنبهات في أندرويد
    if (window.AgiosScannerNative?.refreshAlarms) {
        window.AgiosScannerNative.refreshAlarms();
    }

  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};
