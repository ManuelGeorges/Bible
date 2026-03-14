'use client';

import React, { useState, useEffect } from 'react';
import styles from './points.module.css';
import { db } from '../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { FaBookOpen, FaFeatherAlt, FaHeart, FaCalendarCheck } from 'react-icons/fa';

const convertToArabicNumber = (num) => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

const calculatePointsFromData = (data) => {
  let totalPoints = 0;
  const history = [];

  const POINTS_PER_DAILY_QUESTION = 10;
  const POINTS_PER_FAVOURITE_VERSE = 10;
  const POINTS_PER_COMPLETED_CHAPTER = 20;
  const POINTS_PER_STUDY_PLAN_DAY = 30;

  if (data.answeredQuestions) {
    Object.entries(data.answeredQuestions).forEach(([dateKey, q]) => {
      if (q && (q.correct === true || q.isCorrect === true)) {
        totalPoints += POINTS_PER_DAILY_QUESTION;
        history.push({
          activity: 'dailyQuestion',
          points: POINTS_PER_DAILY_QUESTION,
          description: `إجابة صحيحة على سؤال يوم ${dateKey}`,
          timestamp: q.timestamp || dateKey,
        });
      }
    });
  }

  if (data.favorites && data.favorites.verses) {
    Object.values(data.favorites.verses).forEach(v => {
      if (v) {
        totalPoints += POINTS_PER_FAVOURITE_VERSE;
        history.push({
          activity: 'favouriteVerse',
          points: POINTS_PER_FAVOURITE_VERSE,
          description: `إضافة آية من "${v.bookName || 'الكتاب المقدس'}" للمفضلة`,
          timestamp: v.dateAdded || Date.now(),
        });
      }
    });
  }

  if (data.completedChapters) {
    Object.entries(data.completedChapters).forEach(([key, value]) => {
      const isDone = typeof value === 'boolean' ? value : value.isCompleted;
      if (isDone) {
        totalPoints += POINTS_PER_COMPLETED_CHAPTER;
        history.push({
          activity: 'completedChapter',
          points: POINTS_PER_COMPLETED_CHAPTER,
          description: `إكمال إصحاح في الكتاب المقدس`,
          timestamp: value.dateCompleted || Date.now(),
        });
      }
    });
  }

  if (data.completedPlans) {
    Object.values(data.completedPlans).forEach(plan => {
      if (plan && plan.completedDays) {
        Object.entries(plan.completedDays).forEach(([dayNum, dayInfo]) => {
          if (dayInfo && dayInfo.isCompleted) {
            totalPoints += POINTS_PER_STUDY_PLAN_DAY;
            history.push({
              activity: 'studyPlanDay',
              points: POINTS_PER_STUDY_PLAN_DAY,
              description: `إكمال اليوم ${dayNum} في الخطة الدراسية`,
              timestamp: dayInfo.dateCompleted || Date.now(),
            });
          }
        });
      }
    });
  }

  return { totalPoints, history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) };
};

const categorizeActivities = (history, timeframe) => {
  const now = new Date();
  let startDate = new Date();

  if (timeframe === 'day') startDate.setHours(0, 0, 0, 0);
  else if (timeframe === 'week') startDate.setDate(now.getDate() - 7);
  else if (timeframe === 'month') startDate.setMonth(now.getMonth() - 1);
  else startDate.setFullYear(now.getFullYear() - 1);

  const summary = {
    totalPoints: 0,
    dailyQuestions: { count: 0, points: 0 },
    completedChapters: { count: 0, points: 0 },
    favouriteVerses: { count: 0, points: 0 },
    studyPlanDays: { count: 0, points: 0 },
  };

  history.forEach(item => {
    const itemDate = new Date(item.timestamp);
    if (itemDate >= startDate) {
      summary.totalPoints += item.points;
      const keyMap = {
        dailyQuestion: 'dailyQuestions',
        completedChapter: 'completedChapters',
        favouriteVerse: 'favouriteVerses',
        studyPlanDay: 'studyPlanDays'
      };
      const category = keyMap[item.activity];
      if (category) {
        summary[category].count++;
        summary[category].points += item.points;
      }
    }
  });

  return summary;
};

export default function Points() {
  const [user, setUser] = useState(null);
  const [pointsData, setPointsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('day');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setPointsData(calculatePointsFromData(docSnap.data()));
          } else {
            setPointsData({ history: [], totalPoints: 0 });
          }
          setLoading(false);
        });
        return () => unsubFirestore();
      } else {
        setPointsData({ history: [], totalPoints: 0 });
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const activitiesSummary = pointsData ? categorizeActivities(pointsData.history, timeframe) : null;

  if (loading) return <div className={styles.loading}>جاري تحميل البيانات...</div>;

  return (
    <div className={styles.container} dir="rtl">
      <h1 className={styles.header}>النقاط والإنجازات</h1>
      <div className={styles.pointsSummary}>
        <div className={styles.pointsTotal}>
          <span className={styles.pointsNumber}>{convertToArabicNumber(activitiesSummary?.totalPoints || 0)}</span>
          <span className={styles.pointsLabel}>نقطة إجمالاً</span>
        </div>
      </div>

      <div className={styles.timeframeButtons}>
        {['day', 'week', 'month', 'year'].map(t => (
          <button 
            key={t}
            onClick={() => setTimeframe(t)} 
            className={`${styles.timeframeButton} ${timeframe === t ? styles.active : ''}`}
          >
            {t === 'day' ? 'اليوم' : t === 'week' ? 'الأسبوع' : t === 'month' ? 'الشهر' : 'السنة'}
          </button>
        ))}
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
            <h2 className={styles.detailedHeader}>سجل الأنشطة</h2>
            {activitiesSummary.totalPoints > 0 ? (
              <ul className={styles.activityList}>
                {pointsData.history
                  .filter(item => {
                    const itemDate = new Date(item.timestamp);
                    const now = new Date();
                    let checkDate = new Date();
                    if (timeframe === 'day') checkDate.setHours(0,0,0,0);
                    else if (timeframe === 'week') checkDate.setDate(now.getDate() - 7);
                    else if (timeframe === 'month') checkDate.setMonth(now.getMonth() - 1);
                    else checkDate.setFullYear(now.getFullYear() - 1);
                    return itemDate >= checkDate;
                  })
                  .map((item, i) => (
                    <li key={i} className={styles.activityItem}>
                      <div className={styles.activityInfo}>
                        <p className={styles.activityDescription}>{item.description}</p>
                        <span className={styles.activityDate}>
                          {new Date(item.timestamp).toLocaleDateString('ar-EG', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <span className={styles.activityPoints}>+ {convertToArabicNumber(item.points)} نقطة</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className={styles.noDataSection}>لا توجد أنشطة مسجلة في هذه الفترة.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}