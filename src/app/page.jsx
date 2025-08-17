'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';

const LanguageContext = createContext();

const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('ar');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedLang = localStorage.getItem('language');
            if (savedLang) {
                setLanguage(savedLang);
            }
        }
    }, []);

    const changeLanguage = (lang) => {
        setLanguage(lang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('language', lang);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};


function LandingPage() {
    const router = useRouter();
    const { language, changeLanguage } = useContext(LanguageContext);
    const [selectedLanguage, setSelectedLanguage] = useState(language || 'ar');
    const [dailyVerse, setDailyVerse] = useState(null);
    const [isLoadingVerse, setIsLoadingVerse] = useState(true);

    const [copiedMessage, setCopiedMessage] = useState('');
    const [favouriteMessage, setFavouriteMessage] = useState('');

    useEffect(() => {
        const savedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
        if (savedLang) {
            setSelectedLanguage(savedLang);
            changeLanguage(savedLang);
        } else {
            setSelectedLanguage('ar');
            changeLanguage('ar');
        }
    }, []);

    useEffect(() => {
        const fetchDailyVerse = async () => {
            if (!selectedLanguage || !['ar', 'en', 'fr'].includes(selectedLanguage)) {
                setDailyVerse({
                    verse: getText(
                        "حدث خطأ: لغة غير صالحة.",
                        "Error: Invalid language.",
                        "Erreur: Langue invalide."
                    ),
                    reference: ""
                });
                setIsLoadingVerse(false);
                return;
            }

            setIsLoadingVerse(true);
            let dailyVersesData = [];
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentDay = today.getDate();

            try {
                const module = await import(`../data/dailyVerses/${selectedLanguage}.json`);
                dailyVersesData = module.default;
            } catch (error) {
                console.error(`خطأ في تحميل آيات اليوم للغة ${selectedLanguage}:`, error);
                dailyVersesData = [];
            } finally {
                const verseForToday = dailyVersesData.find(v => v.month === currentMonth && v.day === currentDay);

                setDailyVerse(verseForToday || {
                    verse: getText(
                        "آية اليوم غير متوفرة لهذا التاريخ أو اللغة. يرجى التحقق من بيانات الآيات.",
                        "Daily verse not available for this date or language. Please check verse data.",
                        "Verset du jour non disponible pour cette date ou langue. Veuillez vérifier les données du verset."
                    ),
                    reference: ""
                });
                setIsLoadingVerse(false);
            }
        };

        if (selectedLanguage) {
            fetchDailyVerse();
        }
    }, [selectedLanguage]);

    useEffect(() => {
        if (language && language !== selectedLanguage) {
            setSelectedLanguage(language);
        }
    }, [language, selectedLanguage]);
    
    // Manage confirmation messages
    useEffect(() => {
      let timerId;
      if (copiedMessage || favouriteMessage) {
        timerId = setTimeout(() => {
          setCopiedMessage('');
          setFavouriteMessage('');
        }, 2000);
      }
      return () => {
        if (timerId) {
          clearTimeout(timerId);
        }
      };
    }, [copiedMessage, favouriteMessage]);


    const handleChange = (e) => {
        const lang = e.target.value;
        setSelectedLanguage(lang);
        changeLanguage(lang);
    };

    const goToSearch = () => {
        router.push('/bible/search');
    };

    const goToBible = () => {
        router.push('/bible');
    };
    
    const getText = (ar, en, fr) => {
        return selectedLanguage === 'ar' ? ar : selectedLanguage === 'en' ? en : fr;
    };
    
    const convertToArabicNumber = (num) => {
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[+d]).join('');
    };

    // New functions for Copy and Favorite
    const handleCopyDailyVerse = async () => {
        if (!dailyVerse) return;
        const textToCopy = `"${dailyVerse.verse}" - ${dailyVerse.reference}`;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const el = document.createElement('textarea');
                el.value = textToCopy;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
            setCopiedMessage(getText('تم النسخ!', 'Copied!', 'Copié!'));
        } catch (err) {
            setCopiedMessage(getText('فشل النسخ!', 'Failed to copy!', 'Échec de la copie!'));
        }
    };

    const handleFavouriteDailyVerse = () => {
        if (!dailyVerse) return;
        try {
            const favVerses = JSON.parse(localStorage.getItem('favourite_verses')) || {};
            const chapterKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}`;
            const verseKey = `${chapterKey}-${language}`;
            
            if (favVerses[verseKey]) {
                delete favVerses[verseKey];
                setFavouriteMessage(getText('تم حذف الآية من المفضلة!', 'Verse removed from favorites!', 'Verset retiré des favoris!'));
            } else {
                favVerses[verseKey] = {
                    type: 'verse',
                    verseKey,
                    text: dailyVerse.verse,
                    bookName: getText('آية اليوم', 'Verse of the Day', 'Verset du jour'),
                    bookNameAbbrev: 'Daily',
                    chapter: dailyVerse.month,
                    verseIndex: dailyVerse.day,
                    language: selectedLanguage,
                    isDailyVerse: true
                };
                setFavouriteMessage(getText('تم إضافة الآية إلى المفضلة!', 'Verse added to favorites!', 'Verset ajouté aux favoris!'));
            }
            localStorage.setItem('favourite_verses', JSON.stringify(favVerses));
        } catch (error) {
            setFavouriteMessage(getText('حدث خطأ في الحفظ!', 'Error saving favorite!', 'Erreur lors de la sauvegarde du favori!'));
        }
    };
    
    // Check if the current daily verse is already a favorite
    const isDailyVerseFavourite = dailyVerse && 
        JSON.parse(localStorage.getItem('favourite_verses') || '{}')
        [`daily-verse-${dailyVerse.month}-${dailyVerse.day}-${language}`];


    return (
        <main className={`${styles.container} ${selectedLanguage === 'ar' ? styles.rtl : ''}`}>
            <h1 className={`${styles.heading} ${styles.floating}`}>
                {getText('مرحباً بك في تطبيق Agios', 'Welcome to the Bible Study App', 'Bienvenue dans l\'application d\'étude de la Bible')}
            </h1>

            {isLoadingVerse ? (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <p>{getText("جارٍ تحميل آية اليوم...", "Loading daily verse...", "Chargement du verset du jour...")}</p>
                </div>
            ) : (
                dailyVerse && (
                    <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                        <h2 className={styles.dailyVerseTitle}>
                            {getText('آية اليوم', 'Verse of the Day', 'Verset du jour')}
                        </h2>
                        <p className={styles.dailyVerseText}>
                            "{dailyVerse.verse}"
                        </p>
                        <p className={styles.dailyVerseReference}>
                            {dailyVerse.reference}
                        </p>
                        {/* Action buttons for daily verse */}
                        <div className={styles.dailyVerseActions}>
                            <button 
                                onClick={handleCopyDailyVerse} 
                                className={styles.actionButton}
                                title={getText('نسخ الآية', 'Copy Verse', 'Copier le verset')}
                            >
                                📋 {getText('نسخ', 'Copy', 'Copier')}
                            </button>
                            <button 
                                onClick={handleFavouriteDailyVerse} 
                                className={`${styles.actionButton} ${isDailyVerseFavourite ? styles.isFavourite : ''}`}
                                title={getText('أضف للمفضلة', 'Add to Favorites', 'Ajouter aux favoris')}
                            >
                                ⭐ {isDailyVerseFavourite ? getText('مضافة', 'Added', 'Ajouté') : getText('مفضلة', 'Favorite', 'Favoris')}
                            </button>
                        </div>
                    </div>
                )
            )}
            
            {/* Confirmation messages */}
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
}

const App = () => {
    return (
        <LanguageProvider>
            <LandingPage />
        </LanguageProvider>
    );
};

export default App;