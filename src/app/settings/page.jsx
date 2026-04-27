"use client"
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  Bell, Sun, Moon, BookOpen, HelpCircle,
  Clock, X, Settings as SettingsIcon,
  Type, LayoutList, Flame, RefreshCw, Sparkles, Monitor
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { syncNotifications } from '../../lib/notificationService';
import styles from './Settings.module.css'

const Settings = () => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [versePerLine, setVersePerLine] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [masterNotifications, setMasterNotifications] = useState(false)
  const [notifications, setNotifications] = useState({
    verse: true,
    verseTime: '06:00',
    question: true,
    questionTime: '18:00',
    studyPlans: true,
    studyPlansTime: '10:00',
    streak: true,
    tip: true,
    tipTime: '15:00',
    appSuggestions: true,
    updateAlerts: true
  })

  useEffect(() => {
    const initSettings = async () => {
      setMounted(true)
      const native = Capacitor.isNativePlatform()
      setIsNative(native)

      const savedSize = localStorage.getItem('bibleFontSize') || '18'
      const size = parseInt(savedSize)
      setFontSize(size)
      document.documentElement.style.setProperty('--bible-font-size', size + 'px')

      const savedLayout = localStorage.getItem('versePerLine') === 'true'
      setVersePerLine(savedLayout)

      if (native) {
        const perms = await LocalNotifications.checkPermissions()
        const isGranted = perms.display === 'granted'
        const savedMasterRaw = localStorage.getItem('masterNotifications')

        let finalMasterState
        if (savedMasterRaw === null) {
          finalMasterState = isGranted
        } else {
          finalMasterState = isGranted && savedMasterRaw === 'true'
        }

        setMasterNotifications(finalMasterState)
        localStorage.setItem('masterNotifications', finalMasterState.toString())
      } else {
        const savedMaster = localStorage.getItem('masterNotifications') === 'true'
        setMasterNotifications(savedMaster)
      }

      const savedNotifications = localStorage.getItem('notificationSettings')
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications))
      }
    }
    initSettings()
  }, [])

  const handleMasterToggle = async () => {
    const nextState = !masterNotifications
    if (nextState) {
      let perms = await LocalNotifications.checkPermissions()
      if (perms.display === 'denied') {
        setShowPermissionModal(true)
        return
      }
      if (perms.display !== 'granted') {
        perms = await LocalNotifications.requestPermissions()
      }
      if (perms.display !== 'granted') {
        setMasterNotifications(false)
        localStorage.setItem('masterNotifications', 'false')
        return
      }
    }
    setMasterNotifications(nextState)
    localStorage.setItem('masterNotifications', nextState.toString())
    
    if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateSettings) {
        window.AgiosScannerNative.updateSettings(JSON.stringify(notifications), nextState);
    }

    await syncNotifications()
  }

  const updateSubSetting = async (key, value) => {
    if (!masterNotifications) return;
    
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
    
    if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateSettings) {
        window.AgiosScannerNative.updateSettings(JSON.stringify(updated), masterNotifications);
    }

    await syncNotifications(); 
  };

  const updateFontSize = (size) => {
    const newSize = Math.max(10, Math.min(40, size))
    setFontSize(newSize)
    localStorage.setItem('bibleFontSize', newSize.toString())
    document.documentElement.style.setProperty('--bible-font-size', newSize + 'px')
    window.dispatchEvent(new Event('storage'))
  }

  const toggleVerseLayout = () => {
    const nextState = !versePerLine
    setVersePerLine(nextState)
    localStorage.setItem('versePerLine', nextState.toString())
    window.dispatchEvent(new Event('storage'))
  }

  const openSystemSettings = async () => {
    setShowPermissionModal(false)
    try {
      if (Capacitor.isNativePlatform()) {
        const { NativeSettingsCustom } = Capacitor.Plugins
        if (NativeSettingsCustom) {
          await NativeSettingsCustom.openAppSettings()
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (!mounted) return null

  return (
    <div className={styles.container} dir="rtl">
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
            <span className={styles.themeLabel}>فاتح</span>
          </div>
          <div
            className={`${styles.themeCircle} ${theme === 'dark' ? styles.active : ''}`}
            style={{ backgroundColor: '#0f172a' }}
            onClick={() => setTheme('dark')}
          >
            <Moon size={20} color="#60a5fa" />
            <span className={styles.themeLabel}>داكن</span>
          </div>
          <div
            className={`${styles.themeCircle} ${theme === 'system' ? styles.active : ''}`}
            style={{ backgroundColor: '#475569' }}
            onClick={() => setTheme('system')}
          >
            <Monitor size={20} color="#e2e8f0" />
            <span className={styles.themeLabel}>تلقائي</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>📖</span> إعدادات الآيات
        </h2>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <LayoutList size={20} className={styles.iconPrimary} />
            <div className={styles.textContainer}>
              <span className={styles.settingLabel}>كل آية في سطر مستقل</span>
              <p className={styles.subText}>عرض النص كقائمة مرتبة بدلاً من فقرة</p>
            </div>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={versePerLine}
              onChange={toggleVerseLayout}
            />
            <span className={styles.sliderRound}></span>
          </label>
        </div>

        <div className={styles.fontControlGroup}>
          <div className={styles.settingInfo} style={{ marginBottom: '15px' }}>
            <Type size={20} className={styles.iconPrimary} />
            <span className={styles.settingLabel}>حجم خط القراءة ({fontSize}px)</span>
          </div>

          <div className={styles.fontPreview} style={{ fontSize: `${fontSize}px` }}>
            {versePerLine ? (
              <div className={styles.previewList}>
                <div>١ هكذا سيبدو شكل الآيات</div>
                <div>٢ عند تفعيل خيار السطر المستقل</div>
              </div>
            ) : (
              <p className={styles.previewParagraph}>
                ١ هكذا سيبدو شكل الآيات في نظام الفقرة المستمرة حيث تظهر الأرقام بجانب بعضها البعض.
              </p>
            )}
          </div>

          <div className={styles.controlsWrapper}>
            <button className={styles.stepBtn} onClick={() => updateFontSize(fontSize - 1)} disabled={fontSize <= 10}>−</button>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={fontSize}
                onChange={(e) => updateFontSize(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>
            <button className={styles.stepBtn} onClick={() => updateFontSize(fontSize + 1)} disabled={fontSize >= 40}>+</button>
          </div>
        </div>
      </div>

      {isNative && (
        <div className={styles.section}>
          <div className={styles.masterToggleRow}>
            <h2 className={styles.sectionTitle}>
              <span>🔔</span> الإشعارات
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
                  <Bell size={18} />
                  <div className={styles.textContainer}>
                    <span>آية اليوم</span>
                    <p className={styles.subText}>استلام آية مشجعة يومياً</p>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={notifications.verse}
                    onChange={() => updateSubSetting('verse', !notifications.verse)}
                    disabled={!masterNotifications}
                  />
                  <span className={styles.sliderRound}></span>
                </label>
              </div>
              <div className={`${styles.timePickerRow} ${!notifications.verse ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input
                  type="time"
                  value={notifications.verseTime}
                  onChange={(e) => updateSubSetting('verseTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.verse}
                />
              </div>
            </div>

            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <HelpCircle size={18} />
                  <div className={styles.textContainer}>
                    <span>سؤال اليوم</span>
                    <p className={styles.subText}>تحديات ومسابقات يومية</p>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={notifications.question}
                    onChange={() => updateSubSetting('question', !notifications.question)}
                    disabled={!masterNotifications}
                  />
                  <span className={styles.sliderRound}></span>
                </label>
              </div>
              <div className={`${styles.timePickerRow} ${!notifications.question ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input
                  type="time"
                  value={notifications.questionTime}
                  onChange={(e) => updateSubSetting('questionTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.question}
                />
              </div>
            </div>

            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <BookOpen size={18} />
                  <div className={styles.textContainer}>
                    <span>تذكير الخطط الدراسية</span>
                    <p className={styles.subText}>تنبيه بمتابعة ورد القراءة المتبقي</p>
                  </div>
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
              <div className={`${styles.timePickerRow} ${!notifications.studyPlans ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input
                  type="time"
                  value={notifications.studyPlansTime}
                  onChange={(e) => updateSubSetting('studyPlansTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.studyPlans}
                />
              </div>
            </div>

            <div className={styles.notificationItem}>
              <div className={styles.notificationInfo}>
                <Flame size={18} color="#f97316" />
                <div className={styles.textContainer}>
                  <span>تنبيه حماية الستريك</span>
                  <p className={styles.subText}>تذكيرك قبل انتهاء اليوم للحفاظ على أيامك</p>
                </div>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.streak}
                  onChange={() => updateSubSetting('streak', !notifications.streak)}
                  disabled={!masterNotifications}
                />
                <span className={styles.sliderRound}></span>
              </label>
            </div>

            <div className={styles.notificationItem}>
              <div className={styles.notificationInfo}>
                <Sparkles size={18} color="#8b5cf6" />
                <div className={styles.textContainer}>
                  <span>اقتراحات ومزايا التطبيق</span>
                  <p className={styles.subText}>تعرف على خصائص أجيوس الجديدة</p>
                </div>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.appSuggestions}
                  onChange={() => updateSubSetting('appSuggestions', !notifications.appSuggestions)}
                  disabled={!masterNotifications}
                />
                <span className={styles.sliderRound}></span>
              </label>
            </div>

            <div className={styles.notificationItem}>
              <div className={styles.notificationInfo}>
                <RefreshCw size={18} color="#10b981" />
                <div className={styles.textContainer}>
                  <span>إشعارات التحديثات</span>
                  <p className={styles.subText}>تنبيه فور توفر نسخة جديدة من التطبيق</p>
                </div>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.updateAlerts}
                  onChange={() => updateSubSetting('updateAlerts', !notifications.updateAlerts)}
                  disabled={!masterNotifications}
                />
                <span className={styles.sliderRound}></span>
              </label>
            </div>
          </div>
        </div>
      )}

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
            <p>يرجى تفعيل الإشعارات من إعدادات الهاتف لتتمكن من استلام المحتوى اليومي.</p>
            <div className={styles.modalActions}>
              <button onClick={openSystemSettings} className={styles.primaryBtn}>فتح الإعدادات</button>
              <button onClick={() => setShowPermissionModal(false)} className={styles.cancelBtn}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings;