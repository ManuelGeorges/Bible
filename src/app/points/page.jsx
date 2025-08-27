'use client';

import React, { useState, useEffect } from 'react';
import styles from './points.module.css';
import { db } from '/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { FaBookOpen, FaFeatherAlt, FaHeart, FaCalendarCheck } from 'react-icons/fa';

const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d]).join('');
};

const calculatePointsFromData = (data) => {
    let totalPoints = 0;
    const history = [];

    const POINTS_PER_DAILY_QUESTION = 10;
    const POINTS_PER_FAVOURITE_VERSE = 10;
    const POINTS_PER_COMPLETED_CHAPTER = 20;
    const POINTS_PER_STUDY_PLAN_DAY = 30;

    if (data.answeredQuestions) {
        Object.values(data.answeredQuestions).forEach(q => {
            if (q.isCorrect) {
                totalPoints += POINTS_PER_DAILY_QUESTION;
                history.push({
                    activity: 'dailyQuestion',
                    points: POINTS_PER_DAILY_QUESTION,
                    description: `إجابة صحيحة على سؤال: "${q.question}"`,
                    timestamp: q.date,
                });
            }
        });
    }

    if (data.favorites && data.favorites.verses) {
        Object.values(data.favorites.verses).forEach(v => {
            totalPoints += POINTS_PER_FAVOURITE_VERSE;
            history.push({
                activity: 'favouriteVerse',
                points: POINTS_PER_FAVOURITE_VERSE,
                description: `إضافة آية مفضلة من "${v.bookName}"`,
                timestamp: v.dateAdded,
            });
        });
    }

    if (data.completedChapters) {
        Object.values(data.completedChapters).forEach(ch => {
            if (ch.isCompleted) {
                totalPoints += POINTS_PER_COMPLETED_CHAPTER;
                history.push({
                    activity: 'completedChapter',
                    points: POINTS_PER_COMPLETED_CHAPTER,
                    description: `إكمال إصحاح "${ch.bookName} - ${ch.chapter}"`,
                    timestamp: ch.dateCompleted,
                });
            }
        });
    }

    if (data.completedPlans) {
        Object.values(data.completedPlans).forEach(plan => {
            if (plan.completedDays) {
                Object.values(plan.completedDays).forEach(day => {
                    if (day.isCompleted) {
                        totalPoints += POINTS_PER_STUDY_PLAN_DAY;
                        history.push({
                            activity: 'studyPlanDay',
                            points: POINTS_PER_STUDY_PLAN_DAY,
                            description: `إكمال يوم في الخطة الدراسية`,
                            timestamp: day.dateCompleted,
                        });
                    }
                });
            }
        });
    }

    return { totalPoints, history };
};

const categorizeActivities = (history, timeframe) => {
    const now = new Date();
    let startDate;

    if (timeframe === 'day') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === 'week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const filteredActivities = history.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= startDate;
    });

    const summary = {
        totalPoints: 0,
        dailyQuestions: { count: 0, points: 0, items: [] },
        completedChapters: { count: 0, points: 0, items: [] },
        favouriteVerses: { count: 0, points: 0, items: [] },
        studyPlanDays: { count: 0, points: 0, items: [] },
    };

    filteredActivities.forEach(item => {
        summary.totalPoints += item.points;
        if (item.activity === 'dailyQuestion') {
            summary.dailyQuestions.count++;
            summary.dailyQuestions.points += item.points;
            summary.dailyQuestions.items.push(item);
        } else if (item.activity === 'completedChapter') {
            summary.completedChapters.count++;
            summary.completedChapters.points += item.points;
            summary.completedChapters.items.push(item);
        } else if (item.activity === 'favouriteVerse') {
            summary.favouriteVerses.count++;
            summary.favouriteVerses.points += item.points;
            summary.favouriteVerses.items.push(item);
        } else if (item.activity === 'studyPlanDay') {
            summary.studyPlanDays.count++;
            summary.studyPlanDays.points += item.points;
            summary.studyPlanDays.items.push(item);
        }
    });

    return summary;
};

export default function Points() {
    const [user, setUser] = useState(null);
    const [pointsData, setPointsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('day');

    const handleTimeframeChange = (newTimeframe) => {
        setTimeframe(newTimeframe);
    };

    // Corrected: Now formattedPoints is calculated from the *time-filtered* summary
    const activitiesSummary = pointsData ? categorizeActivities(pointsData.history, timeframe) : null;
    const formattedPoints = activitiesSummary ? convertToArabicNumber(activitiesSummary.totalPoints) : '٠';

    const renderActivityList = (activity) => {
        if (activity.items.length === 0) {
            return <p className={styles.noData}>لا يوجد بيانات في هذه الفترة.</p>;
        }
        return (
            <ul className={styles.activityList}>
                {activity.items.map((item, index) => (
                    <li key={index} className={styles.activityItem}>
                        <p className={styles.activityDescription}>{item.description}</p>
                        <span className={styles.activityPoints}>+ {convertToArabicNumber(item.points)} نقطة</span>
                    </li>
                ))}
            </ul>
        );
    };

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const { totalPoints, history } = calculatePointsFromData(data);
                        setPointsData({ totalPoints, history });
                    } else {
                        setPointsData({ history: [], totalPoints: 0 });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching Firestore data: ", error);
                    setLoading(false);
                    setPointsData(null);
                });
                return () => unsubscribeFirestore();
            } else {
                const localData = localStorage.getItem('guestPointsData');
                if (localData) {
                    const data = JSON.parse(localData);
                    const { totalPoints, history } = calculatePointsFromData(data);
                    setPointsData({ totalPoints, history });
                } else {
                    setPointsData({ history: [], totalPoints: 0 });
                }
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Effect لحفظ البيانات في localStorage إذا كان المستخدم غير مسجل
    useEffect(() => {
        if (!user && pointsData) {
            // هنا يجب أن تتأكد من أن البيانات التي ستحفظها في localStorage هي نفسها التي سيتم تحليلها
            // الكود أدناه هو مجرد مثال، يجب أن يكون هناك مكان لإضافة البيانات للـlocalStorage
            // بناءً على تفاعلات المستخدم (إجابة سؤال، إكمال إصحاح، إلخ.)
            // وهذا يتطلب تعديلات على الدوال التي تضيف النقاط
            // localStorage.setItem('guestPointsData', JSON.stringify(data));
        }
    }, [user, pointsData]);

    if (loading) {
        return <div className={styles.loading}>جاري تحميل البيانات...</div>;
    }

    const showDailyQuestions = activitiesSummary?.dailyQuestions.count > 0;
    const showCompletedChapters = activitiesSummary?.completedChapters.count > 0;
    const showFavouriteVerses = activitiesSummary?.favouriteVerses.count > 0;
    const showStudyPlanDays = activitiesSummary?.studyPlanDays.count > 0;

    return (
        <div className={styles.container} dir="rtl">
            <h1 className={styles.header}>النقاط والإنجازات</h1>
            <div className={styles.pointsSummary}>
                <div className={styles.pointsTotal}>
                    <span className={styles.pointsNumber}>{formattedPoints}</span>
                    <span className={styles.pointsLabel}>نقطة إجمالاً</span>
                </div>
            </div>

            {!user && (
                <div className={styles.loginMessage}>
                    <p>أنت تتصفح كنقطة زائر. <br/> سجل الدخول لمزامنة نقاطك وحفظها على كل أجهزتك.</p>
                </div>
            )}

            <div className={styles.timeframeButtons}>
                <button
                    onClick={() => handleTimeframeChange('day')}
                    className={`${styles.timeframeButton} ${timeframe === 'day' ? styles.active : ''}`}
                >
                    اليوم
                </button>
                <button
                    onClick={() => handleTimeframeChange('week')}
                    className={`${styles.timeframeButton} ${timeframe === 'week' ? styles.active : ''}`}
                >
                    الأسبوع
                </button>
                <button
                    onClick={() => handleTimeframeChange('month')}
                    className={`${styles.timeframeButton} ${timeframe === 'month' ? styles.active : ''}`}
                >
                    الشهر
                </button>
                <button
                    onClick={() => handleTimeframeChange('year')}
                    className={`${styles.timeframeButton} ${timeframe === 'year' ? styles.active : ''}`}
                >
                    السنة
                </button>
            </div>

            {activitiesSummary && (
                <div className={styles.activitiesContainer}>
                    <div className={styles.summaryGrid}>
                        <div className={styles.summaryCard}>
                            <FaFeatherAlt className={styles.icon} />
                            <h3 className={styles.cardTitle}>أسئلة يومية</h3>
                            <p className={styles.cardCount}>
                                {convertToArabicNumber(activitiesSummary.dailyQuestions.count)}
                                <br />
                                <span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.dailyQuestions.points)} نقطة)</span>
                            </p>
                        </div>
                        <div className={styles.summaryCard}>
                            <FaBookOpen className={styles.icon} />
                            <h3 className={styles.cardTitle}>إصحاحات مكتملة</h3>
                            <p className={styles.cardCount}>
                                {convertToArabicNumber(activitiesSummary.completedChapters.count)}
                                <br />
                                <span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.completedChapters.points)} نقطة)</span>
                            </p>
                        </div>
                        <div className={styles.summaryCard}>
                            <FaHeart className={styles.icon} />
                            <h3 className={styles.cardTitle}>آيات مفضلة</h3>
                            <p className={styles.cardCount}>
                                {convertToArabicNumber(activitiesSummary.favouriteVerses.count)}
                                <br />
                                <span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.favouriteVerses.points)} نقطة)</span>
                            </p>
                        </div>
                        <div className={styles.summaryCard}>
                            <FaCalendarCheck className={styles.icon} />
                            <h3 className={styles.cardTitle}>أيام خطط دراسية</h3>
                            <p className={styles.cardCount}>
                                {convertToArabicNumber(activitiesSummary.studyPlanDays.count)}
                                <br />
                                <span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.studyPlanDays.points)} نقطة)</span>
                            </p>
                        </div>
                    </div>

                    <div className={styles.detailedHistory}>
                        <h2 className={styles.detailedHeader}>سجل الأنشطة في هذه الفترة</h2>
                        {(showDailyQuestions || showCompletedChapters || showFavouriteVerses || showStudyPlanDays) ? (
                            <>
                                {showDailyQuestions && (
                                    <div className={styles.activitySection}>
                                        <h3 className={styles.sectionHeader}>أسئلة يومية</h3>
                                        {renderActivityList(activitiesSummary.dailyQuestions)}
                                    </div>
                                )}
                                {showCompletedChapters && (
                                    <div className={styles.activitySection}>
                                        <h3 className={styles.sectionHeader}>إصحاحات مكتملة</h3>
                                        {renderActivityList(activitiesSummary.completedChapters)}
                                    </div>
                                )}
                                {showFavouriteVerses && (
                                    <div className={styles.activitySection}>
                                        <h3 className={styles.sectionHeader}>آيات مفضلة</h3>
                                        {renderActivityList(activitiesSummary.favouriteVerses)}
                                    </div>
                                )}
                                {showStudyPlanDays && (
                                    <div className={styles.activitySection}>
                                        <h3 className={styles.sectionHeader}>أيام خطط دراسية</h3>
                                        {renderActivityList(activitiesSummary.studyPlanDays)}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={styles.noDataSection}>
                                <p>لا توجد أنشطة مسجلة في هذه الفترة الزمنية.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}