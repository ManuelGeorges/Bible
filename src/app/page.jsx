'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';

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
    const [fontSize, setFontSize] = useState(18);

    useEffect(() => {
        if (Capacitor.getPlatform() === 'android') {
            const handleUpdate = async () => {
                try {
                    const { AppUpdate } = await import('@capawesome-team/app-update');
                    const result = await AppUpdate.getAppUpdateInfo();
                    if (result.updateAvailability === 2) {
                        await AppUpdate.performImmediateUpdate();
                    }
                } catch (e) {
                    console.log("Update check skipped or failed");
                }
            };
            handleUpdate();
        }
    }, []);

    useEffect(() => {
        const savedFontSize = localStorage.getItem('bibleFontSize');
        if (savedFontSize) setFontSize(parseInt(savedFontSize));

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
        } catch {
            setDailyVerse({ verse: 'خطأ في التحميل', reference: '' });
        } finally {
            setIsLoadingVerse(false);
        }
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
                } else {
                    setHasAnswered(answeredLocally);
                }
            } else {
                setHasAnswered(answeredLocally);
            }
        } catch {
            setDailyQuestion(null);
        }
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
        await navigator.clipboard.writeText(`"${dailyVerse.verse}" - (${dailyVerse.reference})`);
        showCopiedMessage('تم النسخ بنجاح!');
    }, [dailyVerse, showCopiedMessage]);

    const toggleFavoriteDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        const favorites = getFavorites();
        let newFavorites = { ...favorites };
        if (favorites[verseKey]) {
            delete newFavorites[verseKey];
            showFavouriteMessage('تم الحذف!');
        } else {
            newFavorites[verseKey] = { text: dailyVerse.verse, reference: dailyVerse.reference, dateAdded: new Date().toISOString() };
            showFavouriteMessage('تمت الإضافة!');
        }
        saveFavorites(newFavorites);
        if (user) await setDoc(doc(firestore, 'users', user.uid), { favorites: { verses: newFavorites } }, { merge: true });
    }, [dailyVerse, getFavorites, saveFavorites, showFavouriteMessage, user]);

    const isDailyVerseFavorite = useMemo(() => dailyVerse ? !!getFavorites()[`daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`] : false, [dailyVerse, getFavorites]);

    const handleOptionClick = useCallback(async (index) => {
        if (hasAnswered || !dailyQuestion) return;
        setSelectedAnswer(index);
        setHasAnswered(true);
        const isCorrect = index === dailyQuestion.answerIndex;
        const dateKey = getTodayDateKey();
        localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
        if (user) {
            try {
                await setDoc(doc(firestore, 'users', user.uid), {
                    answeredQuestions: {
                        [dateKey]: { answered: true, correct: isCorrect, timestamp: new Date().toISOString() }
                    }
                }, { merge: true });
                showQuestionMessage(isCorrect ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة. 😔');
            } catch (error) { console.error(error); }
        } else {
            showQuestionMessage(isCorrect ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة. 😔');
        }
    }, [hasAnswered, dailyQuestion, user, getTodayDateKey, showQuestionMessage]);

    const getOptionClassName = (index) => {
        if (!hasAnswered) return styles.optionButton;
        if (index === dailyQuestion.answerIndex) return `${styles.optionButton} ${styles.correctAnswer}`;
        if (index === selectedAnswer) return `${styles.optionButton} ${styles.wrongAnswer}`;
        return styles.optionButton;
    };

    return (
        <main className={`${styles.container} ${styles.rtl}`}>
            <header className={styles.header}>
                <Image src="/images/Agios.png" alt="Logo" width={140} height={140} priority className={styles.logoImg} />
                <div className={styles.titleWrapper}>
                    <h1 className={styles.siteTitle}>Agios Bible</h1>
                    <span className={styles.betaBadge}>Beta version</span>
                </div>
                <h2 className={styles.subtitle}>مرحباً بك في رحلتك الروحية اليومية</h2>
            </header>

            {showInstallBtn && (
                <div className={styles.installSection}>
                    <div className={styles.installIcon}>📲</div>
                    <h3 className={styles.installTitle}>ثبّت تطبيق أجيوس</h3>
                    <p className={styles.installDesc}>تصفح الكتاب المقدس <strong>بدون إنترنت</strong> وبسرعة فائقة.</p>
                    <button onClick={handleInstallClick} className={styles.premiumInstallBtn}>
                        <span>تثبيت الآن</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17v1a3 3 0 003 3h14a3 3 0 003-3v-1"/></svg>
                    </button>
                </div>
            )}

            {!user && (
                <div className={styles.guestAlert}>
                    <div className={styles.guestAlertIcon}>✨</div>
                    <div className={styles.guestAlertContent}>
                        <h3 className={styles.guestAlertTitle}>سجل دخولك</h3>
                        <p className={styles.guestAlertDesc}>لحفظ تقدمك ومزامنة آياتك المفضلة بين أجهزتك.</p>
                    </div>
                    <Link href="/login" className={styles.guestLoginBtn}>تسجيل الدخول</Link>
                </div>
            )}

            <div className={styles.dailyVerseBox}>
                <h2 className={styles.dailyVerseTitle}>آية اليوم</h2>
                {isLoadingVerse ? <div className={styles.skeletonText}></div> : (
                    <>
                        <p className={styles.dailyVerseText} style={{ fontSize: `${fontSize}px` }}>"{dailyVerse?.verse}"</p>
                        <p className={styles.dailyVerseReference}>{dailyVerse?.reference}</p>
                        <div className={styles.dailyVerseActions}>
                            <button onClick={copyDailyVerse} className={styles.actionButton}>📋 نسخ</button>
                            <button onClick={toggleFavoriteDailyVerse} className={`${styles.actionButton} ${isDailyVerseFavorite ? styles.isFavourite : ''}`}>
                                {isDailyVerseFavorite ? '⭐ مضافة' : '⭐ مفضلة'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {dailyQuestion && (
                <div className={styles.dailyQuestionBox}>
                    <h2 className={styles.dailyQuestionTitle}>سؤال اليوم</h2>
                    <p className={styles.dailyQuestionText} style={{ fontSize: `${fontSize}px` }}>{dailyQuestion.question}</p>
                    <div className={styles.optionsContainer}>
                        {dailyQuestion.options.map((option, index) => (
                            <button key={index} onClick={() => handleOptionClick(index)} className={getOptionClassName(index)} disabled={hasAnswered}>
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {startedPlans.length > 0 && (
                <section className={styles.plansSection}>
                    <h2 className={styles.plansSectionTitle}>خطط قيد التنفيذ</h2>
                    <div className={styles.plansGrid}>
                        {startedPlans.map(plan => {
                            const { daysCompletedCount, totalDays, completionPercentage } = getPlanCompletionData(plan.id);
                            return (
                                <div key={plan.id} className={styles.card}>
                                    <div className={styles.cardImageContainer}>
                                        <Image src={plan.image} alt={plan.title} width={320} height={180} className={styles.cardImage} />
                                    </div>
                                    <div className={styles.cardContent}>
                                        <h3 className={styles.cardTitle}>{plan.title}</h3>
                                        <div className={styles.progressWrapper}>
                                            <div className={styles.progressInfo}>
                                                <span>{daysCompletedCount} من {totalDays} يوم</span>
                                                <span>{completionPercentage}%</span>
                                            </div>
                                            <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${completionPercentage}%` }}></div></div>
                                        </div>
                                        <Link href={`/studyPlans/${plan.id}`} className={styles.cardButton}>متابعة القراءة</Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
            
            <div className={styles.toastContainer}>
                {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}
                {favouriteMessage && <div className={styles.toast}>{favouriteMessage}</div>}
                {questionMessage && <div className={styles.toast}>{questionMessage}</div>}
            </div>
        </main>
    );
};

export default LandingPage;