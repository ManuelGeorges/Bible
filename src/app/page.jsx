'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '/lib/firebase';

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
        } catch {
            return {};
        }
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
    if (typeof window === 'undefined') {
        return [];
    }
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

    const getTodayDateKey = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const fetchDailyVerse = useCallback(async () => {
        setIsLoadingVerse(true);
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        try {
            const response = await fetch('/data/dailyVerses.json');
            if (!response.ok) {
                throw new Error('Network response for daily verses was not ok');
            }
            const dailyVersesData = await response.json();
            const verseForToday = dailyVersesData.find(v => v.month === currentMonth && v.day === currentDay);
            
            setDailyVerse(verseForToday || { verse: 'آية اليوم غير متوفرة لهذا التاريخ. يرجى التحقق من بيانات الآيات.', reference: '' });
        } catch (error) {
            console.error(`Error loading verses:`, error);
            setDailyVerse({ verse: 'آية اليوم غير متوفرة لهذا التاريخ. يرجى التحقق من بيانات الآيات.', reference: '' });
        } finally {
            setIsLoadingVerse(false);
        }
    }, []);

    const fetchDailyQuestion = useCallback(async (loggedInUser) => {
        const dateKey = getTodayDateKey();
        try {
            const response = await fetch('/data/dailyQuestions.json');
            if (!response.ok) {
                throw new Error('Network response for daily questions was not ok');
            }
            const dailyQuestionsData = await response.json();
            const questionForToday = dailyQuestionsData.find(q => q.month === new Date().getMonth() + 1 && q.day === new Date().getDate());
            setDailyQuestion(questionForToday || null);

            let answeredLocally = localStorage.getItem(`questionAnswered_${dateKey}`) === 'true';

            if (loggedInUser) {
                const userRef = doc(firestore, 'users', loggedInUser.uid);
                const userSnap = await getDoc(userRef);
                const firestoreAnsweredQuestions = userSnap.exists() && userSnap.data().answeredQuestions ? userSnap.data().answeredQuestions : {};
                
                if (firestoreAnsweredQuestions[dateKey]?.answered) {
                    setHasAnswered(true);
                    localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
                } else if (answeredLocally) {
                    const userAnswers = JSON.parse(localStorage.getItem('userAnswers') || '{}');
                    const answerForToday = userAnswers[dateKey];
                    if (answerForToday) {
                        await setDoc(userRef, {
                            notes: (userSnap.data().notes || 0) + answerForToday.points,
                            answeredQuestions: {
                                ...firestoreAnsweredQuestions,
                                [dateKey]: {
                                    answered: true,
                                    isCorrect: answerForToday.isCorrect,
                                    question: answerForToday.question,
                                    userAnswer: answerForToday.userAnswer,
                                    date: dateKey
                                }
                            }
                        }, { merge: true });
                        setHasAnswered(true);
                    }
                } else {
                    setHasAnswered(false);
                }
            } else {
                setHasAnswered(answeredLocally);
            }
        } catch (error) {
            console.error(`Error loading questions:`, error);
            setDailyQuestion(null);
            setError('حدث خطأ في تحميل السؤال.');
        }
    }, [getTodayDateKey]);

    useEffect(() => {
        if (auth) {
            const unsubscribe = auth.onAuthStateChanged((loggedInUser) => {
                setUser(loggedInUser);
                fetchDailyQuestion(loggedInUser);
            });
            return () => unsubscribe();
        }
        fetchDailyQuestion(null);
    }, [fetchDailyQuestion]);

    useEffect(() => {
        fetchDailyVerse();
    }, [fetchDailyVerse]);

    useEffect(() => {
        setStartedPlans(getStartedPlans());
    }, []);

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
            showCopiedMessage('تم النسخ!');
        } catch {
            showCopiedMessage('فشل النسخ!');
        }
    }, [dailyVerse, showCopiedMessage]);

    const toggleFavoriteDailyVerse = useCallback(async () => {
        if (!dailyVerse) return;
        try {
            const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
            const favorites = getFavorites();

            const isCurrentlyFavorite = !!favorites[verseKey];
            let newFavorites;

            if (isCurrentlyFavorite) {
                newFavorites = { ...favorites };
                delete newFavorites[verseKey];
                showFavouriteMessage('تم حذف الآية من المفضلة!');
            } else {
                newFavorites = {
                    ...favorites,
                    [verseKey]: {
                        type: 'verse',
                        verseKey,
                        text: dailyVerse.verse,
                        bookName: 'آية اليوم',
                        bookNameAbbrev: 'Daily',
                        chapter: dailyVerse.month,
                        verseIndex: dailyVerse.day,
                        language: 'ar',
                        isDailyVerse: true,
                        dateAdded: new Date().toISOString()
                    }
                };
                showFavouriteMessage('تم إضافة الآية إلى المفضلة!');
            }
            saveFavorites(newFavorites);

            if (user && firestore) {
                const userRef = doc(firestore, 'users', user.uid);
                await setDoc(userRef, {
                    favorites: { verses: newFavorites }
                }, { merge: true });
            }
        } catch {
            showFavouriteMessage('حدث خطأ في الحفظ!');
        }
    }, [dailyVerse, getFavorites, saveFavorites, showFavouriteMessage, user]);

    const isDailyVerseFavorite = useMemo(() => {
        if (!dailyVerse) return false;
        const favorites = getFavorites();
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        return !!favorites[verseKey];
    }, [dailyVerse, getFavorites]);

    const handleOptionClick = useCallback(async (index) => {
        const dateKey = getTodayDateKey();
        if (hasAnswered || !dailyQuestion || selectedAnswer !== null) {
            return;
        }

        setSelectedAnswer(index);
        
        try {
            const isCorrect = index === dailyQuestion.answerIndex;
            const pointsToAdd = isCorrect ? 5 : 0;
            
            const userAnswers = JSON.parse(localStorage.getItem('userAnswers') || '{}');
            userAnswers[dateKey] = {
                question: dailyQuestion.question,
                userAnswer: dailyQuestion.options[index],
                correctAnswer: dailyQuestion.options[dailyQuestion.answerIndex],
                isCorrect: isCorrect,
                points: pointsToAdd
            };
            localStorage.setItem('userAnswers', JSON.stringify(userAnswers));
            localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
            setHasAnswered(true);
            showQuestionMessage(isCorrect ? 'إجابة صحيحة!' : 'إجابة خاطئة.');

            const currentNotes = parseInt(localStorage.getItem('notes') || '0', 10) + pointsToAdd;
            localStorage.setItem('notes', currentNotes.toString());

            if (user && firestore) {
                const userRef = doc(firestore, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                const updatedNotes = (userData.notes || 0) + pointsToAdd;
                const updatedAnsweredQuestions = {
                    ...(userData.answeredQuestions || {}),
                    [dateKey]: {
                        answered: true,
                        isCorrect: isCorrect,
                        question: dailyQuestion.question,
                        userAnswer: dailyQuestion.options[index],
                        date: dateKey
                    }
                };

                await setDoc(userRef, {
                    notes: updatedNotes,
                    answeredQuestions: updatedAnsweredQuestions
                }, { merge: true });
            }

        } catch (error) {
            console.error("Error submitting answer:", error);
            showQuestionMessage("حدث خطأ في إرسال الإجابة.");
        }
    }, [hasAnswered, selectedAnswer, dailyQuestion, showQuestionMessage, user, getTodayDateKey]);

    const getOptionClassName = (index) => {
        if (!hasAnswered) {
            return styles.optionButton;
        }
        if (index === dailyQuestion.answerIndex) {
            return `${styles.optionButton} ${styles.correctAnswer}`;
        }
        if (index === selectedAnswer) {
            return `${styles.optionButton} ${styles.wrongAnswer}`;
        }
        return styles.optionButton;
    };

    return (
        
        <main className={`${styles.container} ${styles.rtl}`}>
<header className={styles.header}>
                    <img 
            src="/images/Agios.png" 
            alt="Agios bible official logo" 
            className={styles.logoImg}
        />
        <h1 className={styles.siteTitle}>
            Agios Bible
        </h1>

    <h2 className={styles.subtitle}>
        مرحباً بك في تطبيقك لدراسة الكتاب المقدس
    </h2>

</header>
            {isLoadingVerse ? (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <p>جارٍ تحميل آية اليوم...</p>
                </div>
            ) : dailyVerse && (
                <div className={`${styles.dailyVerseBox} ${styles.floating}`}>
                    <h2 className={styles.dailyVerseTitle}>
                        آية اليوم
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
                            aria-label="نسخ"
                        >
                            📋 نسخ
                        </button>
                        <button 
                            onClick={toggleFavoriteDailyVerse} 
                            className={`${styles.actionButton} ${isDailyVerseFavorite ? styles.isFavourite : ''}`}
                            aria-label="مفضلة"
                        >
                            ⭐ {isDailyVerseFavorite ? 'مضافة' : 'مفضلة'}
                        </button>
                    </div>
                </div>
            )}
            
            {dailyQuestion && (
                <div className={`${styles.dailyQuestionBox} ${styles.floating}`}>
                    <h2 className={styles.dailyQuestionTitle}>
                        سؤال اليوم
                    </h2>
                    <p className={styles.dailyQuestionText}>
                        {dailyQuestion.question}
                    </p>
                    <div className={styles.optionsContainer}>
                        {dailyQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleOptionClick(index)}
                                className={getOptionClassName(index)}
                                disabled={hasAnswered}
                            >
                                {option}
                            </button>
                        ))}
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
            {questionMessage && (
                <div className={`${styles.messageBox} ${styles.questionMessage}`}>
                    {questionMessage}
                </div>
            )}
            
            {startedPlans.length > 0 && (
                <section className={styles.plansSection}>
                    <h2 className={styles.plansSectionTitle}>تابع خططك</h2>
                    <div className={styles.plansGrid}>
                        {startedPlans.map(plan => {
                            const { daysCompletedCount, totalDays, completionPercentage } = getPlanCompletionData(plan.id);
                            return (
                                <div key={plan.id} className={styles.card}>
                                    <div className={styles.cardImageContainer}>
                                        <img src={plan.image} alt={plan.title} className={styles.cardImage} />
                                    </div>
                                    <div className={styles.cardContent}>
                                        <h3 className={styles.cardTitle}>{plan.title}</h3>
                                        <p className={styles.cardDescription}>{plan.description}</p>
                                        <div className={styles.cardDetails}>
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>المدة:</span>
                                                <span className={styles.detailValue}>{plan.duration}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>النوع:</span>
                                                <span className={styles.detailValue}>{plan.type}</span>
                                            </div>
                                        </div>
                                        <div className={styles.completionStatus}>
                                            <div className={styles.completionSummary}>
                                                {daysCompletedCount} / {totalDays} يوم
                                            </div>
                                            <div className={styles.progressBar}>
                                                <div 
                                                    className={styles.progressFill} 
                                                    style={{ width: `${completionPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className={styles.cardActions}>
                                            <Link href={`/studyPlans/${plan.id}`} className={styles.cardButton}>
                                                متابعة الخطة
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

            )}
                <footer>
                    <p dir="ltr" className={styles.footerText}>
                    © CopyRight Agios Bible 2025, All Rights Reserved.
                    </p>
                </footer>
        </main>
    );
};

export default LandingPage;