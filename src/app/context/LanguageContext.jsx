"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import allBookNames from '../data/bookNames.json';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('ar');
    const [parallelLanguage, setParallelLanguage] = useState(null);
    const [strings, setStrings] = useState(null);
    const { theme } = useTheme();
    const [useTashkeel, setUseTashkeel] = useState(false);
    const [isFirstTime, setIsFirstTime] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // دالة لتحميل الترجمة ديناميكياً لتقليل حجم الحزمة الابتدائية
    const loadTranslations = useCallback(async (lang) => {
        try {
            let data;
            switch (lang) {
                case 'en': data = await import('../data/translations/English/en.json'); break;
                case 'de': data = await import('../data/translations/german/de.json'); break;
                case 'fr': data = await import('../data/translations/French/fr.json'); break;
                default: data = await import('../data/translations/arabic/ar.json'); break;
            }
            setStrings(data.default || data);
        } catch (error) {
            console.error("Error loading translation:", error);
            // Fallback to Arabic if error occurs
            const fallback = await import('../data/translations/arabic/ar.json');
            setStrings(fallback.default || fallback);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const savedLang = localStorage.getItem('app_lang') || 'ar';
            setLanguage(savedLang);
            await loadTranslations(savedLang);

            const savedParallel = localStorage.getItem('parallel_lang');
            if (savedParallel) {
                setParallelLanguage(savedParallel);
            }

            const savedTashkeel = localStorage.getItem('useTashkeel') === 'true';
            setUseTashkeel(savedTashkeel);

            setIsHydrated(true);
        };
        init();
    }, [loadTranslations]);

    const bookNames = useMemo(() => {
        if (!allBookNames) return [];
        return allBookNames[language] || allBookNames.ar || [];
    }, [language]);

    const dir = useMemo(() => (language === 'ar' ? 'rtl' : 'ltr'), [language]);

    // مزامنة اللغة مع نظام الأندرويد
    useEffect(() => {
        if (isHydrated) {
            document.documentElement.lang = language;
            document.documentElement.dir = dir;

            const syncLang = async () => {
                try {
                    await Preferences.set({ key: 'language', value: language });
                    if (window.AgiosScannerNative?.refreshAlarms) {
                        window.AgiosScannerNative.refreshAlarms();
                    }
                } catch (e) {
                    console.error("Language Sync Error:", e);
                }
            };
            syncLang();
        }
    }, [language, dir, isHydrated]);

    // مزامنة الثيم مع نظام الأندرويد
    useEffect(() => {
        if (isHydrated && Capacitor.isNativePlatform() && theme) {
            const syncTheme = async () => {
                try {
                    await Preferences.set({ key: 'theme', value: theme });
                    if (window.AgiosScannerNative?.refreshWidgets) {
                        window.AgiosScannerNative.refreshWidgets();
                    }
                } catch (e) {
                    console.error("Theme Sync Error:", e);
                }
            };
            syncTheme();
        }
    }, [theme, isHydrated]);

    const changeLanguage = async (newLang) => {
        setIsHydrated(false); // إظهار حالة التحميل البسيطة
        await loadTranslations(newLang);
        setLanguage(newLang);
        localStorage.setItem('app_lang', newLang);
        setIsHydrated(true);
        setIsFirstTime(false);

        if (parallelLanguage === newLang) {
            setParallelLanguage(null);
            localStorage.removeItem('parallel_lang');
        }
    };

    const changeParallelLanguage = (newLang) => {
        if (newLang === null) {
            setParallelLanguage(null);
            localStorage.removeItem('parallel_lang');
        } else {
            setParallelLanguage(newLang);
            localStorage.setItem('parallel_lang', newLang);
        }
        window.dispatchEvent(new Event('storage'));
    };

    const toggleTashkeel = useCallback(() => {
        setUseTashkeel(prev => {
            const newState = !prev;
            localStorage.setItem('useTashkeel', newState.toString());
            window.dispatchEvent(new Event('storage'));
            return newState;
        });
    }, []);

    const formatNumber = useCallback((num) => {
        if (num === null || num === undefined) return "";
        if (language !== 'ar') return num.toString();
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[+d] || d).join('');
    }, [language]);

    const value = {
        language,
        parallelLanguage,
        useTashkeel,
        strings,
        bookNames,
        allBookNames,
        dir,
        changeLanguage,
        changeParallelLanguage,
        toggleTashkeel,
        isFirstTime,
        setIsFirstTime,
        isHydrated,
        formatNumber
    };

    // منع ظهور محتوى فارغ أو مكسور قبل تحميل الترجمة
    if (!isHydrated || !strings) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-bg-start)',
                color: 'var(--color-text-primary)',
                fontFamily: 'sans-serif'
            }}>
                ...
            </div>
        );
    }

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
