'use client';

import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';

export default function SettingsPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedFontSize = localStorage.getItem('bibleFontSize') || '18';
    
    setIsDarkMode(savedTheme === 'dark');
    setFontSize(parseInt(savedFontSize));
    
    applyTheme(savedTheme);
    document.documentElement.style.setProperty('--main-font-size', savedFontSize + 'px');
  }, []);

  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const handleFontSizeChange = (e) => {
    const newSize = e.target.value;
    setFontSize(newSize);
    localStorage.setItem('bibleFontSize', newSize);
    document.documentElement.style.setProperty('--main-font-size', newSize + 'px');
  };

  return (
    <div className={styles.container} dir="rtl">
      <h1 className={styles.title}>الإعدادات</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🎨 المظهر</h2>
        <div className={styles.settingRow}>
          <span>الوضع الداكن (Dark Mode)</span>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={isDarkMode} 
              onChange={toggleTheme} 
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📖 إعدادات القراءة</h2>
        <div className={styles.settingRow}>
          <div className={styles.fontInfo}>
            <span>حجم الخط العام</span>
            <span className={styles.sizeBadge}>{fontSize}px</span>
          </div>
          <input 
            type="range" 
            min="16" 
            max="35" 
            step="1"
            value={fontSize} 
            onChange={handleFontSizeChange}
            className={styles.rangeInput}
          />
        </div>
        <div className={styles.previewContainer}>
          <p style={{ fontSize: 'var(--main-font-size)' }}>
            هذا نص تجريبي لمعاينة الحجم المختار.
          </p>
        </div>
      </div>

      <div className={styles.footer}>
        v1.0.0
      </div>
    </div>
  );
}