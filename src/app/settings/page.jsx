"use client"
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import styles from './Settings.module.css'
const Settings = () => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>الإعدادات</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>🎨</span> مظهر التطبيق
        </h2>
        
        <div className={styles.settingRow}>
          <span>اختر الوضع المفضل لك:</span>
        </div>

        <div className={styles.themeGrid}>
          <div 
            className={`${styles.themeCircle} ${theme === 'light' ? styles.active : ''}`}
            style={{ backgroundColor: '#ffffff', border: '1px solid #ddd' }}
            onClick={() => setTheme('light')}
            title="الوضع الفاتح"
          >
            <span style={{ fontSize: '1.2rem' }}>☀️</span>
          </div>

          <div 
            className={`${styles.themeCircle} ${theme === 'dark' ? styles.active : ''}`}
            style={{ backgroundColor: '#0f172a' }}
            onClick={() => setTheme('dark')}
            title="الوضع الليلي"
          >
            <span style={{ fontSize: '1.2rem' }}>🌙</span>
          </div>

          <div 
            className={`${styles.themeCircle} ${theme === 'system' ? styles.active : ''}`}
            style={{ background: 'linear-gradient(to right, #ffffff 50%, #0f172a 50%)' }}
            onClick={() => setTheme('system')}
            title="حسب النظام"
          >
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>🔔</span> التنبيهات
        </h2>
        <div className={styles.settingRow}>
          <span>تفعيل تنبيهات المقالات الجديدة</span>
          <label className={styles.switch}>
            <input type="checkbox" defaultChecked />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span>⚙️</span> خيارات متقدمة
        </h2>
        <button className={styles.dangerBtn} onClick={() => alert('تم مسح التخزين المؤقت')}>
          مسح بيانات التخزين المؤقت
        </button>
      </div>
        <button onClick={() => FirebaseCrashlytics.crash({ message: "Test Crash" })}>
    تجربة الـ Crash
  </button>
    </div>
  )
}

export default Settings