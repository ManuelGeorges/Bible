"use client"
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, Sun, Moon, BookOpen, HelpCircle,
  Clock, X, Settings as SettingsIcon,
  Type, LayoutList, Flame, RefreshCw, Sparkles, Monitor, Palette,
  Trash2, LogOut, LogIn, CloudSync, CaseSensitive, Bold
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { syncNotifications } from '../../lib/notificationService';
import { signOut, deleteUser, onAuthStateChanged } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db, getFirebaseRemoteConfig } from '../../lib/firebase';
import { fetchAndActivate, getBoolean } from 'firebase/remote-config';
import styles from './Settings.module.css'

const fontOptions = [
  { id: 'Cairo', name: 'القاهرة (الأساسي)', value: "'Cairo', sans-serif" },
  { id: 'Amiri', name: 'الأميري (كلاسيكي)', value: "'Amiri', serif" },
  { id: 'Almarai', name: 'المراعي (عصري)', value: "'Almarai', sans-serif" },
  { id: 'Tajawal', name: 'تجول (بسيط)', value: "'Tajawal', sans-serif" },
  { id: 'ReemKufi', name: 'ريم كوفي (تراثي)', value: "'Reem Kufi', sans-serif" }
]

const Settings = () => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [fontFamily, setFontFamily] = useState('Cairo')
  const [fontWeight, setFontWeight] = useState(400)
  const [versePerLine, setVersePerLine] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [masterNotifications, setMasterNotifications] = useState(false)
  const [user, setUser] = useState(null)
  const [showSyncLogin, setShowSyncLogin] = useState(true)
  const [notifications, setNotifications] = useState({
    verse: true,
    verseTime: '06:00',
    question: true,
    questionTime: '18:00',
    studyPlans: true,
    studyPlansTime: '10:00',
    streak: true,
    streakTime: '21:00',
    tip: true,
    tipTime: '15:00',
    appSuggestions: true,
    appSuggestionsTime: '12:00',
    updateAlerts: true
  })
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })

    const initSettings = async () => {
      setMounted(true)
      const native = Capacitor.isNativePlatform()
      setIsNative(native)

      // Remote Config
      const remoteConfig = await getFirebaseRemoteConfig();
      if (remoteConfig) {
        try {
          await fetchAndActivate(remoteConfig);
          const shouldShow = getBoolean(remoteConfig, 'show_sync_login');
          setShowSyncLogin(shouldShow);
        } catch (e) {
          console.error("Remote Config Fetch Error:", e);
        }
      }

      const savedSize = localStorage.getItem('bibleFontSize') || '18'
      const size = parseInt(savedSize)
      setFontSize(size)
      document.documentElement.style.setProperty('--bible-font-size', size + 'px')

      const savedFont = localStorage.getItem('bibleFontFamily') || 'Cairo'
      setFontFamily(savedFont)
      const selectedFont = fontOptions.find(f => f.id === savedFont) || fontOptions[0]
      document.documentElement.style.setProperty('--bible-font-family', selectedFont.value)

      const savedWeight = localStorage.getItem('bibleFontWeight') || '400'
      const weight = parseInt(savedWeight)
      setFontWeight(weight)
      document.documentElement.style.setProperty('--bible-font-weight', weight.toString())

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
    return () => unsubscribe()
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

  const updateFontWeight = (weight) => {
    const newWeight = Math.max(300, Math.min(900, weight))
    setFontWeight(newWeight)
    localStorage.setItem('bibleFontWeight', newWeight.toString())
    document.documentElement.style.setProperty('--bible-font-weight', newWeight.toString())
    window.dispatchEvent(new Event('storage'))
  }

  const updateFontFamily = (id) => {
    setFontFamily(id)
    localStorage.setItem('bibleFontFamily', id)
    const selectedFont = fontOptions.find(f => f.id === id) || fontOptions[0]
    document.documentElement.style.setProperty('--bible-font-family', selectedFont.value)
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleDeleteAccount = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) return;

    // 1. التحقق الاستباقي من "حداثة" تسجيل الدخول
    const lastSignInTime = new Date(currentUser.metadata.lastSignInTime).getTime();
    const now = new Date().getTime();
    const isFreshSession = (now - lastSignInTime) < (5 * 60 * 1000); // 5 دقائق

    if (!isFreshSession) {
      alert("لدواعي أمنية، يتطلب حذف الحساب تسجيل دخول حديث. يرجى تسجيل الخروج ثم الدخول مرة أخرى والمحاولة مجدداً.");
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح جميع بياناتك من السحابة."
    );

    if (confirmed) {
      try {
        const userId = currentUser.uid;

        // 2. محاولة حذف المستخدم من Auth أولاً
        await deleteUser(currentUser);

        // 3. إذا نجح حذف الـ Auth، نقوم بحذف بيانات Firestore
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);

        alert("تم حذف الحساب والبيانات بنجاح.");
        router.push('/intro');
      } catch (error) {
        console.error("Error deleting user:", error);
        if (error.code === 'auth/requires-recent-login') {
          alert("انتهت صلاحية الجلسة الأمنية. يرجى إعادة تسجيل الدخول ثم المحاولة مرة أخرى.");
        } else {
          alert("حدث خطأ أثناء حذف الحساب. يرجى المحاولة لاحقاً.");
        }
      }
    }
  };

  if (!mounted) return null

  const currentFontValue = fontOptions.find(f => f.id === fontFamily)?.value || fontOptions[0].value

  return (
    <div className={styles.container} dir="rtl">
      <h1 className={styles.title}>الإعدادات</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Palette size={22} className={styles.iconPrimary} /> مظهر التطبيق
        </h2>
        <div className={styles.themeGrid}>
          <div
            className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
            onClick={() => setTheme('light')}
          >
            <div className={`${styles.themeCircle} ${styles.light}`}>
              <Sun size={24} />
            </div>
            <span className={styles.themeLabel}>فاتح</span>
          </div>

          <div
            className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
            onClick={() => setTheme('dark')}
          >
            <div className={`${styles.themeCircle} ${styles.dark}`}>
              <Moon size={24} />
            </div>
            <span className={styles.themeLabel}>داكن</span>
          </div>

          <div
            className={`${styles.themeOption} ${theme === 'system' ? styles.active : ''}`}
            onClick={() => setTheme('system')}
          >
            <div className={`${styles.themeCircle} ${styles.system}`}>
              <Monitor size={24} />
            </div>
            <span className={styles.themeLabel}>تلقائي</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <BookOpen size={22} className={styles.iconPrimary} /> إعدادات الآيات
        </h2>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.textContainer}>
              <span className={styles.settingLabel}>
                <LayoutList size={20} className={styles.iconPrimary} />
                كل آية في سطر مستقل
              </span>
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
            <span className={styles.settingLabel}>
              <CaseSensitive size={20} className={styles.iconPrimary} />
              نوع الخط (عربي)
            </span>
          </div>
          <div className={styles.fontOptionsList}>
            {fontOptions.map(option => (
              <button
                key={option.id}
                className={`${styles.fontChip} ${fontFamily === option.id ? styles.activeChip : ''}`}
                onClick={() => updateFontFamily(option.id)}
                style={{ fontFamily: option.value }}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.fontControlGroup} style={{ marginTop: '20px' }}>
          <div className={styles.settingInfo} style={{ marginBottom: '15px' }}>
            <span className={styles.settingLabel}>
              <Bold size={20} className={styles.iconPrimary} />
              ثقل الخط ({fontWeight})
            </span>
          </div>
          <div className={styles.controlsWrapper}>
            <input
              type="range"
              min="300"
              max="900"
              step="100"
              value={fontWeight}
              onChange={(e) => updateFontWeight(parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>

        <div className={styles.fontControlGroup} style={{ marginTop: '20px' }}>
          <div className={styles.settingInfo} style={{ marginBottom: '15px' }}>
            <span className={styles.settingLabel}>
              <Type size={20} className={styles.iconPrimary} />
              حجم خط القراءة ({fontSize}px)
            </span>
          </div>

          <div className={styles.fontPreview} style={{ fontSize: `${fontSize}px`, fontFamily: currentFontValue, fontWeight: fontWeight }}>
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
              <Bell size={22} className={styles.iconPrimary} /> الإشعارات
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
                  <div className={styles.textContainer}>
                    <span className={styles.settingLabel}>
                      <Bell size={18} />
                      آية اليوم
                    </span>
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
                  <div className={styles.textContainer}>
                    <span className={styles.settingLabel}>
                      <HelpCircle size={18} />
                      سؤال اليوم
                    </span>
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
                  <div className={styles.textContainer}>
                    <span className={styles.settingLabel}>
                      <BookOpen size={18} />
                      تذكير الخطط الدراسية
                    </span>
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

            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <div className={styles.textContainer}>
                    <span className={styles.settingLabel}>
                      <Flame size={18} className={styles.notifIcon} />
                      تنبيه حماية الستريك
                    </span>
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
              <div className={`${styles.timePickerRow} ${!notifications.streak ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input
                  type="time"
                  value={notifications.streakTime}
                  onChange={(e) => updateSubSetting('streakTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.streak}
                />
              </div>
            </div>

            <div className={styles.notificationGroup}>
              <div className={styles.notificationItem}>
                <div className={styles.notificationInfo}>
                  <div className={styles.textContainer}>
                    <span className={styles.settingLabel}>
                      <Sparkles size={18} className={styles.notifIcon} />
                      اقتراحات ومزايا التطبيق
                    </span>
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
              <div className={`${styles.timePickerRow} ${!notifications.appSuggestions ? styles.dimmed : ''}`}>
                <Clock size={16} />
                <span>وقت التنبيه:</span>
                <input
                  type="time"
                  value={notifications.appSuggestionsTime}
                  onChange={(e) => updateSubSetting('appSuggestionsTime', e.target.value)}
                  className={styles.timeInput}
                  disabled={!notifications.appSuggestions}
                />
              </div>
            </div>

            <div className={styles.notificationItem}>
              <div className={styles.notificationInfo}>
                <div className={styles.textContainer}>
                  <span className={styles.settingLabel}>
                    <RefreshCw size={18} className={styles.notifIcon} />
                    إشعارات التحديثات
                  </span>
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

      {user ? (
        <div className={styles.section + ' ' + styles.deleteSection}>
          <h2 className={styles.sectionTitle}>
            <SettingsIcon size={22} className={styles.iconPrimary} /> إدارة الحساب
          </h2>
          <p className={styles.subText} style={{ marginBottom: '15px' }}>
            يمكنك إدارة حسابك من هنا. يرجى العلم أن حذف الحساب سيؤدي لمسح جميع بياناتك نهائياً.
          </p>
          <div className={styles.accountButtons}>
            <button className={styles.logoutButton} onClick={handleLogout}>
              <LogOut size={20} />
              <span>تسجيل الخروج</span>
            </button>

            <button className={styles.deleteButton} onClick={handleDeleteAccount}>
              <Trash2 size={20} />
              <span>حذف الحساب نهائياً</span>
            </button>
          </div>
        </div>
      ) : showSyncLogin && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <CloudSync size={22} className={styles.iconPrimary} /> المزامنة والسحابة
          </h2>
          <p className={styles.subText} style={{ marginBottom: '15px' }}>
            سجل دخولك الآن للحفاظ على تقدمك، ملاحظاتك، ونقاطك من الضياع، ومزامنتها عبر جميع أجهزتك.
          </p>
          <button
            className={styles.loginButton}
            onClick={() => router.push('/intro')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-color, #2563eb)',
              color: 'white',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            <LogIn size={20} />
            <span>تسجيل الدخول للمزامنة</span>
          </button>
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