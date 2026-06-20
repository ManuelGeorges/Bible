"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import ar from '../data/ar.json';
import en from '../data/en.json';
import de from '../data/de.json';
import it from '../data/it.json';
import fr from '../data/fr.json';

const LanguageContext = createContext();

const translations = { ar, en, de, it, fr };

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
            // إذا لم توجد لغة محفوظة، نعتبرها أول زيارة
            setIsFirstTime(true);
        }
        setIsHydrated(true);
    }, []);

    const strings = useMemo(() => translations[language] || translations.ar, [language]);
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
            setIsFirstTime(false); // إخفاء واجهة الترحيب بمجرد الاختيار
        }
    };

    const value = {
        language,
        strings,
        dir,
        changeLanguage,
        isFirstTime,
        setIsFirstTime,
        isHydrated
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
