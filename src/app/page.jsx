'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
const allPlans = studyPlansData.plans;

const useMessage = (duration = 2000) => {
    const [message, setMessage] = useState('');
    const showMessage = useCallback((msg) => {
        setMessage(msg);
        const timer = setTimeout(() => setMessage(''), duration);
        return () => clearTimeout(timer);
    }, [duration]);
    return [message, showMessage];
};

const useFavorites = () => {
    const getFavorites = useCallback(() => {
        try {
            return JSON.parse(localStorage?.getItem('favourite_verses') || '{}');
        } catch { return {}; }
    }, []);
    const saveFavorites = useCallback((favorites) => {
        localStorage?.setItem('favourite_verses', JSON.stringify(favorites));
    }, []);
    return { getFavorites, saveFavorites };
};

const getPlanCompletionData = (planId) => {
    if (typeof window !== 'undefined') {
        const storedCompletedDays = localStorage.getItem(`completedDays_${planId}`);
        if (storedCompletedDays) {
            const completedDays = JSON.parse(storedCompletedDays);
            const daysCompletedCount = Object.values(completedDays).filter(Boolean).length;
            const totalDays = allPlans.find(p => p.id === planId)?.readings.length || 0;
            const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;
            return { daysCompletedCount, totalDays, completionPercentage };
        }
    }
    return { daysCompletedCount: 0, totalDays: 0, completionPercentage: 0 };
};

const getStartedPlans = () => {
    if (typeof window === 'undefined') return [];
    return allPlans.filter(plan => {
        const completionData = getPlanCompletionData(plan.id);
        return completionData.daysCompletedCount > 0;
    });
};

