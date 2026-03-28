"use client"
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { Bell, Sun, Moon, BookOpen, HelpCircle, Clock, X, Settings as SettingsIcon } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import styles from './Settings.module.css'

const Settings = () => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [masterNotifications, setMasterNotifications] = useState(false)
  const [notifications, setNotifications] = useState({
    dailyVerse: true,
    dailyVerseTime: '06:00',
    dailyQuestion: true,
    dailyQuestionTime: '18:00',
    studyPlans: true,
    studyPlansTime: '10:00'
  })

  const syncNotificationsWithSystem = useCallback(async (isMasterOn, currentSettings) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      if (!isMasterOn) return;
      const perms = await LocalNotifications.checkPermissions();
      if (perms.display !== 'granted') return;

      const toSchedule = [];
      const resV = await fetch('/data/dailyVerses.json');
      const verses = await resV.json();
      const resQ = await fetch('/data/dailyQuestions.json');
      const questions = await resQ.json();

      for (let i = 0; i < 30; i++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + i);
        const m = targetDate.getMonth() + 1;
        const d = targetDate.getDate();
        const verse = verses.find(v => v.month === m && v.day === d) || verses[0];
        const question = questions.find(q => q.month === m && q.day === d) || questions[0];

        if (currentSettings.dailyVerse) {
          const vTime = currentSettings.dailyVerseTime.split(':');
          const vDate = new Date(targetDate);
          vDate.setHours(parseInt(vTime[0]), parseInt(vTime[1]), 0, 0);
          if (vDate > new Date()) {
            toSchedule.push({
              title: "آية اليوم ✨",
              body: `${verse.verse} ${verse.reference}`,
              id: 100 + i,
              smallIcon: "ic_stat_ic_notification",
              schedule: { at: vDate },
              extra: { url: "/" }
            });
          }
        }

        if (currentSettings.dailyQuestion) {
          const qTime = currentSettings.dailyQuestionTime.split(':');
          const qDate = new Date(targetDate);
          qDate.setHours(parseInt(qTime[0]), parseInt(qTime[1]), 0, 0);
          if (qDate > new Date()) {
            toSchedule.push({
              title: "سؤال اليوم 💡",
              body: question.question,
              id: 200 + i,
              smallIcon: "ic_stat_ic_notification",
              schedule: { at: qDate },
              extra: { url: "/competitions" }
            });
          }
        }
      }

      if (currentSettings.studyPlans) {
        const sTime = currentSettings.studyPlansTime.split(':');
        toSchedule.push({
          title: "وقت القراءة 📖",
          body: "هل أتممت وردك اليومي من الكتاب المقدس؟",
          id: 1,
          smallIcon: "ic_stat_ic_notification",
          schedule: { on: { hour: parseInt(sTime[0]), minute: parseInt(sTime[1]) }, repeats: true },
          extra: { url: "/studyPlans" }
        });
      }

      if (toSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: toSchedule });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const initSettings = async () => {
      setMounted(true)
      const native = Capacitor.isNativePlatform()
      setIsNative(native)

      const savedSize = localStorage.getItem('bibleFontSize') || '18'
      const size = parseInt(savedSize)
      setFontSize(size)
      document.documentElement.style.setProperty('--bible-font-size', size + 'px')

      if (native) {
        const perms = await LocalNotifications.checkPermissions();
        const isGranted = perms.display === 'granted';
        const savedMaster = localStorage.getItem('masterNotifications') === 'true';
        const finalMasterState = isGranted && savedMaster;
        setMasterNotifications(finalMasterState);
        localStorage.setItem('masterNotifications', finalMasterState.toString());
      } else {
        const savedMaster = localStorage.getItem('masterNotifications') === 'true';
        setMasterNotifications(savedMaster);
      }

      const savedNotifications = localStorage.getItem('notificationSettings')
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications))
      }
    };
    initSettings();
  }, [])

  const handleMasterToggle = async () => {
    const nextState = !masterNotifications;
    if (nextState) {
      let perms = await LocalNotifications.checkPermissions();
      if (perms.display === 'denied') {
        setShowPermissionModal(true);
        return;
      }
      if (perms.display !== 'granted') {
        perms = await LocalNotifications.requestPermissions();
      }
      if (perms.display !== 'granted') {
        setMasterNotifications(false);
        localStorage.setItem('masterNotifications', 'false');
        return;
      }
    }
    setMasterNotifications(nextState);
    localStorage.setItem('masterNotifications', nextState.toString());
    syncNotificationsWithSystem(nextState, notifications);
  };

  const openSystemSettings = async () => {
    setShowPermissionModal(false);
    try {
      if (Capacitor.isNativePlatform()) {
        const Plugins = Capacitor.Plugins;
        if (Plugins.NativeSettingsCustom) {
          await Plugins.NativeSettingsCustom.openAppSettings();
        } else {
          const { registerPlugin } = await import('@capacitor/core');
          const NativeSettingsCustom = registerPlugin('NativeSettingsCustom');
          await NativeSettingsCustom.openAppSettings();
        }
      }
    } catch (err) {
      console.error("Plugin Error:", err);
    }
  };

  const updateSubSetting = (key, value) => {
    if (!masterNotifications) return;
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
    syncNotificationsWithSystem(masterNotifications, updated);
  };

  const updateFontSize = (size) => {
    const newSize = Math.max(10, Math.min(40, size))
    setFontSize(newSize)
    localStorage.setItem('bibleFontSize', newSize.toString())
    document.documentElement.style.setProperty('--bible-font-size', newSize + 'px')
  }

  const handleSliderChange = (e) => {
    updateFontSize(parseInt(e.target.value))
  }

  if (!mounted) return null

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>الإعدادات</h1>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>🎨</span> مظهر التطبيق
        </h2>
        <div className={styles.themeGrid}>
          <div 
            className={`${styles.themeCircle} ${theme === 'light' ? styles.active : ''}`}
            style={{ backgroundColor: '#ffffff', border: '1px solid #ddd' }}
            onClick={() => setTheme('light')}
          >
            <Sun size={20} color="#fbbf24" />
          </div>
          <div 
            className={`${styles.themeCircle} ${theme === 'dark' ? styles.active : ''}`}
            style={{ backgroundColor: '#0f172a' }}
            onClick={() => setTheme('dark')}
          >
            <Moon size={20} color="#60a5fa" />
          </div>
        </div>
      </div>

      {isNative && (
        <div className={styles.section}>
          <div className={styles.masterToggleRow}>
            <h2 className={styles.sectionTitle}>
              <span>🔔</span> تنبيهات الإشعارات
            </h2>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={masterNotifications} 
                onChange={handleMasterToggle} 
              />
              <span className={styles.sliderRound}></span>
            </label>
          </div>
          <div className={`${styles.notificationList} ${!masterNotifications ? styles.disabledList : ''}`}>
            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <Bell size={18} className={styles.notifIcon} />
                  <span>إشعارات آية اليوم</span>
                </div>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={notifications.dailyVerse} 
                    onChange={() => updateSubSetting('dailyVerse', !notifications.dailyVerse)}
                    disabled={!masterNotifications}
                  />
                  <span className={styles.sliderRound}></span>
                </label>
              </div>
              <div className={`${styles.timePickerRow} ${!notifications.dailyVerse || !masterNotifications ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input 
                  type="time" 
                  value={notifications.dailyVerseTime} 
                  onChange={(e) => updateSubSetting('dailyVerseTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.dailyVerse || !masterNotifications}
                />
              </div>
            </div>
            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <HelpCircle size={18} className={styles.notifIcon} />
                  <span>إشعارات سؤال اليوم</span>
                </div>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={notifications.dailyQuestion} 
                    onChange={() => updateSubSetting('dailyQuestion', !notifications.dailyQuestion)}
                    disabled={!masterNotifications}
                  />
                  <span className={styles.sliderRound}></span>
                </label>
              </div>
              <div className={`${styles.timePickerRow} ${!notifications.dailyQuestion || !masterNotifications ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input 
                  type="time" 
                  value={notifications.dailyQuestionTime} 
                  onChange={(e) => updateSubSetting('dailyQuestionTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.dailyQuestion || !masterNotifications}
                />
              </div>
            </div>
            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <BookOpen size={18} className={styles.notifIcon} />
                  <span>إشعارات خطط القراءة</span>
                </div>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={notifications.studyPlans} 
                    onChange={() => updateSubSetting('studyPlans', !notifications.studyPlans)}
                    disabled={!masterNotifications}
                  />
                  <span className={styles.sliderRound}></span>
                </label>
              </div>
              <div className={`${styles.timePickerRow} ${!notifications.studyPlans || !masterNotifications ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input 
                  type="time" 
                  value={notifications.studyPlansTime} 
                  onChange={(e) => updateSubSetting('studyPlansTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.studyPlans || !masterNotifications}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>📖</span> حجم خط القراءة
        </h2>
        <div className={styles.fontControl}>
          <div className={styles.fontPreview} style={{ fontSize: `${fontSize}px` }}>هكذا سيبدو نص الكتاب المقدس</div>
          <div className={styles.controlsWrapper}>
            <button className={styles.stepBtn} onClick={() => updateFontSize(fontSize - 1)} disabled={fontSize <= 10}>−</button>
            <div className={styles.sliderContainer}>
              <input type="range" min="10" max="40" step="1" value={fontSize} onChange={handleSliderChange} className={styles.slider} />
            </div>
            <button className={styles.stepBtn} onClick={() => updateFontSize(fontSize + 1)} disabled={fontSize >= 40}>+</button>
          </div>
        </div>
      </div>

      {showPermissionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <SettingsIcon size={24} className={styles.modalIcon} />
              <button onClick={() => setShowPermissionModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <h3>تفعيل الإشعارات</h3>
            <p>لقد قمت برفض وصول الإشعارات سابقاً. يرجى تفعيلها من إعدادات الهاتف لتتمكن من استلام آيات اليوم والأسئلة.</p>
            <div className={styles.modalActions}>
              <button onClick={() => setShowPermissionModal(false)} className={styles.cancelBtn}>إلغاء</button>
              <button onClick={openSystemSettings} className={styles.confirmBtn}>فتح الإعدادات</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings