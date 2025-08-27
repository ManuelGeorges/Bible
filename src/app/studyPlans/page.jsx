'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './studyPlans.module.css';
import studyPlansData from './studyPlansData.json';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { app, db } from '/lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth(app) : null;
const firestore = db;

const allPlans = studyPlansData.plans;

export default function StudyPlans() {
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [completionData, setCompletionData] = useState({});
  const [user, setUser] = useState(null);

  const fetchPlansFromFirestore = useCallback(async (loggedInUser) => {
    if (!loggedInUser || !firestore) return;

    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().completedPlans) {
        const firestoreCompletedPlans = userSnap.data().completedPlans;
        const newCompletionData = {};
        allPlans.forEach(plan => {
          const firestorePlanData = firestoreCompletedPlans[plan.id];
          if (firestorePlanData) {
            const daysCompletedCount = firestorePlanData.completedDays ? firestorePlanData.completedDays.length : 0;
            const totalDays = plan.readings.length;
            const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;
            newCompletionData[plan.id] = {
              daysCompletedCount: daysCompletedCount,
              totalDays: totalDays,
              completionPercentage: completionPercentage
            };
          }
        });
        setCompletionData(newCompletionData);
      }
    } catch (error) {
      console.error("Error fetching plans from Firestore:", error);
    }
  }, []);

  const saveProgressToFirestore = useCallback(async (loggedInUser, planId, completedDays) => {
    if (!loggedInUser || !firestore) return;

    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const daysCompletedCount = completedDays ? Object.keys(completedDays).length : 0;
      const totalDays = allPlans.find(p => p.id === planId)?.readings.length || 0;
      const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;

      await setDoc(userRef, {
        completedPlans: {
          [planId]: {
            completedDays: completedDays,
            completionPercentage: completionPercentage
          }
        }
      }, { merge: true });
    } catch (error) {
      console.error("Error saving progress to Firestore:", error);
    }
  }, []);

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((loggedInUser) => {
        setUser(loggedInUser);
        if (loggedInUser) {
          fetchPlansFromFirestore(loggedInUser);
        }
      });
      return () => unsubscribe();
    }
  }, [fetchPlansFromFirestore]);

  useEffect(() => {
    if (!user) {
      const data = {};
      allPlans.forEach(plan => {
        const storedCompletedDays = localStorage.getItem(`completedDays_${plan.id}`);
        if (storedCompletedDays) {
          const completedDays = JSON.parse(storedCompletedDays);
          const daysCompletedCount = Object.values(completedDays).filter(Boolean).length;
          const totalDays = plan.readings.length;
          const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;
          data[plan.id] = { daysCompletedCount, totalDays, completionPercentage };
        }
      });
      setCompletionData(data);
    }
  }, [user]);

  const filteredPlans = allPlans.filter(plan => {
    if (activeFilter === 'الكل') {
      return true;
    }
    return plan.type === activeFilter;
  });

  const filters = ['الكل', ...new Set(allPlans.map(plan => plan.type))];

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>خطط قراءة الكتاب المقدس</h1>
        <p className={styles.description}>
          اختر خطة القراءة التي تناسبك و ابدأ رحلتك في كلمة الله اليوم. سواء كنت تفضل خطة سنوية شاملة أو خطة قصيرة للمزامير والأناجيل، ستجد ما يعينك على النمو الروحي.
        </p>
      </div>
      
      <div className={styles.filterSection}>
        {filters.map(filter => (
          <button
            key={filter}
            className={`${styles.filterButton} ${activeFilter === filter ? styles.activeFilter : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className={styles.plansGrid}>
        {filteredPlans.map(plan => {
          const planCompletionData = completionData[plan.id] || { daysCompletedCount: 0, totalDays: plan.readings.length, completionPercentage: 0 };
          const hasStarted = planCompletionData.daysCompletedCount > 0;

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
                {hasStarted && (
                  <div className={styles.completionStatus}>
                    <div className={styles.completionSummary}>
                      {planCompletionData.daysCompletedCount} / {planCompletionData.totalDays} يوم
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill} 
                        style={{ width: `${planCompletionData.completionPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className={styles.cardActions}>
                  <Link href={`/studyPlans/${plan.id}`} className={styles.cardButton}>
                    {hasStarted ? `متابعة الخطة (${planCompletionData.completionPercentage}%)` : 'ابدأ الآن'}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}