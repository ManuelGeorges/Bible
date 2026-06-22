"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
// استيراد ملفات الترجمة من المجلد الجديد في src/data
import ar from '../../data/translations/arabic/ar.json';
import en from '../../data/translations/English/en.json';
import de from '../../data/translations/german/de.json';
import fr from '../../data/translations/French/fr.json';

// استيراد أسماء الكتب مباشرة
import allBookNames from '../../data/bookNames.json';

const LanguageContext = createContext();

const translations = { ar, en, de, fr };

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('ar');
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
        setIsHydrated(true);
    }, []);

    const strings = useMemo(() => translations[language] || translations.ar, [language]);

    const bookNames = useMemo(() => {
        if (!allBookNames) return [];
        return allBookNames[language] || allBookNames.ar || [];
    }, [language]);

    const dir = useMemo(() => (language === 'ar' ? 'rtl' : 'ltr'), [language]);

    useEffect(() => {
        if (isHydrated) {
            document.documentElement.lang = language;
            document.documentElement.dir = dir;
        }
    }, [language, dir, isHydrated]);

    const changeLanguage = (newLang) => {
        if (translations[newLang]) {
            setLanguage(newLang);
            localStorage.setItem('app_lang', newLang);
            setIsFirstTime(false);
        }
    };

    const formatNumber = useCallback((num) => {
        if (num === null || num === undefined) return "";
        if (language !== 'ar') return num.toString();
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[+d] || d).join('');
    }, [language]);

    const value = {
        language,
        strings,
        bookNames,
        allBookNames,
        dir,
        changeLanguage,
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
