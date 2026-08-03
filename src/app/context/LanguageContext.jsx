"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Preferences } from '@capacitor/preferences';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import allBookNames from '../data/bookNames.json';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const pathname = usePathname();
    const [language, setLanguage] = useState('ar');
    const [parallelLanguage, setParallelLanguage] = useState(null);
    const [strings, setStrings] = useState(null);
    const { theme, setTheme } = useTheme();
    const [useTashkeel, setUseTashkeel] = useState(false);

    // إعدادات إبقاء الشاشة مضيئة
    const [keepAppAwake, setKeepAppAwake] = useState(true);
    const [keepBibleAwake, setKeepBibleAwake] = useState(true);

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
            const savedLang = localStorage.getItem('app_lang');
            if (!savedLang) {
                setIsFirstTime(true);
                setLanguage('ar');
                await loadTranslations('ar');
            } else {
                setLanguage(savedLang);
                await loadTranslations(savedLang);
            }

            const savedParallel = localStorage.getItem('parallel_lang');
            if (savedParallel) {
                setParallelLanguage(savedParallel);
            }

            const savedTashkeel = localStorage.getItem('useTashkeel') === 'true';
            setUseTashkeel(savedTashkeel);

            // تحميل إعدادات إبقاء الشاشة (تفعيل تلقائي إذا لم يكن هناك إعداد مسبق)
            const appAwakeRaw = localStorage.getItem('keepAppAwake');
            const bibleAwakeRaw = localStorage.getItem('keepBibleAwake');

            const appAwake = appAwakeRaw === null ? true : appAwakeRaw === 'true';
            const bibleAwake = bibleAwakeRaw === null ? true : bibleAwakeRaw === 'true';

            setKeepAppAwake(appAwake);
            setKeepBibleAwake(bibleAwake);

            setIsHydrated(true);
        };
        init();
    }, [loadTranslations]);

    // منطق التحكم في إبقاء الشاشة مضيئة بناءً على المسار والإعدادات
    useEffect(() => {
        if (!isHydrated || !Capacitor.isNativePlatform()) return;

        const updateAwakeStatus = async () => {
            try {
                if (keepAppAwake) {
                    await KeepAwake.keepAwake();
                } else if (keepBibleAwake && pathname?.includes('/bible')) {
                    await KeepAwake.keepAwake();
                } else {
                    await KeepAwake.allowSleep();
                }
            } catch (e) {
                console.error("Awake Status Error:", e);
            }
        };

        updateAwakeStatus();
    }, [keepAppAwake, keepBibleAwake, pathname, isHydrated]);

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
        setIsHydrated(false);
        await loadTranslations(newLang);
        setLanguage(newLang);
        localStorage.setItem('app_lang', newLang);
        setIsHydrated(true);

        if (parallelLanguage === newLang) {
            setParallelLanguage(null);
            localStorage.removeItem('parallel_lang');
        }
    };

    const finishFirstTime = () => {
        setIsFirstTime(false);
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

    const toggleKeepAppAwake = useCallback(async () => {
        setKeepAppAwake(prev => {
            const newState = !prev;
            localStorage.setItem('keepAppAwake', newState.toString());
            return newState;
        });
    }, []);

    const toggleKeepBibleAwake = useCallback(() => {
        setKeepBibleAwake(prev => {
            const newState = !prev;
            localStorage.setItem('keepBibleAwake', newState.toString());
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
        keepAppAwake,
        keepBibleAwake,
        strings,
        bookNames,
        allBookNames,
        dir,
        changeLanguage,
        changeParallelLanguage,
        toggleTashkeel,
        toggleKeepAppAwake,
        toggleKeepBibleAwake,
        isFirstTime,
        setIsFirstTime,
        finishFirstTime,
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
