'use client';

import React, { useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';

const LanguageContext = createContext();

const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('ar');

    useEffect(() => {
        const savedLang = localStorage?.getItem('language');
        if (savedLang) setLanguage(savedLang);
    }, []);

    const changeLanguage = useCallback((lang) => {
        setLanguage(lang);
        localStorage?.setItem('language', lang);
    }, []);

    const value = useMemo(() => ({ language, changeLanguage }), [language, changeLanguage]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

const useLanguage = () => useContext(LanguageContext);

const SUPPORTED_LANGUAGES = ['ar', 'en', 'fr'];

const TEXT_TRANSLATIONS = {
    welcome: {
        ar: 'مرحباً بك في تطبيق Agios',
        en: 'Welcome to the Bible Study App',
        fr: "Bienvenue dans l'application d'étude de la Bible"
    },
    verseOfDay: {
        ar: 'آية اليوم',
        en: 'Verse of the Day',
        fr: 'Verset du jour'
    },
    loading: {
        ar: "جارٍ تحميل آية اليوم...",
        en: "Loading daily verse...",
        fr: "Chargement du verset du jour..."
    },
    notAvailable: {
        ar: "آية اليوم غير متوفرة لهذا التاريخ أو اللغة. يرجى التحقق من بيانات الآيات.",
        en: "Daily verse not available for this date or language. Please check verse data.",
        fr: "Verset du jour non disponible pour cette date ou langue. Veuillez vérifier les données du verset."
    },
    invalidLanguage: {
        ar: "حدث خطأ: لغة غير صالحة.",
        en: "Error: Invalid language.",
        fr: "Erreur: Langue invalide."
    },
    copy: { ar: 'نسخ', en: 'Copy', fr: 'Copier' },
    favorite: { ar: 'مفضلة', en: 'Favorite', fr: 'Favoris' },
    added: { ar: 'مضافة', en: 'Added', fr: 'Ajouté' },
    copied: { ar: 'تم النسخ!', en: 'Copied!', fr: 'Copié!' },
    copyFailed: { ar: 'فشل النسخ!', en: 'Failed to copy!', fr: 'Échec de la copie!' },
    addedToFav: { ar: 'تم إضافة الآية إلى المفضلة!', en: 'Verse added to favorites!', fr: 'Verset ajouté aux favoris!' },
    removedFromFav: { ar: 'تم حذف الآية من المفضلة!', en: 'Verse removed from favorites!', fr: 'Verset retiré des favoris!' },
    saveError: { ar: 'حدث خطأ في الحفظ!', en: 'Error saving favorite!', fr: 'Erreur lors de la sauvegarde du favori!' }
};

const useMessage = (duration = 2000) => {
    const [message, setMessage] = useState('');

    const showMessage = useCallback((msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), duration);
    }, [duration]);

    return [message, showMessage];
};

const useFavorites = () => {
    const getFavorites = useCallback(() => {
        try {
            return JSON.parse(localStorage?.getItem('favourite_verses') || '{}');
        } catch {
            return {};
        }
    }, []);

    const saveFavorites = useCallback((favorites) => {
        localStorage?.setItem('favourite_verses', JSON.stringify(favorites));
    }, []);

    return { getFavorites, saveFavorites };
};

