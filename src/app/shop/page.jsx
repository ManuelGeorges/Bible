'use client';

import React from 'react';
import styles from './page.module.css';
import { useLanguage } from '../context/LanguageContext';
import { FaStoreSlash } from 'react-icons/fa';

export default function Shop() {
  const { strings, dir } = useLanguage();

  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        gap: '20px'
      }}>
        <FaStoreSlash size={80} style={{ color: '#999', marginBottom: '20px' }} />
        <h1 className={styles.header}>{strings.shop?.title || 'متجر أجيوس'}</h1>
        <p className={styles.subtitle} style={{ fontSize: '1.2rem', maxWidth: '500px' }}>
          {dir === 'rtl'
            ? 'المتجر غير متاح حالياً. نحن نعمل على تحديثه وتوفير مميزات جديدة لكم، انتظرونا قريباً!'
            : 'The shop is currently unavailable. We are working on updates and new features, stay tuned!'}
        </p>
      </div>
    </div>
  );
}
