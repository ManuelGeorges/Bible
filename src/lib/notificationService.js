import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from '../lib/firebase';
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { AppUpdate } from '@capawesome/capacitor-app-update';
import studyPlansData from '../app/studyPlans/studyPlansData.json';

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') return;
    }

    await LocalNotifications.createChannel({
      id: 'agios_notifications',
      name: 'تنبيهات أجيوس',
      importance: 5,
      description: 'إشعارات الآية اليومية ومتابعة الخطط',
      sound: 'beep.wav',
      visibility: 1,
    });

    const auth = getAuth();
    const user = auth.currentUser;
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) await LocalNotifications.cancel(pending);

    if (!savedMaster || !user) return;

    const savedSettings = localStorage.getItem('notificationSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      dailyVerse: true, dailyVerseTime: '06:00',
      dailyQuestion: true, dailyQuestionTime: '18:00',
      studyPlans: true, studyPlansTime: '10:00'
    };

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    
    const [resV, resQ] = await Promise.all([
      fetch('/data/dailyVerses.json').then(r => r.json()).catch(() => []),
      fetch('/data/dailyQuestions.json').then(r => r.json()).catch(() => [])
    ]);

    const notifications = [];
    const now = new Date();
    const ICON_NAME = 'ic_stat_ic_notification';
    const ICON_COLOR = '#488AFF';
    const CHANNEL_ID = 'agios_notifications';

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + i);
      const m = targetDate.getMonth() + 1;
      const d = targetDate.getDate();

      if (settings.dailyVerse && resV.length > 0) {
        const verse = resV.find(v => v.month === m && v.day === d) || resV[i % resV.length];
        const [vh, vm] = settings.dailyVerseTime.split(':');
        const vDate = new Date(targetDate);
        vDate.setHours(parseInt(vh), parseInt(vm), 0, 0);
        if (vDate > now) {
          notifications.push({
            id: 1000 + i,
            title: "آية اليوم ✨",
            body: `"${verse.verse}" - ${verse.reference}`,
            schedule: { at: vDate, allowWhileIdle: true },
            smallIcon: ICON_NAME, 
            iconColor: ICON_COLOR,
            channelId: CHANNEL_ID,
            extra: { url: "/" }
          });
        }
      }

      if (settings.dailyQuestion && resQ.length > 0) {
        const question = resQ.find(q => q.month === m && q.day === d) || resQ[i % resQ.length];
        const [qh, qm] = settings.dailyQuestionTime.split(':');
        const qDate = new Date(targetDate);
        qDate.setHours(parseInt(qh), parseInt(qm), 0, 0);
        if (qDate > now) {
          notifications.push({
            id: 2000 + i,
            title: "تحدي اليوم 💡",
            body: question.question,
            schedule: { at: qDate, allowWhileIdle: true },
            smallIcon: ICON_NAME, 
            iconColor: ICON_COLOR,
            channelId: CHANNEL_ID,
            extra: { url: "/" }
          });
        }
      }
    }

    const serverComp = userData.completedPlans || {};
    const customPlans = userData.customPlans || {};
    const allPlans = [...(studyPlansData.plans || []), ...Object.values(customPlans)];

    allPlans.forEach((plan, index) => {
      const planComp = serverComp[plan.id] || customPlans[plan.id] || {};
      const completedDays = Object.values(planComp.completedDays || {}).filter(d => d.isCompleted || d === true).length;
      const totalDays = plan.readings?.length || 0;

      if (completedDays > 0 && completedDays < totalDays && settings.studyPlans) {
        const [sh, sm] = settings.studyPlansTime.split(':');
        notifications.push({
          id: 3000 + index,
          title: "متابعة الخطة 📖",
          body: `باقي لك ${totalDays - completedDays} يوم لتختم "${plan.title}".`,
          schedule: { on: { hour: parseInt(sh), minute: parseInt(sm) }, repeats: true },
          smallIcon: ICON_NAME, 
          iconColor: ICON_COLOR,
          channelId: CHANNEL_ID,
          extra: { url: "/studyPlans" }
        });
      }
    });

    if (userData.streak > 0) {
      const sDate = new Date();
      sDate.setHours(21, 0, 0, 0); 
      if (sDate > now) {
        notifications.push({
          id: 4000,
          title: "حافظ على الستريك! 🔥",
          body: `لديك ${userData.streak} يوم متواصل! ادخل الآن لكي لا تفقد تقدمك.`,
          schedule: { at: sDate, allowWhileIdle: true },
          smallIcon: ICON_NAME, 
          iconColor: ICON_COLOR,
          channelId: CHANNEL_ID,
          extra: { url: "/" }
        });
      }
    }

    const tips = [
      { title: "ميزة جديدة", body: "هل جربت الخرائط التفاعلية في أجيوس؟ استكشف أماكن الكتاب المقدس الآن.", url: "/maps" },
      { title: "نصيحة تقنية", body: "يمكنك تغيير مظهر التطبيق للوضع الليلي من الإعدادات لراحة عينيك.", url: "/settings" },
      { title: "المسابقات الأسبوعية", body: "شارك في المسابقات واربح نقاط XP إضافية.", url: "/competitions" },
      { title: "البحث الذكي", body: "يمكنك الآن تجربة البحث باستخدام المشتقات ومرادفات الكلمة بمساعدة مساعد آجيوس الذكي!", url: "/search" }
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    const tipDate = new Date();
    tipDate.setDate(now.getDate() + 2);
    tipDate.setHours(15, 0, 0, 0);
    notifications.push({
      id: 5000,
      title: randomTip.title,
      body: randomTip.body,
      schedule: { at: tipDate },
      smallIcon: ICON_NAME, 
      iconColor: ICON_COLOR,
      channelId: CHANNEL_ID,
      extra: { url: randomTip.url }
    });

    const appInfo = await AppUpdate.getAppUpdateInfo().catch(() => null);
    if (appInfo && (appInfo.updateAvailability === 2 || appInfo.updateAvailability === 3)) {
      notifications.push({
        id: 6000,
        title: "تحديث جديد متوفر 🚀",
        body: "نسخة جديدة من أجيوس متوفرة الآن بمميزات أفضل. حدث تطبيقك!",
        schedule: { at: new Date(Date.now() + 1000 * 60 * 5) },
        smallIcon: ICON_NAME, 
        iconColor: ICON_COLOR,
        channelId: CHANNEL_ID,
        extra: { url: "/" }
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};