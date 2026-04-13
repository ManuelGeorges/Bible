import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const syncNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const savedMaster = localStorage.getItem('masterNotifications') === 'true';
    const savedSettings = localStorage.getItem('notificationSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      dailyVerse: true, dailyVerseTime: '06:00',
      dailyQuestion: true, dailyQuestionTime: '18:00',
      studyPlans: true, studyPlansTime: '10:00'
    };

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    if (!savedMaster) return;

    const [resV, resQ] = await Promise.all([
      fetch('/data/dailyVerses.json').then(r => r.json()).catch(() => []),
      fetch('/data/dailyQuestions.json').then(r => r.json()).catch(() => [])
    ]);

    const notifications = [];
    const now = new Date();
    
    const ICON_NAME = 'ic_stat_ic_notification';
    const ICON_COLOR = '#488AFF';

    for (let i = 0; i < 30; i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + i);
      const m = targetDate.getMonth() + 1;
      const d = targetDate.getDate();

      const verse = resV.find(v => v.month === m && v.day === d) || resV[i % resV.length];
      const question = resQ.find(q => q.month === m && q.day === d) || resQ[i % resQ.length];

      if (settings.dailyVerse && verse) {
        const [vh, vm] = settings.dailyVerseTime.split(':');
        const vDate = new Date(targetDate);
        vDate.setHours(parseInt(vh), parseInt(vm), 0, 0);
        if (vDate > now) {
          notifications.push({
            id: 1000 + i,
            title: "آية اليوم ✨",
            body: `${verse.verse || verse.text} ${verse.reference || ""}`,
            schedule: { at: vDate, allowWhileIdle: true },
            smallIcon: ICON_NAME,
            iconColor: ICON_COLOR,
            extra: { url: "/" }
          });
        }
      }

      if (settings.dailyQuestion && question) {
        const [qh, qm] = settings.dailyQuestionTime.split(':');
        const qDate = new Date(targetDate);
        qDate.setHours(parseInt(qh), parseInt(qm), 0, 0);
        if (qDate > now) {
          notifications.push({
            id: 2000 + i,
            title: "سؤال اليوم 💡",
            body: question.question,
            schedule: { at: qDate, allowWhileIdle: true },
            smallIcon: ICON_NAME,
            iconColor: ICON_COLOR,
            extra: { url: "/competitions" }
          });
        }
      }
    }

    if (settings.studyPlans) {
      const [sh, sm] = settings.studyPlansTime.split(':');
      notifications.push({
        id: 3000,
        title: "وقت القراءة 📖",
        body: "هل أتممت وردك اليومي من الكتاب المقدس؟",
        schedule: { 
          on: { hour: parseInt(sh), minute: parseInt(sm) },
          repeats: true,
          allowWhileIdle: true 
        },
        smallIcon: ICON_NAME,
        iconColor: ICON_COLOR,
        extra: { url: "/studyPlans" }
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.error("Notification Sync Error:", e);
  }
};