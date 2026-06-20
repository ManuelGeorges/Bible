"use client";

import React from 'react';
import { useLanguage } from '../app/context/LanguageContext';
import styles from './LanguageWelcome.module.css';

const languages = [
    { code: 'ar', name: 'العربية', flag: '🇪🇬', native: 'Arabic' },
    { code: 'en', name: 'English', flag: '🇺🇸', native: 'English' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', native: 'French' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', native: 'German' },
];

export default function LanguageWelcome() {
    const { changeLanguage, isFirstTime, isHydrated } = useLanguage();

    if (!isHydrated || !isFirstTime) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <h1 className={styles.title}>Welcome to Agios</h1>
                <p className={styles.subtitle}>Please choose your preferred language</p>

                <div className={styles.grid}>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            className={styles.langButton}
                            onClick={() => changeLanguage(lang.code)}
                        >
                            <div className={styles.langInfo}>
                                <span className={styles.flag}>{lang.flag}</span>
                                <span>{lang.name}</span>
                            </div>
                            <span className={styles.arrow}>→</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