const LandingPage = () => {
    const router = useRouter();
    const { language, changeLanguage } = useLanguage();
    const [selectedLanguage, setSelectedLanguage] = useState(language);
    const [dailyVerse, setDailyVerse] = useState(null);
    const [isLoadingVerse, setIsLoadingVerse] = useState(true);
    const [copiedMessage, showCopiedMessage] = useMessage();
    const [favouriteMessage, showFavouriteMessage] = useMessage();
    const { getFavorites, saveFavorites } = useFavorites();

    const getText = useCallback((key) => TEXT_TRANSLATIONS[key]?.[selectedLanguage], [selectedLanguage]);

    const fetchDailyVerse = useCallback(async () => {
        if (!SUPPORTED_LANGUAGES.includes(selectedLanguage)) {
            setDailyVerse({ verse: getText('invalidLanguage'), reference: "" });
            setIsLoadingVerse(false);
            return;
        }

        setIsLoadingVerse(true);
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        try {
            const module = await import(`../data/dailyVerses/${selectedLanguage}.json`);
            const dailyVersesData = module.default;
            const verseForToday = dailyVersesData.find(v => v.month === currentMonth && v.day === currentDay);
            
            setDailyVerse(verseForToday || { verse: getText('notAvailable'), reference: "" });
        } catch (error) {
            console.error(`Error loading verses for ${selectedLanguage}:`, error);
            setDailyVerse({ verse: getText('notAvailable'), reference: "" });
        } finally {
            setIsLoadingVerse(false);
        }
    }, [selectedLanguage, getText]);

    const handleLanguageChange = useCallback((e) => {
        const lang = e.target.value;
        setSelectedLanguage(lang);
        changeLanguage(lang);
    }, [changeLanguage]);

    const copyDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        
        const textToCopy = `"${dailyVerse.verse}" - ${dailyVerse.reference}`;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const el = document.createElement('textarea');
                el.value = textToCopy;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
            showCopiedMessage(getText('copied'));
        } catch {
            showCopiedMessage(getText('copyFailed'));
        }
    }, [dailyVerse, getText, showCopiedMessage]);

    const toggleFavoriteDailyVerse = useCallback(() => {
        if (!dailyVerse) return;
        
        try {
            const favorites = getFavorites();
            const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-${selectedLanguage}`;
            
            if (favorites[verseKey]) {
                delete favorites[verseKey];
                showFavouriteMessage(getText('removedFromFav'));
            } else {
                favorites[verseKey] = {
                    type: 'verse',
                    verseKey,
                    text: dailyVerse.verse,
                    bookName: getText('verseOfDay'),
                    bookNameAbbrev: 'Daily',
                    chapter: dailyVerse.month,
                    verseIndex: dailyVerse.day,
                    language: selectedLanguage,
                    isDailyVerse: true
                };
                showFavouriteMessage(getText('addedToFav'));
            }
            saveFavorites(favorites);
        } catch {
            showFavouriteMessage(getText('saveError'));
        }
    }, [dailyVerse, selectedLanguage, getFavorites, saveFavorites, getText, showFavouriteMessage]);

    const isDailyVerseFavorite = useMemo(() => {
        if (!dailyVerse) return false;
        const favorites = getFavorites();
        return !!favorites[`daily-verse-${dailyVerse.month}-${dailyVerse.day}-${selectedLanguage}`];
    }, [dailyVerse, selectedLanguage, getFavorites]);

    useEffect(() => {
        const savedLang = localStorage?.getItem('language');
        const initialLang = savedLang || 'ar';
        setSelectedLanguage(initialLang);
        changeLanguage(initialLang);
    }, [changeLanguage]);

    useEffect(() => {
        if (selectedLanguage) fetchDailyVerse();
    }, [selectedLanguage, fetchDailyVerse]);

    useEffect(() => {
        if (language && language !== selectedLanguage) {
            setSelectedLanguage(language);
        }
    }, [language, selectedLanguage]);

    const navigationButtons = [
        { text: getText('copy'), onClick: () => router.push('/bible/search') },
        { text: getText('favorite'), onClick: () => router.push('/bible') }
    ];

    return (
        <main className={`${styles.container} ${selectedLanguage === 'ar' ? styles.rtl : ''}`}>
            <h1 className={`${styles.heading} ${styles.floating}`}>
                {getText('welcome')}
            </h1>

            <div className={`${styles.languageContainer} ${styles.floating}`}>
                <label className={styles.languageLabel}>
                    {selectedLanguage === 'ar' ? 'اللغة:' : selectedLanguage === 'en' ? 'Language:' : 'Langue:'}
                </label>
                <select 
                    value={selectedLanguage} 
                    onChange={handleLanguageChange}
                    className={styles.languageSelect}
                >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                </select>
            </div>

            {isLoadingVerse ? (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <p>{getText('loading')}</p>
                </div>
            ) : dailyVerse && (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <h2 className={styles.dailyVerseTitle}>
                        {getText('verseOfDay')}
                    </h2>
                    <p className={styles.dailyVerseText}>
                        "{dailyVerse.verse}"
                    </p>
                    <p className={styles.dailyVerseReference}>
                        {dailyVerse.reference}
                    </p>
                    <div className={styles.dailyVerseActions}>
                        <button 
                            onClick={copyDailyVerse} 
                            className={styles.actionButton}
                            aria-label={getText('copy')}
                        >
                            📋 {getText('copy')}
                        </button>
                        <button 
                            onClick={toggleFavoriteDailyVerse} 
                            className={`${styles.actionButton} ${isDailyVerseFavorite ? styles.isFavourite : ''}`}
                            aria-label={getText('favorite')}
                        >
                            ⭐ {isDailyVerseFavorite ? getText('added') : getText('favorite')}
                        </button>
                    </div>
                </div>
            )}


            {copiedMessage && (
                <div className={`${styles.messageBox} ${styles.copiedMessage}`}>
                    {copiedMessage}
                </div>
            )}
            {favouriteMessage && (
                <div className={`${styles.messageBox} ${styles.favouriteMessage}`}>
                    {favouriteMessage}
                </div>
            )}
        </main>
    );
};

const App = () => (
    <LanguageProvider>
        <LandingPage />
    </LanguageProvider>
);

export default App;