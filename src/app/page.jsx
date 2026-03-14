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
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    useEffect(() => {
        const triggerDeepCache = async () => {
            const CACHE_NAME = 'agios-v1';
            const essentialFiles = ['/data/bibles/ar_svd.json', '/data/bookNames.json', '/data/dailyVerses.json', '/data/dailyQuestions.json', '/favicon.ico', '/manifest.json'];
            if ('caches' in window) {
                const cache = await caches.open(CACHE_NAME);
                essentialFiles.forEach(file => {
                    fetch(file, { priority: 'high' }).then(res => { if (res.ok) cache.put(file, res); }).catch(() => {});
                });
                allPlans.forEach(plan => {
                    const planJson = `/studyPlans/${plan.id}.json`;
                    fetch(planJson).then(res => { if (res.ok) cache.put(planJson, res); }).catch(() => {});
                });
            }
        };
        if (document.readyState === 'complete') { triggerDeepCache(); } else { window.addEventListener('load', triggerDeepCache); }
    }, []);

    useEffect(() => {
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBtn(true); };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") { setDeferredPrompt(null); setShowInstallBtn(false); }
    };

    const getTodayDateKey = useCallback(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }, []);

    const fetchDailyVerse = useCallback(async () => {
        setIsLoadingVerse(true);
        try {
            const response = await fetch('/data/dailyVerses.json');
            const data = await response.json();
            const today = new Date();
            const verse = data.find(v => v.month === today.getMonth() + 1 && v.day === today.getDate());
            setDailyVerse(verse || { verse: 'آية اليوم غير متوفرة', reference: '' });
        } catch { setDailyVerse({ verse: 'خطأ في التحميل', reference: '' }); } finally { setIsLoadingVerse(false); }
    }, []);

    const fetchDailyQuestion = useCallback(async (loggedInUser) => {
        const dateKey = getTodayDateKey();
        try {
            const response = await fetch('/data/dailyQuestions.json');
            const data = await response.json();
            const question = data.find(q => q.month === new Date().getMonth() + 1 && q.day === new Date().getDate());
            setDailyQuestion(question || null);
            let answeredLocally = localStorage.getItem(`questionAnswered_${dateKey}`) === 'true';
            if (loggedInUser) {
                const userSnap = await getDoc(doc(firestore, 'users', loggedInUser.uid));
                if (userSnap.exists() && userSnap.data().answeredQuestions?.[dateKey]?.answered) {
                    setHasAnswered(true);
                    localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
                } else { setHasAnswered(answeredLocally); }
            } else { setHasAnswered(answeredLocally); }
        } catch { setDailyQuestion(null); }
    }, [getTodayDateKey]);

    useEffect(() => {
        if (auth) {
            const unsubscribe = auth.onAuthStateChanged((u) => { setUser(u); fetchDailyQuestion(u); });
            return () => unsubscribe();
        }
        fetchDailyQuestion(null);
    }, [fetchDailyQuestion]);

    useEffect(() => { fetchDailyVerse(); }, [fetchDailyVerse]);
    useEffect(() => { setStartedPlans(getStartedPlans()); }, []);

    const copyDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        await navigator.clipboard.writeText(`"${dailyVerse.verse}" - (${dailyVerse.reference})`);
        showCopiedMessage('تم النسخ بنجاح!');
    }, [dailyVerse, showCopiedMessage]);

    const toggleFavoriteDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        const favorites = getFavorites();
        let newFavorites = { ...favorites };
        if (favorites[verseKey]) { delete newFavorites[verseKey]; showFavouriteMessage('تم الحذف!'); }
        else { newFavorites[verseKey] = { text: dailyVerse.verse, bookName: 'آية اليوم', dateAdded: new Date().toISOString() }; showFavouriteMessage('تمت الإضافة!'); }
        saveFavorites(newFavorites);
        if (user) await setDoc(doc(firestore, 'users', user.uid), { favorites: { verses: newFavorites } }, { merge: true });
    }, [dailyVerse, getFavorites, saveFavorites, showFavouriteMessage, user]);

    const isDailyVerseFavorite = useMemo(() => dailyVerse ? !!getFavorites()[`daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`] : false, [dailyVerse, getFavorites]);

    const handleOptionClick = useCallback(async (index) => {
        if (hasAnswered || !dailyQuestion) return;
        setSelectedAnswer(index);
        setHasAnswered(true);
        localStorage.setItem(`questionAnswered_${getTodayDateKey()}`, 'true');
        showQuestionMessage(index === dailyQuestion.answerIndex ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة. 😔');
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

            {showInstallBtn && (
                <div className={styles.installSection}>
                    <div className={styles.installIcon}>📲</div>
                    <h3 className={styles.installTitle}>ثبّت تطبيق أجيوس الآن</h3>
                    <p className={styles.installDesc}>استمتع بتجربة أسرع، ووصول كامل للكتاب المقدس <strong>بدون إنترنت</strong> في أي مكان.</p>
                    <button onClick={handleInstallClick} className={styles.premiumInstallBtn}>
                        <span>تثبيت على الجهاز</span>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 15L12 3M12 15L8 11M12 15L16 11M2 17L2 18C2 19.6569 3.34315 21 5 21L19 21C20.6569 21 22 19.6569 22 18L22 17" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
            )}

            {isLoadingVerse ? (
                <div className={styles.dailyVerseBox}><p>جارٍ التحميل...</p></div>
            ) : dailyVerse && (
                <div className={`${styles.dailyVerseBox}`}>
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
                <div className={`${styles.dailyQuestionBox}`}>
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