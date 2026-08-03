"use client";

import React from 'react';
import { useLanguage } from '../app/context/LanguageContext';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import styles from './LanguageWelcome.module.css';

const languages = [
    { code: 'ar', name: 'العربية', flag: '🇪🇬', native: 'Arabic' },
    { code: 'en', name: 'English', flag: '🇺🇸', native: 'English' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', native: 'French' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', native: 'German' },
];

export default function LanguageWelcome() {
    const {
        changeLanguage,
        isFirstTime,
        isHydrated,
        strings,
        finishFirstTime,
        onboardingStep,
        setOnboardingStep
    } = useLanguage();
    const { setTheme } = useTheme();

    if (!isHydrated || !isFirstTime) return null;

    const handleLanguageSelect = async (code) => {
        await changeLanguage(code);
        setOnboardingStep('theme');
    };

    const handleThemeSelect = (themeName) => {
        setTheme(themeName);
        finishFirstTime();
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                {onboardingStep === 'language' ? (
                    <>
                        <h1 className={styles.title}>Welcome to Agios</h1>
                        <p className={styles.subtitle}>Please choose your preferred language</p>

                        <div className={styles.grid}>
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    className={styles.langButton}
                                    onClick={() => handleLanguageSelect(lang.code)}
                                >
                                    <div className={styles.langInfo}>
                                        <span className={styles.flag}>{lang.flag}</span>
                                        <span>{lang.name}</span>
                                    </div>
                                    <span className={styles.arrow}>→</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <h1 className={styles.title}>{strings.welcome?.theme_title || "App Appearance"}</h1>
                        <p className={styles.subtitle}>{strings.welcome?.theme_subtitle || "Choose the look that suits your eyes"}</p>

                        <div className={styles.themeGrid}>
                            <button
                                className={styles.themeOption}
                                onClick={() => handleThemeSelect('light')}
                            >
                                <div className={styles.themeIconBox} style={{ background: '#f8fafc', color: '#f59e0b' }}>
                                    <Sun size={32} />
                                </div>
                                <span className={styles.themeLabel}>{strings.welcome?.light_mode || "Light Mode"}</span>
                            </button>

                            <button
                                className={styles.themeOption}
                                onClick={() => handleThemeSelect('dark')}
                            >
                                <div className={styles.themeIconBox} style={{ background: '#1e293b', color: '#6366f1' }}>
                                    <Moon size={32} />
                                </div>
                                <span className={styles.themeLabel}>{strings.welcome?.dark_mode || "Dark Mode"}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