const LandingPage = () => {
    const router = useRouter();
    const [dailyVerse, setDailyVerse] = useState(null);
    const [dailyQuestion, setDailyQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [isLoadingVerse, setIsLoadingVerse] = useState(true);
    const [copiedMessage, showCopiedMessage] = useMessage();
    const [favouriteMessage, showFavouriteMessage] = useMessage();
    const [questionMessage, showQuestionMessage] = useMessage(3000);
    const { getFavorites, saveFavorites } = useFavorites();
    const [startedPlans, setStartedPlans] = useState([]);
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');

    // --- منطق زر التثبيت الجديد ---
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setDeferredPrompt(null);
            setShowInstallBtn(false);
        }
    };
    // ----------------------------

    const getTodayDateKey = useCallback(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }, []);

    const fetchDailyVerse = useCallback(async () => {
        setIsLoadingVerse(true);
        const today = new Date();
        try {
            const response = await fetch('/data/dailyVerses.json');
            const dailyVersesData = await response.json();
            const verseForToday = dailyVersesData.find(v => v.month === today.getMonth() + 1 && v.day === today.getDate());
            setDailyVerse(verseForToday || { verse: 'آية اليوم غير متوفرة', reference: '' });
        } catch (error) {
            setDailyVerse({ verse: 'خطأ في التحميل', reference: '' });
        } finally { setIsLoadingVerse(false); }
    }, []);

    const fetchDailyQuestion = useCallback(async (loggedInUser) => {
        const dateKey = getTodayDateKey();
        try {
            const response = await fetch('/data/dailyQuestions.json');
            const dailyQuestionsData = await response.json();
            const questionForToday = dailyQuestionsData.find(q => q.month === new Date().getMonth() + 1 && q.day === new Date().getDate());
            setDailyQuestion(questionForToday || null);

            let answeredLocally = localStorage.getItem(`questionAnswered_${dateKey}`) === 'true';
            if (loggedInUser) {
                const userRef = doc(firestore, 'users', loggedInUser.uid);
                const userSnap = await getDoc(userRef);
                const firestoreData = userSnap.exists() ? userSnap.data() : {};
                if (firestoreData.answeredQuestions?.[dateKey]?.answered) {
                    setHasAnswered(true);
                    localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
                } else { setHasAnswered(answeredLocally); }
            } else { setHasAnswered(answeredLocally); }
        } catch (error) { setDailyQuestion(null); }
    }, [getTodayDateKey]);

    useEffect(() => {
        if (auth) {
            const unsubscribe = auth.onAuthStateChanged((u) => {
                setUser(u);
                fetchDailyQuestion(u);
            });
            return () => unsubscribe();
        }
        fetchDailyQuestion(null);
    }, [fetchDailyQuestion]);

    useEffect(() => { fetchDailyVerse(); }, [fetchDailyVerse]);
    useEffect(() => { setStartedPlans(getStartedPlans()); }, []);

    const copyDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        const textToCopy = `"${dailyVerse.verse}" - (${dailyVerse.reference})`; 
        await navigator.clipboard.writeText(textToCopy);
        showCopiedMessage('تم النسخ بنجاح!');
    }, [dailyVerse, showCopiedMessage]);

    const toggleFavoriteDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        const favorites = getFavorites();
        const isCurrentlyFavorite = !!favorites[verseKey];
        let newFavorites = { ...favorites };

        if (isCurrentlyFavorite) { delete newFavorites[verseKey]; showFavouriteMessage('تم الحذف!'); }
        else {
            newFavorites[verseKey] = { text: dailyVerse.verse, bookName: 'آية اليوم', dateAdded: new Date().toISOString() };
            showFavouriteMessage('تمت الإضافة!');
        }
        saveFavorites(newFavorites);
        if (user) {
            await setDoc(doc(firestore, 'users', user.uid), { favorites: { verses: newFavorites } }, { merge: true });
        }
    }, [dailyVerse, getFavorites, saveFavorites, showFavouriteMessage, user]);

    const isDailyVerseFavorite = useMemo(() => {
        if (!dailyVerse) return false;
        return !!getFavorites()[`daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`];
    }, [dailyVerse, getFavorites]);

    const handleOptionClick = useCallback(async (index) => {
        const dateKey = getTodayDateKey();
        if (hasAnswered || !dailyQuestion) return;
        setSelectedAnswer(index);
        const isCorrect = index === dailyQuestion.answerIndex;
        localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
        setHasAnswered(true);
        showQuestionMessage(isCorrect ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة. 😔');
    }, [hasAnswered, dailyQuestion, showQuestionMessage, getTodayDateKey]);

    const getOptionClassName = (index) => {
        if (!hasAnswered) return styles.optionButton;
        if (index === dailyQuestion.answerIndex) return `${styles.optionButton} ${styles.correctAnswer}`;
        if (index === selectedAnswer) return `${styles.optionButton} ${styles.wrongAnswer}`;
        return styles.optionButton;
    };

    return (
        <main className={`${styles.container} ${styles.rtl}`}>
            <header className={styles.header}>
                <img src="/images/Agios.png" alt="Agios logo" className={styles.logoImg} />
                <h1 className={styles.siteTitle}>Agios Bible</h1>
                <h2 className={styles.subtitle}>مرحباً بك في تطبيقك لدراسة الكتاب المقدس</h2>
            </header>

            {/* --- قسم زر التثبيت الجديد --- */}
            {showInstallBtn && (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`} style={{ border: '2px dashed #fbbf24', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '10px' }}>ثبّت التطبيق الآن</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>للوصول السريع للكتاب المقدس في أي وقت حتى بدون إنترنت</p>
                    <button onClick={handleInstallClick} className={styles.cardButton} style={{ width: '100%' }}>
                        تثبيت على الجهاز 📱
                    </button>
                </div>
            )}
            {/* ---------------------------- */}

            {isLoadingVerse ? (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}><p>جارٍ التحميل...</p></div>
            ) : dailyVerse && (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <h2 className={styles.dailyVerseTitle}>آية اليوم</h2>
                    <p className={styles.dailyVerseText}>"{dailyVerse.verse}"</p>
                    <p className={styles.dailyVerseReference}>{dailyVerse.reference}</p>
                    <div className={styles.dailyVerseActions}>
                        <button onClick={copyDailyVerse} className={styles.actionButton}>📋 نسخ</button>
                        <button onClick={toggleFavoriteDailyVerse} className={`${styles.actionButton} ${isDailyVerseFavorite ? styles.isFavourite : ''}`}>
                            ⭐ {isDailyVerseFavorite ? 'مضافة' : 'مفضلة'}
                        </button>
                    </div>
                </div>
            )}

            {dailyQuestion && (
                <div className={`${styles.dailyQuestionBox} ${styles.floating}`}>
                    <h2 className={styles.dailyQuestionTitle}>سؤال اليوم</h2>
                    <p className={styles.dailyQuestionText}>{dailyQuestion.question}</p>
                    <div className={styles.optionsContainer}>
                        {dailyQuestion.options.map((option, index) => (
                            <button key={index} onClick={() => handleOptionClick(index)} className={getOptionClassName(index)} disabled={hasAnswered}>
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* الرسائل المنبثقة */}
            {copiedMessage && <div className={`${styles.messageBox} ${styles.copiedMessage}`}>{copiedMessage}</div>}
            {favouriteMessage && <div className={`${styles.messageBox} ${styles.favouriteMessage}`}>{favouriteMessage}</div>}
            {questionMessage && <div className={`${styles.messageBox} ${styles.questionMessage}`}>{questionMessage}</div>}

            {startedPlans.length > 0 && (
                <section className={styles.plansSection}>
                    <h2 className={styles.plansSectionTitle}>تابع خططك</h2>
                    <div className={styles.plansGrid}>
                        {startedPlans.map(plan => {
                            const { daysCompletedCount, totalDays, completionPercentage } = getPlanCompletionData(plan.id);
                            return (
                                <div key={plan.id} className={styles.card}>
                                    <div className={styles.cardImageContainer}><img src={plan.image} alt={plan.title} className={styles.cardImage} /></div>
                                    <div className={styles.cardContent}>
                                        <h3 className={styles.cardTitle}>{plan.title}</h3>
                                        <div className={styles.completionStatus}>
                                            <div className={styles.completionSummary}>{daysCompletedCount} / {totalDays} يوم</div>
                                            <div className={styles.progressBar}>
                                                <div className={styles.progressFill} style={{ width: `${completionPercentage}%` }}></div>
                                            </div>
                                        </div>
                                        <div className={styles.cardActions}>
                                            <Link href={`/studyPlans/${plan.id}`} className={styles.cardButton}>متابعة الخطة</Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </main>
    );
};

export default LandingPage;