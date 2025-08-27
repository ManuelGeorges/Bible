'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { app, db } from '/lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth(app) : null;
const firestore = db;

const allPlans = studyPlansData.plans;

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

    const checkAndSyncLocalAnswers = useCallback(async (loggedInUser) => {
        if (!loggedInUser || !firestore) return;

        const dateKey = new Date().toISOString().split('T')[0];
        const userAnswers = JSON.parse(localStorage.getItem('userAnswers') || '{}');
        const answerForToday = userAnswers[dateKey];
        const firestoreAnswered = localStorage.getItem(`questionAnswered_${dateKey}_firestore`);

        if (answerForToday && !firestoreAnswered) {
            try {
                const userRef = doc(firestore, 'users', loggedInUser.uid);
                const userSnap = await getDoc(userRef);
                let userData = {};
                if (userSnap.exists()) {
                    userData = userSnap.data();
                }

                const updatedNotes = (userData.notes || 0) + answerForToday.points;
                const updatedAnsweredQuestions = {
                    ...userData.answeredQuestions,
                    [dateKey]: {
                        answered: true,
                        isCorrect: answerForToday.isCorrect,
                        question: answerForToday.question,
                        userAnswer: answerForToday.userAnswer,
                        date: dateKey
                    }
                };

                await setDoc(userRef, {
                    notes: updatedNotes,
                    answeredQuestions: updatedAnsweredQuestions
                }, { merge: true });

                localStorage.setItem(`questionAnswered_${dateKey}_firestore`, 'true');
                console.log("Local answer synced to Firestore successfully!");
            } catch (error) {
                console.error("Error syncing local answer to Firestore:", error);
            }
        }
    }, []);

    useEffect(() => {
        if (auth) {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                setUser(user);
                if (user) {
                    checkAndSyncLocalAnswers(user);
                }
            });
            return () => unsubscribe();
        }
    }, [checkAndSyncLocalAnswers]);

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

    const fetchDailyQuestion = useCallback(async () => {
        const today = new Date();
        const dateKey = today.toISOString().split('T')[0];
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        try {
            const answeredToday = localStorage.getItem(`questionAnswered_${dateKey}`);
            setHasAnswered(!!answeredToday);
            
            const response = await fetch('/data/dailyQuestions.json');
            if (!response.ok) {
                throw new Error('Network response for daily questions was not ok');
            }
            const dailyQuestionsData = await response.json();
            
            const questionForToday = dailyQuestionsData.find(q => q.month === currentMonth && q.day === currentDay);
            setDailyQuestion(questionForToday || null);
        } catch (error) {
            console.error(`Error loading questions:`, error);
            setDailyQuestion(null);
        }
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

    const toggleFavoriteDailyVerse = useCallback(() => {
        if (!dailyVerse) return;
        
        try {
            const favorites = getFavorites();
            const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
            
            if (favorites[verseKey]) {
                delete favorites[verseKey];
                showFavouriteMessage('تم حذف الآية من المفضلة!');
            } else {
                favorites[verseKey] = {
                    type: 'verse',
                    verseKey,
                    text: dailyVerse.verse,
                    bookName: 'آية اليوم',
                    bookNameAbbrev: 'Daily',
                    chapter: dailyVerse.month,
                    verseIndex: dailyVerse.day,
                    language: 'ar',
                    isDailyVerse: true
                };
                showFavouriteMessage('تم إضافة الآية إلى المفضلة!');
            }
            saveFavorites(favorites);
        } catch {
            showFavouriteMessage('حدث خطأ في الحفظ!');
        }
    }, [dailyVerse, getFavorites, saveFavorites, showFavouriteMessage]);

    const isDailyVerseFavorite = useMemo(() => {
        if (!dailyVerse) return false;
        const favorites = getFavorites();
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        return !!favorites[verseKey];
    }, [dailyVerse, getFavorites]);

    const handleAnswerSubmit = useCallback(async () => {
        const today = new Date();
        const dateKey = today.toISOString().split('T')[0];

        if (hasAnswered || !dailyQuestion || selectedAnswer === null) {
            showQuestionMessage('لقد أجبت على سؤال اليوم بالفعل أو لم تختار إجابة.');
            return;
        }

        try {
            const isCorrect = selectedAnswer === dailyQuestion.answerIndex;
            const pointsToAdd = isCorrect ? 5 : 0;
            
            const notes = parseInt(localStorage.getItem('notes') || '0', 10);
            localStorage.setItem('notes', notes + pointsToAdd);

            const userAnswers = JSON.parse(localStorage.getItem('userAnswers') || '{}');
            userAnswers[dateKey] = {
                question: dailyQuestion.question,
                userAnswer: dailyQuestion.options[selectedAnswer],
                correctAnswer: dailyQuestion.options[dailyQuestion.answerIndex],
                isCorrect: isCorrect,
                points: pointsToAdd
            };
            localStorage.setItem('userAnswers', JSON.stringify(userAnswers));
            localStorage.setItem(`questionAnswered_${dateKey}`, 'true');

            showQuestionMessage(isCorrect ? 'إجابة صحيحة!' : 'إجابة خاطئة.');
            if (isCorrect) {
                showQuestionMessage('تمت إضافة 5 نقاط إلى ملاحظاتك!');
            }
            
            setHasAnswered(true);

            if (user && firestore) {
                const userRef = doc(firestore, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                let userData = {};
                if (userSnap.exists()) {
                    userData = userSnap.data();
                }

                const updatedNotes = (userData.notes || 0) + pointsToAdd;
                const updatedAnsweredQuestions = {
                    ...userData.answeredQuestions,
                    [dateKey]: {
                        answered: true,
                        isCorrect: isCorrect,
                        question: dailyQuestion.question,
                        userAnswer: dailyQuestion.options[selectedAnswer],
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
    }, [hasAnswered, selectedAnswer, dailyQuestion, showQuestionMessage, user]);

    useEffect(() => {
        setStartedPlans(getStartedPlans());
    }, []);

    useEffect(() => {
        fetchDailyVerse();
        fetchDailyQuestion();
    }, [fetchDailyVerse, fetchDailyQuestion]);

    const handleOptionClick = (index) => {
        if (!hasAnswered) {
            setSelectedAnswer(index);
            handleAnswerSubmit();
        }
    };

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
            <h1 className={`${styles.heading} ${styles.floating}`}>
                مرحباً بك في تطبيق Agios
            </h1>

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
        </main>
    );
};

export default LandingPage;