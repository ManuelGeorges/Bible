"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
// استيراد ملفات الترجمة من المجلد الجديد في src/app/data
import ar from '../data/translations/arabic/ar.json';
import en from '../data/translations/English/en.json';
import de from '../data/translations/german/de.json';
import fr from '../data/translations/French/fr.json';

// استيراد أسماء الكتب مباشرة
import allBookNames from '../data/bookNames.json';

const LanguageContext = createContext();

const translations = { ar, en, de, fr };

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('ar');
    const { theme } = useTheme();
    const [useTashkeel, setUseTashkeel] = useState(false);
    const [isFirstTime, setIsFirstTime] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const savedLang = localStorage.getItem('app_lang');
        if (savedLang && translations[savedLang]) {
            setLanguage(savedLang);
            setIsFirstTime(false);
        } else {
            setIsFirstTime(true);
        }

        const savedTashkeel = localStorage.getItem('useTashkeel') === 'true';
        setUseTashkeel(savedTashkeel);

        setIsHydrated(true);
    }, []);

    const strings = useMemo(() => translations[language] || translations.ar, [language]);

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

    // مزامنة الثيم مع نظام الأندرويد فور التغيير أو التحميل لضمان تحديث الويدجت
    useEffect(() => {
        if (isHydrated && Capacitor.isNativePlatform() && theme) {
            const syncTheme = async () => {
                try {
                    await Preferences.set({ key: 'theme', value: theme });
                    // إشعار الأندرويد بتحديث الويدجت ليعكس الثيم الجديد فوراً
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
        if (translations[newLang]) {
            setLanguage(newLang);
            localStorage.setItem('app_lang', newLang);
            setIsFirstTime(false);
        }
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
        useTashkeel,
        strings,
        bookNames,
        allBookNames,
        dir,
        changeLanguage,
        toggleTashkeel,
        isFirstTime,
        setIsFirstTime,
        isHydrated,
        formatNumber
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
